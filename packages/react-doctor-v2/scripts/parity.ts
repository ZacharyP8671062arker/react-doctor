// Parity script: compares v1 and v2 react-doctor scores on a fixed fixture set.
//
// Both CLIs are invoked from their built `bin/react-doctor.js` in JSON mode.
// v2 issues are filtered to the v1 rule-ID surface (extracted from v1's
// `oxlint-config.ts` rule maps) and a v1-formula score is recomputed for v2.
// v1 issues are filtered to the same surface so knip-style dead-code rules
// (which have no v2 counterpart with the same ID) don't skew the comparison.
//
// Run: node --experimental-strip-types --no-warnings packages/react-doctor-v2/scripts/parity.ts
//
// Flags:
//   --refresh   re-clone OSS fixtures (drops the recorded SHA pin)

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(SCRIPT_FILE, "..", "..", "..", "..");
const V1_CLI = path.join(REPO_ROOT, "packages/react-doctor/bin/react-doctor.js");
const V2_CLI = path.join(REPO_ROOT, "packages/react-doctor-v2/bin/react-doctor.js");
const V1_OXLINT_CONFIG = path.join(REPO_ROOT, "packages/react-doctor/src/oxlint-config.ts");
const REPORT_PATH = path.join(REPO_ROOT, "parity-report.md");
const FIXTURE_BASE = path.join(os.homedir(), "dev/react-doctor-parity-testing");
const MANIFEST_PATH = path.join(FIXTURE_BASE, ".manifest.json");
const CONCURRENCY = 4;
const ERROR_PENALTY = 1.5;
const WARNING_PENALTY = 0.75;
const PERFECT_SCORE = 100;

const LEADERBOARD_REPOS = [
  "RhysSullivan/executor",
  "nodejs/nodejs.org",
  "tldraw/tldraw",
  "pingdotgg/t3code",
  "better-auth/better-auth",
  "excalidraw/excalidraw",
  "mastra-ai/mastra",
  "payloadcms/payload",
  "baptisteArno/typebot.io",
  "makeplane/plane",
  "medusajs/medusa",
  "RocketChat/Rocket.Chat",
  "twentyhq/twenty",
  "unkeyed/unkey",
  "shadcn-ui/ui",
  "triggerdotdev/trigger.dev",
  "formbricks/formbricks",
  "langfuse/langfuse",
  "ToolJet/ToolJet",
  "onlook-dev/onlook",
  "calcom/cal.com",
  "PostHog/posthog",
  "appsmithorg/appsmith",
  // supabase/supabase: excluded from default parity runs — it grinds for 17–20
  // min on apps/studio (3500+ source files × v2's ~200 custom rules in a
  // single JS thread). The Phase 6 ignore-path fix proved supabase CAN finish
  // under the 1 200 s ceiling, but every routine parity run paying that cost
  // is not worth it. Re-add this entry when checking parity on supabase
  // specifically.
  // "supabase/supabase",
  "getsentry/sentry",
  "lobehub/lobe-chat",
  "dubinc/dub",
];

const ECOSYSTEM_REPOS = [
  "TanStack/query",
  "pmndrs/react-three-fiber",
  "react-hook-form/react-hook-form",
  "framer/motion",
  "expo/expo",
];

const LOCAL_FIXTURES = [
  "/Users/rasmus/dev/ami-2/apps/frontend",
  "/Users/rasmus/dev/cheffect",
  "/Users/rasmus/dev/bunnings-lite",
];

// Monorepos where we only want to lint a specific workspace, not the whole
// clone. The clone happens once per `slug`; each entry below becomes its
// own row in the parity report with `<slug>/<subpath>` as the fixture id.
const MONOREPO_SUBPATH_FIXTURES: Array<{ slug: string; subpath: string }> = [
  { slug: "pierrecomputer/pierre", subpath: "packages/trees" },
  { slug: "pierrecomputer/pierre", subpath: "packages/diffs" },
];

interface FixtureSpec {
  id: string;
  kind: "git" | "local";
  slug?: string;
  // For "git" fixtures, optionally point at a subdirectory of the clone (e.g.
  // a single workspace inside a monorepo). The slug is still used as the
  // clone identifier so multiple subpath fixtures share one clone.
  subpath?: string;
  localPath?: string;
}

interface ManifestEntry {
  slug: string;
  sha: string;
  clonedAt: string;
}

type Manifest = Record<string, ManifestEntry>;

interface V1Diagnostic {
  filePath: string;
  plugin: string;
  rule: string;
  severity: "error" | "warning";
  message: string;
  line: number;
  column: number;
  category: string;
}

interface V1JsonReport {
  schemaVersion: 1;
  ok: boolean;
  diagnostics: V1Diagnostic[];
  summary: { score: number | null; scoreLabel: string | null };
  projects: Array<{ score: { score: number; label: string } | null }>;
  error: { message: string } | null;
}

interface V2Issue {
  id: string;
  severity: "error" | "warning" | "info";
  source?: { checkId: string; pluginName?: string; ruleId?: string };
  location?: { filePath?: string; line?: number; column?: number };
}

interface V2JsonReport {
  schemaVersion: 1;
  ok: boolean;
  issues: V2Issue[];
  summary: { score: number | null; scoreLabel: string | null };
}

interface RunOutcome {
  ok: boolean;
  v1Score: number | null;
  v2RawScore: number | null;
  v1FilteredScore: number;
  v2FilteredScore: number;
  v1DurationMs: number;
  v2DurationMs: number;
  v1RuleKeys: string[];
  v2RuleKeys: string[];
  v1OnlyRules: string[];
  v2OnlyRules: string[];
  missingInV2: Array<{ ruleId: string; file: string; line: number }>;
  extraInV2: Array<{ ruleId: string; file: string; line: number }>;
  v1Error?: string;
  v2Error?: string;
}

const parseArgs = (argv: string[]) => ({
  refresh: argv.includes("--refresh"),
});

const ensureBaseDir = async () => {
  await fsp.mkdir(FIXTURE_BASE, { recursive: true });
};

const readManifest = async (): Promise<Manifest> => {
  try {
    const raw = await fsp.readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return {};
  }
};

const writeManifest = async (manifest: Manifest) => {
  await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
};

const sh = (
  cmd: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, options.timeoutMs)
      : null;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out: ${cmd} ${args.join(" ")}`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });

const cloneRepo = async (slug: string, target: string): Promise<string> => {
  const url = `https://github.com/${slug}.git`;
  const result = await sh(
    "git",
    ["clone", "--depth=1", "--single-branch", "--no-tags", url, target],
    { timeoutMs: 600_000 },
  );
  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone ${slug}: ${result.stderr.slice(0, 500)}`);
  }
  const headResult = await sh("git", ["-C", target, "rev-parse", "HEAD"]);
  return headResult.stdout.trim();
};

// HACK: dedupe concurrent clones so multiple fixtures sharing a slug (e.g.
// `packages/trees` and `packages/diffs` from the same monorepo) share one
// clone instead of racing each other into the same target directory.
const slugClonePromises = new Map<string, Promise<string | null>>();

const cloneSlugOnce = (
  slug: string,
  manifest: Manifest,
  refresh: boolean,
): Promise<string | null> => {
  const cached = slugClonePromises.get(slug);
  if (cached && !refresh) return cached;
  const promise = (async (): Promise<string | null> => {
    const target = path.join(FIXTURE_BASE, slug.replace("/", "__"));
    const exists = fs.existsSync(target);
    if (exists && !refresh) {
      if (!manifest[slug]) {
        try {
          const head = await sh("git", ["-C", target, "rev-parse", "HEAD"]);
          manifest[slug] = {
            slug,
            sha: head.stdout.trim(),
            clonedAt: new Date().toISOString(),
          };
        } catch {
          // ignore
        }
      }
      return target;
    }
    if (exists && refresh) {
      await fsp.rm(target, { recursive: true, force: true });
    }
    try {
      const sha = await cloneRepo(slug, target);
      manifest[slug] = { slug, sha, clonedAt: new Date().toISOString() };
      return target;
    } catch (error) {
      console.error(`[clone] ${slug}: ${(error as Error).message}`);
      return null;
    }
  })();
  slugClonePromises.set(slug, promise);
  return promise;
};

const ensureFixturePath = async (fixture: FixtureSpec, manifest: Manifest, refresh: boolean): Promise<string | null> => {
  if (fixture.kind === "local") {
    if (!fixture.localPath || !fs.existsSync(fixture.localPath)) {
      return null;
    }
    return fixture.localPath;
  }
  const slug = fixture.slug!;
  const clonePath = await cloneSlugOnce(slug, manifest, refresh);
  if (!clonePath) return null;
  if (fixture.subpath) {
    const candidate = path.join(clonePath, fixture.subpath);
    if (!fs.existsSync(candidate)) {
      console.error(`[parity] subpath ${fixture.subpath} missing in ${slug}`);
      return null;
    }
    return candidate;
  }
  return clonePath;
};

// HACK: 20-minute ceiling lets the largest fixtures (ToolJet) finish
// even when the parity pool runs them in parallel against four CPU-bound
// oxlint workers.
const CLI_TIMEOUT_MS = 1_200_000;

const runV2Cli = async (
  cliPath: string,
  directory: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  sh(
    process.execPath,
    [cliPath, directory, "--json", "--json-compact", "--no-dead-code", "--offline"],
    { timeoutMs: CLI_TIMEOUT_MS },
  );

const runV1Cli = async (
  cliPath: string,
  directory: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  sh(
    process.execPath,
    [cliPath, directory, "--json", "--json-compact", "--no-dead-code", "--offline", "--yes"],
    { timeoutMs: CLI_TIMEOUT_MS },
  );

const safeParse = <T>(stdout: string): T | null => {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout) as T;
  } catch {
    // The JSON may be preceded by non-JSON noise from spawned tools;
    // try to locate the last `{` ... `}` block.
    const start = stdout.indexOf("{");
    const end = stdout.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stdout.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
};

const loadV1RuleSurface = async (): Promise<Set<string>> => {
  const source = await fsp.readFile(V1_OXLINT_CONFIG, "utf8");
  const surface = new Set<string>();
  // Match plugin/rule keys inside oxlint rule maps. Captures any key whose
  // value is a severity string (error|warn|off). knip/* rules live in a
  // different module and have no oxlint counterpart in v2 — they're
  // intentionally excluded so dead-code rules don't pollute the diff.
  const re = /["']([a-z][a-zA-Z0-9_-]*\/[a-zA-Z0-9_-]+)["']\s*:\s*["'](?:error|warn|off)["']/g;
  let match: RegExpExecArray | null = re.exec(source);
  while (match !== null) {
    surface.add(match[1]);
    match = re.exec(source);
  }
  return surface;
};

const v1RuleKey = (diagnostic: V1Diagnostic): string => `${diagnostic.plugin}/${diagnostic.rule}`;

const v2RuleKey = (issue: V2Issue): string | null => {
  const source = issue.source;
  if (!source) return null;
  // v2's oxlint runner outputs custom-plugin rules with a parenthesized
  // format like `react-doctor(no-foo)`, which lands in `ruleId` while
  // `pluginName` is the generic "oxlint". Strip the wrapper so the key
  // matches v1's `plugin/rule` form.
  if (source.ruleId) {
    const wrapped = /^([a-zA-Z][\w-]*)\(([^)]+)\)$/.exec(source.ruleId);
    if (wrapped) return `${wrapped[1]}/${wrapped[2]}`;
  }
  if (source.pluginName && source.ruleId) return `${source.pluginName}/${source.ruleId}`;
  return null;
};

const scoreFromIssues = (
  errorKeys: Set<string>,
  warningKeys: Set<string>,
): number => {
  const penalty = errorKeys.size * ERROR_PENALTY + warningKeys.size * WARNING_PENALTY;
  return Math.max(0, Math.round(PERFECT_SCORE - penalty));
};

const collectRuleSets = (
  v1: V1Diagnostic[],
  surface: Set<string>,
): { errors: Set<string>; warnings: Set<string>; keys: Set<string> } => {
  const errors = new Set<string>();
  const warnings = new Set<string>();
  const keys = new Set<string>();
  for (const diagnostic of v1) {
    const key = v1RuleKey(diagnostic);
    if (!surface.has(key)) continue;
    keys.add(key);
    if (diagnostic.severity === "error") errors.add(key);
    else warnings.add(key);
  }
  return { errors, warnings, keys };
};

const collectV2RuleSets = (
  v2: V2Issue[],
  surface: Set<string>,
): { errors: Set<string>; warnings: Set<string>; keys: Set<string>; tuples: Array<{ ruleId: string; file: string; line: number }> } => {
  const errors = new Set<string>();
  const warnings = new Set<string>();
  const keys = new Set<string>();
  const tuples: Array<{ ruleId: string; file: string; line: number }> = [];
  for (const issue of v2) {
    const key = v2RuleKey(issue);
    if (!key) continue;
    if (!surface.has(key)) continue;
    keys.add(key);
    if (issue.severity === "error") errors.add(key);
    else if (issue.severity === "warning") warnings.add(key);
    tuples.push({
      ruleId: key,
      file: issue.location?.filePath ?? "",
      line: issue.location?.line ?? 0,
    });
  }
  return { errors, warnings, keys, tuples };
};

const collectV1Tuples = (
  v1: V1Diagnostic[],
  surface: Set<string>,
): Array<{ ruleId: string; file: string; line: number }> => {
  const tuples: Array<{ ruleId: string; file: string; line: number }> = [];
  for (const diagnostic of v1) {
    const key = v1RuleKey(diagnostic);
    if (!surface.has(key)) continue;
    tuples.push({ ruleId: key, file: diagnostic.filePath, line: diagnostic.line });
  }
  return tuples;
};

const runFixture = async (
  fixture: FixtureSpec,
  fixturePath: string,
  surface: Set<string>,
): Promise<RunOutcome> => {
  const outcome: RunOutcome = {
    ok: false,
    v1Score: null,
    v2RawScore: null,
    v1FilteredScore: PERFECT_SCORE,
    v2FilteredScore: PERFECT_SCORE,
    v1DurationMs: 0,
    v2DurationMs: 0,
    v1RuleKeys: [],
    v2RuleKeys: [],
    v1OnlyRules: [],
    v2OnlyRules: [],
    missingInV2: [],
    extraInV2: [],
  };
  // Wall-clock per CLI: both runs are spawned in parallel below, so each
  // duration reflects how long that CLI ran end-to-end *under concurrent
  // load with the other*, which is what we care about for the parity-grid
  // characterisation. (Running them sequentially would change the timing
  // by removing CPU contention between the two oxlint subprocesses.)
  const v1Start = Date.now();
  const v2Start = Date.now();
  const [v1Run, v2Run] = await Promise.all([
    runV1Cli(V1_CLI, fixturePath)
      .catch((error: Error) => ({
        stdout: "",
        stderr: error.message,
        exitCode: -1,
      }))
      .then((result) => {
        outcome.v1DurationMs = Date.now() - v1Start;
        return result;
      }),
    runV2Cli(V2_CLI, fixturePath)
      .catch((error: Error) => ({
        stdout: "",
        stderr: error.message,
        exitCode: -1,
      }))
      .then((result) => {
        outcome.v2DurationMs = Date.now() - v2Start;
        return result;
      }),
  ]);

  const v1Report = safeParse<V1JsonReport>(v1Run.stdout);
  const v2Report = safeParse<V2JsonReport>(v2Run.stdout);

  // Both CLIs use `ok: false` to signal "any error-severity diagnostic found",
  // not a scan crash. Only treat the run as failed when JSON didn't parse or
  // when the report carries an explicit `error` payload.
  if (!v1Report || v1Report.error) {
    outcome.v1Error =
      v1Report?.error?.message ?? v1Run.stderr.slice(0, 200) ?? `exit ${v1Run.exitCode}`;
  }
  if (!v2Report) {
    outcome.v2Error = v2Run.stderr.slice(0, 200) || `exit ${v2Run.exitCode} (no JSON)`;
  }

  outcome.v1Score = v1Report?.summary?.score ?? null;
  outcome.v2RawScore = v2Report?.summary?.score ?? null;

  if (v1Report && v2Report) {
    const v1Sets = collectRuleSets(v1Report.diagnostics ?? [], surface);
    const v2Sets = collectV2RuleSets(v2Report.issues ?? [], surface);
    outcome.v1FilteredScore = scoreFromIssues(v1Sets.errors, v1Sets.warnings);
    outcome.v2FilteredScore = scoreFromIssues(v2Sets.errors, v2Sets.warnings);
    outcome.v1RuleKeys = [...v1Sets.keys].sort();
    outcome.v2RuleKeys = [...v2Sets.keys].sort();
    outcome.v1OnlyRules = [...v1Sets.keys].filter((key) => !v2Sets.keys.has(key)).sort();
    outcome.v2OnlyRules = [...v2Sets.keys].filter((key) => !v1Sets.keys.has(key)).sort();

    const v1Tuples = collectV1Tuples(v1Report.diagnostics ?? [], surface);
    const v1Triples = new Set(v1Tuples.map((t) => `${t.ruleId}|${t.file}|${t.line}`));
    const v2Triples = new Set(v2Sets.tuples.map((t) => `${t.ruleId}|${t.file}|${t.line}`));

    outcome.missingInV2 = v1Tuples.filter(
      (t) => !v2Triples.has(`${t.ruleId}|${t.file}|${t.line}`),
    );
    outcome.extraInV2 = v2Sets.tuples.filter(
      (t) => !v1Triples.has(`${t.ruleId}|${t.file}|${t.line}`),
    );
    outcome.ok = !outcome.v1Error && !outcome.v2Error;
  }

  return outcome;
};

const runWithPool = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(runners);
  return results;
};

const fixtureLabel = (fixture: FixtureSpec): string => {
  if (fixture.kind === "local") return path.basename(fixture.localPath!);
  return fixture.subpath ? `${fixture.slug!}/${fixture.subpath}` : fixture.slug!;
};

const formatNumber = (value: number | null): string => (value === null ? "—" : String(value));

const buildReport = (
  fixtures: FixtureSpec[],
  outcomes: Array<RunOutcome | null>,
): string => {
  const lines: string[] = [];
  lines.push("# React Doctor v1↔v2 Parity Report");
  lines.push("");
  lines.push(
    `Generated: ${new Date().toISOString()}. CLI flags: \`--json --json-compact --no-dead-code --offline\`.`,
  );
  lines.push("");
  lines.push(
    "v2 issues are filtered to v1's lint rule-ID surface (extracted from `packages/react-doctor/src/oxlint-config.ts`); knip dead-code rules are excluded on both sides.",
  );
  lines.push("");
  lines.push(
    "| Fixture | v1 raw | v1 filt | v2 raw | v2 filt | Δ | v1 time | v2 time | Slowdown | Missing in v2 | Extra in v2 |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");

  let failures = 0;
  const deltas: number[] = [];
  const slowdowns: Array<{ label: string; ratio: number; v1Ms: number; v2Ms: number }> = [];

  const formatDelta = (delta: number): string => {
    if (delta === 0) return "0";
    return delta > 0 ? `+${delta}` : `${delta}`;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    const outcome = outcomes[i];
    const label = fixtureLabel(fixture);
    if (!outcome || !outcome.ok) {
      failures++;
      const v1Err = outcome?.v1Error ?? "skipped";
      const v2Err = outcome?.v2Error ?? "";
      lines.push(
        `| ${label} | — | — | — | — | error | — | — | — | ${v1Err}${v2Err ? " / " + v2Err : ""} | |`,
      );
      continue;
    }
    const delta = outcome.v2FilteredScore - outcome.v1FilteredScore;
    deltas.push(delta);
    const ratio = outcome.v1DurationMs > 0 ? outcome.v2DurationMs / outcome.v1DurationMs : 0;
    slowdowns.push({
      label,
      ratio,
      v1Ms: outcome.v1DurationMs,
      v2Ms: outcome.v2DurationMs,
    });
    lines.push(
      `| ${label} | ${formatNumber(outcome.v1Score)} | ${outcome.v1FilteredScore} | ${formatNumber(outcome.v2RawScore)} | ${outcome.v2FilteredScore} | ${formatDelta(delta)} | ${formatDuration(outcome.v1DurationMs)} | ${formatDuration(outcome.v2DurationMs)} | ${ratio.toFixed(2)}× | ${outcome.missingInV2.length} | ${outcome.extraInV2.length} |`,
    );
  }

  lines.push("");
  // Bucket the absolute deltas. Small drifts (|Δ| ≤ 2) are almost always
  // pedantic-rule or single-rule recalibrations and don't indicate a
  // regression; |Δ| > 5 is the band worth investigating individually.
  const within = (limit: number) => deltas.filter((delta) => Math.abs(delta) <= limit).length;
  const exactMatches = within(0);
  const within1 = within(1);
  const within2 = within(2);
  const within5 = within(5);
  const over5 = deltas.length - within5;
  const maxAbsDelta = deltas.reduce((acc, delta) => Math.max(acc, Math.abs(delta)), 0);
  const meanAbsDelta =
    deltas.length === 0
      ? 0
      : deltas.reduce((acc, delta) => acc + Math.abs(delta), 0) / deltas.length;
  lines.push(`**Score divergence from v1** (Δ = v2 filtered − v1 filtered, across ${deltas.length} fixtures):`);
  lines.push("");
  lines.push("| Bucket | Count |");
  lines.push("|---|---:|");
  lines.push(`| Δ = 0 (exact match) | ${exactMatches} |`);
  lines.push(`| \\|Δ\\| ≤ 1 | ${within1} |`);
  lines.push(`| \\|Δ\\| ≤ 2 | ${within2} |`);
  lines.push(`| \\|Δ\\| ≤ 5 | ${within5} |`);
  lines.push(`| \\|Δ\\| > 5 | ${over5} |`);
  lines.push(`| max \\|Δ\\| | ${maxAbsDelta} |`);
  lines.push(`| mean \\|Δ\\| | ${meanAbsDelta.toFixed(2)} |`);
  if (failures > 0) lines.push(`| errored | ${failures} |`);
  lines.push("");

  if (slowdowns.length > 0) {
    const ratios = slowdowns.map((entry) => entry.ratio).filter((ratio) => ratio > 0);
    const within = (limit: number) => ratios.filter((ratio) => ratio <= limit).length;
    const meanRatio =
      ratios.length === 0 ? 0 : ratios.reduce((acc, ratio) => acc + ratio, 0) / ratios.length;
    const maxRatio = ratios.reduce((acc, ratio) => Math.max(acc, ratio), 0);
    const sortedRatios = [...ratios].sort((a, b) => a - b);
    const medianRatio =
      sortedRatios.length === 0
        ? 0
        : sortedRatios[Math.floor(sortedRatios.length / 2)] ?? 0;
    const topSlow = [...slowdowns].sort((a, b) => b.ratio - a.ratio).slice(0, 5);
    lines.push(
      `**Wall-clock slowdown** (v2 / v1, across ${ratios.length} fixtures; both CLIs spawned in parallel so the ratio reflects relative cost under shared load, not absolute):`,
    );
    lines.push("");
    lines.push("| Bucket | Count |");
    lines.push("|---|---:|");
    lines.push(`| ≤ 1.0× (v2 ≤ v1) | ${within(1)} |`);
    lines.push(`| ≤ 1.5× | ${within(1.5)} |`);
    lines.push(`| ≤ 2.0× | ${within(2)} |`);
    lines.push(`| ≤ 3.0× | ${within(3)} |`);
    lines.push(`| > 3.0× | ${ratios.length - within(3)} |`);
    lines.push(`| median | ${medianRatio.toFixed(2)}× |`);
    lines.push(`| mean | ${meanRatio.toFixed(2)}× |`);
    lines.push(`| max | ${maxRatio.toFixed(2)}× |`);
    lines.push("");
    lines.push("Top 5 slowest fixtures (by v2/v1 ratio):");
    lines.push("");
    for (const entry of topSlow) {
      lines.push(
        `- ${entry.label}: ${formatDuration(entry.v1Ms)} → ${formatDuration(entry.v2Ms)} (${entry.ratio.toFixed(2)}×)`,
      );
    }
    lines.push("");
  }
  lines.push("## Per-fixture rule deltas");
  lines.push("");

  // Cross-fixture: count how often each unique rule is "only in v1" or "only in v2".
  // These are the rules that actually drive score divergence (the (file,line) tuples
  // for shared rules cancel out in the v1-formula scoring).
  const v1OnlyFrequency = new Map<string, string[]>();
  const v2OnlyFrequency = new Map<string, string[]>();

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    const outcome = outcomes[i];
    if (!outcome || !outcome.ok) continue;
    if (outcome.v1FilteredScore === outcome.v2FilteredScore && outcome.missingInV2.length === 0 && outcome.extraInV2.length === 0) {
      continue;
    }
    const label = fixtureLabel(fixture);
    lines.push(`### ${label}`);
    lines.push("");
    lines.push(`- v1 filtered score: **${outcome.v1FilteredScore}** vs v2 filtered: **${outcome.v2FilteredScore}**`);
    if (outcome.v1OnlyRules.length > 0) {
      lines.push(`- Unique rules in v1 only (drive v2's higher score):`);
      for (const rule of outcome.v1OnlyRules) {
        lines.push(`  - \`${rule}\``);
        const existing = v1OnlyFrequency.get(rule) ?? [];
        existing.push(label);
        v1OnlyFrequency.set(rule, existing);
      }
    }
    if (outcome.v2OnlyRules.length > 0) {
      lines.push(`- Unique rules in v2 only (drive v1's higher score):`);
      for (const rule of outcome.v2OnlyRules) {
        lines.push(`  - \`${rule}\``);
        const existing = v2OnlyFrequency.get(rule) ?? [];
        existing.push(label);
        v2OnlyFrequency.set(rule, existing);
      }
    }
    if (outcome.missingInV2.length > 0) {
      const byRule = new Map<string, number>();
      for (const tuple of outcome.missingInV2) {
        byRule.set(tuple.ruleId, (byRule.get(tuple.ruleId) ?? 0) + 1);
      }
      const top = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
      lines.push("- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):");
      for (const [rule, count] of top) {
        lines.push(`  - \`${rule}\` × ${count}`);
      }
    }
    if (outcome.extraInV2.length > 0) {
      const byRule = new Map<string, number>();
      for (const tuple of outcome.extraInV2) {
        byRule.set(tuple.ruleId, (byRule.get(tuple.ruleId) ?? 0) + 1);
      }
      const top = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
      lines.push("- Extra in v2 by (file, line) tuple (sampled):");
      for (const [rule, count] of top) {
        lines.push(`  - \`${rule}\` × ${count}`);
      }
    }
    lines.push("");
  }

  lines.push("## Cross-fixture unique-rule rollup");
  lines.push("");
  lines.push("Each rule below is one that fires on at least one fixture in one version but not the other. These are the rules whose alignment would close the score-parity gap.");
  lines.push("");
  if (v1OnlyFrequency.size > 0) {
    lines.push("### Rules firing in v1 but not v2 (sorted by fixture count)");
    lines.push("");
    const sorted = [...v1OnlyFrequency.entries()].sort((a, b) => b[1].length - a[1].length);
    lines.push("| Rule | Fixtures | Where |");
    lines.push("|---|---:|---|");
    for (const [rule, fixturesHit] of sorted) {
      lines.push(`| \`${rule}\` | ${fixturesHit.length} | ${fixturesHit.join(", ")} |`);
    }
    lines.push("");
  }
  if (v2OnlyFrequency.size > 0) {
    lines.push("### Rules firing in v2 but not v1 (sorted by fixture count)");
    lines.push("");
    const sorted = [...v2OnlyFrequency.entries()].sort((a, b) => b[1].length - a[1].length);
    lines.push("| Rule | Fixtures | Where |");
    lines.push("|---|---:|---|");
    for (const [rule, fixturesHit] of sorted) {
      lines.push(`| \`${rule}\` | ${fixturesHit.length} | ${fixturesHit.join(", ")} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(V1_CLI)) {
    throw new Error(`v1 CLI not built at ${V1_CLI}. Run \`pnpm -F react-doctor build\` first.`);
  }
  if (!fs.existsSync(V2_CLI)) {
    throw new Error(`v2 CLI not built at ${V2_CLI}. Run \`pnpm -F react-doctor-v2 build\` first.`);
  }

  await ensureBaseDir();
  const manifest = await readManifest();
  const surface = await loadV1RuleSurface();
  console.log(`[parity] v1 rule surface: ${surface.size} keys`);

  const fixtures: FixtureSpec[] = [
    ...LEADERBOARD_REPOS.map((slug) => ({ id: slug, kind: "git" as const, slug })),
    ...ECOSYSTEM_REPOS.map((slug) => ({ id: slug, kind: "git" as const, slug })),
    ...MONOREPO_SUBPATH_FIXTURES.map(({ slug, subpath }) => ({
      id: `${slug}/${subpath}`,
      kind: "git" as const,
      slug,
      subpath,
    })),
    ...LOCAL_FIXTURES.map((localPath) => ({
      id: path.basename(localPath),
      kind: "local" as const,
      localPath,
    })),
  ];

  console.log(`[parity] preparing ${fixtures.length} fixtures (concurrency ${CONCURRENCY})`);

  const paths = await Promise.all(
    fixtures.map(async (fixture) => {
      try {
        return await ensureFixturePath(fixture, manifest, args.refresh);
      } catch (error) {
        console.error(`[parity] prepare ${fixture.id}: ${(error as Error).message}`);
        return null;
      }
    }),
  );
  await writeManifest(manifest);

  const startTime = Date.now();
  const outcomes = await runWithPool(
    fixtures,
    async (fixture, index) => {
      const fixturePath = paths[index];
      if (!fixturePath) {
        console.log(`[parity] skip ${fixture.id} (no path)`);
        return null;
      }
      console.log(`[parity] running ${fixture.id}`);
      try {
        const outcome = await runFixture(fixture, fixturePath, surface);
        let verdict: string;
        if (!outcome.ok) {
          verdict = "error";
        } else {
          const delta = outcome.v2FilteredScore - outcome.v1FilteredScore;
          const deltaLabel = delta === 0 ? "Δ=0" : delta > 0 ? `Δ=+${delta}` : `Δ=${delta}`;
          verdict = `v1=${outcome.v1FilteredScore} v2=${outcome.v2FilteredScore} ${deltaLabel}`;
        }
        console.log(`[parity] done   ${fixture.id} → ${verdict}`);
        return outcome;
      } catch (error) {
        console.error(`[parity] crash  ${fixture.id}: ${(error as Error).message}`);
        return null;
      }
    },
    CONCURRENCY,
  );

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[parity] all done in ${elapsed}s`);

  const report = buildReport(fixtures, outcomes);
  await fsp.writeFile(REPORT_PATH, `${report}\n`);
  console.log(`[parity] wrote ${REPORT_PATH}`);
};

await main();
