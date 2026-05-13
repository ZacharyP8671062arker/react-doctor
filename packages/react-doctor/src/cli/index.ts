import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Command } from "commander";
import {
  CANONICAL_GITHUB_URL,
  DEFAULT_DIRECTORY,
  EXIT_FAILURE_CODE,
  FILESYSTEM_WALK_IGNORED_DIRECTORIES,
  FRAMEWORK_DISPLAY_NAMES,
  MAX_CATEGORY_GROUPS_SHOWN_NON_VERBOSE,
  MAX_INLINE_SUB_RULES_SHOWN,
  MAX_RULE_GROUPS_PER_CATEGORY_NON_VERBOSE,
  MAX_SCORE_DRAINS_SHOWN,
  PER_CATEGORY_PENALTY_CAP,
  PERFECT_SCORE,
  REACT_PROJECT_DEPENDENCIES,
  SEVERITY_ORDER,
  SHARE_BASE_URL,
  SIGINT_EXIT_CODE,
  SOURCE_FILE_PATTERN,
} from "../constants.js";
import { handleCliError } from "./handle-error.js";
import { highlighter } from "./highlighter.js";
import { printReactReviewCta, printScoreHeader } from "./render-score-header.js";
import { selectProjects } from "./select-projects.js";
import type { DiscoveredProject } from "./select-projects.js";
import { getStagedSourceFiles, materializeStagedFiles } from "./get-staged-files.js";
import { getDiffInfo, filterSourceFiles, type DiffInfo } from "./get-diff-files.js";
import { prompts } from "./prompts.js";
import { createProgressSpinner } from "./utils/create-progress-spinner.js";
import { formatElapsedTime } from "./utils/format-elapsed-time.js";
import {
  buildReactDoctorJsonReport,
  createReactDoctor,
  loadReactDoctorConfig,
  resolveConfigRootDirectory,
} from "../sdk/index.js";
import { createCodebaseAnalysisConfig } from "../core/rules/codebase/analyzer/config.js";
import { discoverWorkspaces } from "../core/rules/codebase/analyzer/workspace.js";
import { collectScoreDiagnostics } from "../core/issue-to-score-diagnostic.js";
import { calculateScoreBreakdown, rulePenalty } from "../core/score.js";
import { getScoringPluginKey, getScoringRuleKey } from "../core/scoring-key.js";
import type {
  ReactDoctorConfig,
  ReactDoctorFailOnLevel,
  ReactDoctorIssue,
  ReactDoctorResult,
} from "../sdk/index.js";
import type { WorkspaceInfo } from "../core/rules/codebase/analyzer/index.js";

const VERSION = process.env.VERSION ?? "0.0.0";

interface CliFlags {
  json: boolean;
  jsonCompact: boolean;
  lint: boolean;
  deadCode: boolean;
  verbose: boolean;
  customRulesOnly: boolean;
  staged: boolean;
  unstaged: boolean;
  changed: boolean;
  diff?: boolean | string;
  offline: boolean;
  failOn: string;
  project?: string;
  yes: boolean;
  score: boolean;
  full: boolean;
  annotations: boolean;
  respectInlineDisables: boolean;
  explain?: string;
  why?: string;
}

// HACK: env vars that mean "user is not at an interactive shell." We use this
// to skip prompts but NOT to auto-flip --offline, because dev shells often
// have JENKINS_URL / TF_BUILD set as ambient config without actually running
// in CI.
const NON_INTERACTIVE_ENVIRONMENT_VARIABLES = [
  "CI",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "BUILDKITE",
  "JENKINS_URL",
  "TF_BUILD",
  "CODEBUILD_BUILD_ID",
  "TEAMCITY_VERSION",
  "BITBUCKET_BUILD_NUMBER",
  "CIRCLECI",
  "TRAVIS",
  "DRONE",
  "CLAUDECODE",
  "CLAUDE_CODE",
  "CURSOR_AGENT",
  "CODEX_CI",
  "OPENCODE",
  "AMP_HOME",
];

// HACK: only flip --offline by default for the narrowest set of CI signals
// where we're confident the run is automated and a share URL would be useless.
const CI_ENVIRONMENT_VARIABLES = ["GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI"];

const isNonInteractiveEnvironment = (): boolean =>
  NON_INTERACTIVE_ENVIRONMENT_VARIABLES.some((envVariable) => Boolean(process.env[envVariable]));

const isCiEnvironment = (): boolean =>
  CI_ENVIRONMENT_VARIABLES.some((envVariable) => Boolean(process.env[envVariable])) ||
  process.env.CI === "true";

const isSourceFile = (filePath: string): boolean => SOURCE_FILE_PATTERN.test(filePath);

const isReactWorkspace = (workspace: WorkspaceInfo): boolean =>
  [...REACT_PROJECT_DEPENDENCIES].some((dependencyName) =>
    workspace.dependencyNames.has(dependencyName),
  );

interface FilesystemPackageManifest {
  name?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
}

const isFilesystemPackageManifest = (value: unknown): value is FilesystemPackageManifest =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsePackageManifest = (manifestText: string): FilesystemPackageManifest | null => {
  try {
    const parsed: unknown = JSON.parse(manifestText);
    return isFilesystemPackageManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const hasReactDependencyInManifest = (manifest: FilesystemPackageManifest): boolean => {
  for (const bucket of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ]) {
    if (!bucket) continue;
    for (const dependencyName of REACT_PROJECT_DEPENDENCIES) {
      if (dependencyName in bucket) return true;
    }
  }
  return false;
};

const discoverReactProjectsByFilesystem = async (rootDirectory: string): Promise<string[]> => {
  const directories: string[] = [];
  const pending: string[] = [rootDirectory];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) continue;

    try {
      const manifestText = await fs.readFile(path.join(current, "package.json"), "utf8");
      const manifest = parsePackageManifest(manifestText);
      if (manifest && hasReactDependencyInManifest(manifest)) {
        directories.push(current);
      }
    } catch {
      // No package.json or unreadable — keep walking.
    }

    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith(".") ||
        FILESYSTEM_WALK_IGNORED_DIRECTORIES.has(entry.name)
      ) {
        continue;
      }
      pending.push(path.join(current, entry.name));
    }
  }

  return directories.sort((first, second) => first.localeCompare(second));
};

const toNamedProject = (workspace: WorkspaceInfo): DiscoveredProject => ({
  name: workspace.name ?? path.basename(workspace.directory),
  directory: workspace.directory,
});

const toNamedProjectFromDirectory = async (directory: string): Promise<DiscoveredProject> => {
  try {
    const manifestText = await fs.readFile(path.join(directory, "package.json"), "utf8");
    const manifest = parsePackageManifest(manifestText);
    const manifestName = typeof manifest?.name === "string" ? manifest.name : null;
    return { name: manifestName ?? path.basename(directory), directory };
  } catch {
    return { name: path.basename(directory), directory };
  }
};

const discoverProjects = async (
  rootDirectory: string,
  configHasRootDirectory: boolean,
  shouldUseSingleProject: boolean,
): Promise<DiscoveredProject[]> => {
  if (configHasRootDirectory || shouldUseSingleProject) {
    return [await toNamedProjectFromDirectory(rootDirectory)];
  }
  const workspaces = await discoverWorkspaces(createCodebaseAnalysisConfig({ rootDirectory }));
  const reactWorkspaces = workspaces.filter(isReactWorkspace);
  if (reactWorkspaces.length > 1) {
    return reactWorkspaces.map(toNamedProject);
  }
  if (reactWorkspaces.length === 1) {
    const onlyWorkspace = reactWorkspaces[0];
    if (onlyWorkspace.directory !== rootDirectory) return [toNamedProject(onlyWorkspace)];
  }
  const filesystemDirectories = await discoverReactProjectsByFilesystem(rootDirectory);
  if (filesystemDirectories.length > 0) {
    return Promise.all(filesystemDirectories.map(toNamedProjectFromDirectory));
  }
  if (reactWorkspaces.length === 1) return [toNamedProject(reactWorkspaces[0])];
  return [await toNamedProjectFromDirectory(rootDirectory)];
};

const getGitFiles = (rootDirectory: string, args: string[]): string[] => {
  const result = spawnSync("git", args, {
    cwd: rootDirectory,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) return [];
  return result.stdout
    .split("\0")
    .map((filePath) => filePath.trim())
    .filter((filePath) => filePath.length > 0 && isSourceFile(filePath));
};

const dedupeFilePaths = (filePaths: string[]): string[] => [...new Set(filePaths)];

const resolveIncludePaths = (rootDirectory: string, flags: CliFlags): string[] | undefined => {
  if (flags.unstaged) {
    return dedupeFilePaths([
      ...getGitFiles(rootDirectory, [
        "diff",
        "--name-only",
        "-z",
        "--diff-filter=ACMR",
        "--relative",
      ]),
      ...getGitFiles(rootDirectory, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
        "--relative",
      ]),
    ]);
  }
  if (flags.changed) {
    return dedupeFilePaths([
      ...getGitFiles(rootDirectory, [
        "diff",
        "--name-only",
        "-z",
        "--diff-filter=ACMR",
        "--relative",
        "HEAD",
      ]),
      ...getGitFiles(rootDirectory, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
        "--relative",
      ]),
    ]);
  }
  return undefined;
};

const isActiveChangedFileMode = (flags: CliFlags, isDiffMode: boolean): boolean =>
  flags.staged || flags.unstaged || flags.changed || isDiffMode;

const resolveProjectIncludePaths = (
  rootDirectory: string,
  projectDirectory: string,
  includePaths: string[] | undefined,
): string[] | undefined => {
  if (includePaths === undefined) return undefined;
  return includePaths
    .map((includePath) => path.resolve(rootDirectory, includePath))
    .filter((absolutePath) => {
      const relativePath = path.relative(projectDirectory, absolutePath);
      return (
        relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
      );
    })
    .map((absolutePath) => path.relative(projectDirectory, absolutePath).split(path.sep).join("/"))
    .filter((includePath) => includePath.length > 0);
};

const getCliOptionOverride = <Value>(
  command: Command,
  optionName: string,
  value: Value,
): Value | undefined => (command.getOptionValueSource(optionName) === "cli" ? value : undefined);

const resolveBooleanInspectOption = (
  command: Command,
  optionName: string,
  flagValue: boolean,
  configValue: boolean | undefined,
  defaultValue: boolean,
): boolean => {
  const cliValue = getCliOptionOverride(command, optionName, flagValue);
  if (cliValue !== undefined) return cliValue;
  if (configValue !== undefined) return configValue;
  return defaultValue;
};

const normalizeFailOnLevel = (value: string | undefined): ReactDoctorFailOnLevel => {
  if (value === "error" || value === "warning" || value === "none") return value;
  console.error(
    `[react-doctor] Invalid failOn level "${value}". Expected: error, warning, none. Falling back to "error".`,
  );
  return "error";
};

const shouldFailForIssues = (
  issues: ReactDoctorIssue[],
  failOnLevel: ReactDoctorFailOnLevel,
): boolean => {
  if (failOnLevel === "none") return false;
  if (failOnLevel === "warning") {
    return issues.some((issue) => issue.severity === "error" || issue.severity === "warning");
  }
  return issues.some((issue) => issue.severity === "error");
};

const getWorstScoreValue = (results: ReactDoctorResult[]): number => {
  const scores = results
    .map((result) => result.score)
    .filter((score): score is NonNullable<typeof score> => score !== null);
  return scores.length > 0 ? Math.min(...scores.map((score) => score.value)) : PERFECT_SCORE;
};

// Mirror how the score collapses custom checks: dead-code, dependencies,
// react-architecture, ... all emit many sub-ruleIds under one rule
// definition for display clarity, so they should render as ONE row.
const getRuleGroupKey = (issue: ReactDoctorIssue): string => getScoringRuleKey(issue);

interface SubRuleCount {
  title: string;
  count: number;
}

interface RuleGroup {
  groupKey: string;
  issues: ReactDoctorIssue[];
  subRuleCounts: SubRuleCount[];
}

const groupIssuesByRule = (issues: ReactDoctorIssue[]): RuleGroup[] => {
  const groups = new Map<string, ReactDoctorIssue[]>();
  for (const issue of issues) {
    const groupKey = getRuleGroupKey(issue);
    const ruleIssues = groups.get(groupKey) ?? [];
    ruleIssues.push(issue);
    groups.set(groupKey, ruleIssues);
  }
  return [...groups.entries()].map(([groupKey, groupIssues]) => {
    const subRuleCountMap = new Map<string, number>();
    for (const issue of groupIssues) {
      subRuleCountMap.set(issue.title, (subRuleCountMap.get(issue.title) ?? 0) + 1);
    }
    const subRuleCounts = [...subRuleCountMap.entries()]
      .map(([title, count]) => ({ title, count }))
      .toSorted((first, second) => second.count - first.count);
    return { groupKey, issues: groupIssues, subRuleCounts };
  });
};

const getRuleGroupDisplayTitle = (
  ruleGroup: RuleGroup,
  checkNameByCheckId: ReadonlyMap<string, string>,
): string => {
  if (ruleGroup.subRuleCounts.length === 1) return ruleGroup.subRuleCounts[0].title;
  const checkName = checkNameByCheckId.get(ruleGroup.groupKey);
  return checkName ?? ruleGroup.groupKey;
};

const formatSubRuleBreakdown = (subRuleCounts: SubRuleCount[]): string => {
  const visible = subRuleCounts.slice(0, MAX_INLINE_SUB_RULES_SHOWN);
  const remaining = subRuleCounts.length - visible.length;
  const inlineParts = visible.map(({ title, count }) => `${title} ×${count}`);
  if (remaining > 0) inlineParts.push(`+${remaining} more`);
  return inlineParts.join(", ");
};

interface CategoryGroup {
  category: string;
  issues: ReactDoctorIssue[];
  ruleGroups: RuleGroup[];
}

const buildCategoryGroups = (issues: ReactDoctorIssue[]): CategoryGroup[] => {
  const categoryMap = new Map<string, ReactDoctorIssue[]>();
  for (const issue of issues) {
    const categoryIssues = categoryMap.get(issue.category) ?? [];
    categoryIssues.push(issue);
    categoryMap.set(issue.category, categoryIssues);
  }
  return [...categoryMap.entries()]
    .map(([category, categoryIssues]) => {
      const ruleGroups = groupIssuesByRule(categoryIssues).toSorted((groupA, groupB) => {
        const severityDelta =
          (SEVERITY_ORDER[groupA.issues[0].severity] ?? 2) -
          (SEVERITY_ORDER[groupB.issues[0].severity] ?? 2);
        if (severityDelta !== 0) return severityDelta;
        return groupB.issues.length - groupA.issues.length;
      });
      return { category, issues: categoryIssues, ruleGroups };
    })
    .toSorted((groupA, groupB) => {
      const worstA = Math.min(...groupA.issues.map((issue) => SEVERITY_ORDER[issue.severity] ?? 2));
      const worstB = Math.min(...groupB.issues.map((issue) => SEVERITY_ORDER[issue.severity] ?? 2));
      if (worstA !== worstB) return worstA - worstB;
      if (groupA.issues.length !== groupB.issues.length) {
        return groupB.issues.length - groupA.issues.length;
      }
      return groupA.category.localeCompare(groupB.category);
    });
};

const buildCheckNameLookup = (
  result: ReactDoctorResult | ReactDoctorResult[],
): ReadonlyMap<string, string> => {
  const lookup = new Map<string, string>();
  const results = Array.isArray(result) ? result : [result];
  for (const innerResult of results) {
    for (const check of innerResult.checks) {
      lookup.set(check.id, check.name);
    }
  }
  return lookup;
};

const encodeAnnotationProperty = (value: string): string =>
  value
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");

const encodeAnnotationMessage = (value: string): string =>
  value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

const printAnnotations = (issues: ReactDoctorIssue[], routeToStderr: boolean): void => {
  const writeLine = routeToStderr
    ? (line: string) => process.stderr.write(`${line}\n`)
    : (line: string) => process.stdout.write(`${line}\n`);
  for (const issue of issues) {
    const level = issue.severity === "error" ? "error" : "warning";
    const title = issue.title;
    const filePath = issue.location?.filePath ?? "";
    const fileSegment = `file=${encodeAnnotationProperty(filePath)}`;
    const lineSegment = issue.location?.line ? `,line=${issue.location.line}` : "";
    const titleSegment = `,title=${encodeAnnotationProperty(title)}`;
    const message = encodeAnnotationMessage(issue.message);
    writeLine(`::${level} ${fileSegment}${lineSegment}${titleSegment}::${message}`);
  }
};

const formatFrameworkName = (framework: string): string =>
  FRAMEWORK_DISPLAY_NAMES[framework] ?? framework;

const printProjectDetection = (result: ReactDoctorResult): void => {
  const projectInfo = result.project;
  const frameworkLabel = formatFrameworkName(projectInfo.framework);
  const languageLabel = projectInfo.hasTypeScript ? "TypeScript" : "JavaScript";

  const completedStep = (message: string) => {
    console.log(`  ${highlighter.success("✔")} ${message}`);
  };

  completedStep(`Detecting framework. Found ${highlighter.info(frameworkLabel)}.`);
  if (projectInfo.reactVersion) {
    completedStep(
      `Detecting React version. Found ${highlighter.info(`React ${projectInfo.reactVersion}`)}.`,
    );
  }
  completedStep(
    `Detecting Tailwind. ${
      projectInfo.tailwindVersion
        ? `Found ${highlighter.info(`Tailwind ${projectInfo.tailwindVersion}`)}.`
        : "Not found."
    }`,
  );
  completedStep(`Detecting language. Found ${highlighter.info(languageLabel)}.`);
  completedStep(
    `Detecting React Compiler. ${projectInfo.hasReactCompiler ? highlighter.info("Found React Compiler.") : "Not found."}`,
  );
  completedStep(`Found ${highlighter.info(`${projectInfo.sourceFileCount}`)} source files.`);

  for (const check of result.checks) {
    if (check.status === "completed") {
      completedStep(`${check.name}.`);
    } else if (check.status === "failed") {
      console.log(`  ${highlighter.error("✗")} ${check.name} failed (non-fatal, skipping).`);
    }
  }

  console.log("");
};

const printDefaultIssueGroup = (
  ruleGroup: RuleGroup,
  checkNameByCheckId: ReadonlyMap<string, string>,
): void => {
  const firstIssue = ruleGroup.issues[0];
  const marker = firstIssue.severity === "error" ? highlighter.error("✗") : highlighter.warn("⚠");
  const siteCountBadge =
    ruleGroup.issues.length > 1 ? ` ${highlighter.gray(`×${ruleGroup.issues.length}`)}` : "";
  const displayTitle = getRuleGroupDisplayTitle(ruleGroup, checkNameByCheckId);
  console.log(`  ${marker} ${displayTitle}${siteCountBadge}`);

  if (ruleGroup.subRuleCounts.length > 1) {
    console.log(`    ${highlighter.gray(formatSubRuleBreakdown(ruleGroup.subRuleCounts))}`);
  } else {
    console.log(`    ${highlighter.gray(firstIssue.message)}`);
    if (firstIssue.recommendation) {
      console.log(`    ${highlighter.gray(firstIssue.recommendation)}`);
    }
  }

  const firstLocation = ruleGroup.issues.find((issue) => issue.location?.line);
  if (firstLocation?.location) {
    const locationPath = firstLocation.location.filePath ?? "";
    const line = firstLocation.location.line ? `:${firstLocation.location.line}` : "";
    console.log(`    ${highlighter.gray(`${locationPath}${line}`)}`);
  }
};

const printVerboseIssueGroup = (
  ruleGroup: RuleGroup,
  checkNameByCheckId: ReadonlyMap<string, string>,
): void => {
  const firstIssue = ruleGroup.issues[0];
  const marker = firstIssue.severity === "error" ? highlighter.error("✗") : highlighter.warn("⚠");
  const siteCountBadge =
    ruleGroup.issues.length > 1 ? ` ${highlighter.gray(`×${ruleGroup.issues.length}`)}` : "";
  const displayTitle = getRuleGroupDisplayTitle(ruleGroup, checkNameByCheckId);
  console.log(`  ${marker} ${displayTitle}${siteCountBadge}`);

  if (ruleGroup.subRuleCounts.length > 1) {
    console.log(`      ${highlighter.gray(formatSubRuleBreakdown(ruleGroup.subRuleCounts))}`);
  } else {
    console.log(`      ${highlighter.gray(firstIssue.message)}`);
    if (firstIssue.recommendation) {
      console.log(`      ${highlighter.gray(`→ ${firstIssue.recommendation}`)}`);
    }
  }

  for (const issue of ruleGroup.issues) {
    if (issue.location?.filePath && issue.location?.line) {
      console.log(`      ${highlighter.gray(`${issue.location.filePath}:${issue.location.line}`)}`);
    }
  }
};

const printIssueSections = (
  issues: ReactDoctorIssue[],
  isVerbose: boolean,
  checkNameByCheckId: ReadonlyMap<string, string>,
): void => {
  const categoryGroups = buildCategoryGroups(issues);

  if (isVerbose) {
    for (const categoryGroup of categoryGroups) {
      const issueCount = `${categoryGroup.issues.length} ${categoryGroup.issues.length === 1 ? "issue" : "issues"}`;
      console.log(`${highlighter.bold(categoryGroup.category)} ${highlighter.dim(issueCount)}`);
      for (const ruleGroup of categoryGroup.ruleGroups) {
        printVerboseIssueGroup(ruleGroup, checkNameByCheckId);
      }
      console.log("");
    }
    return;
  }

  const visibleCategoryGroups = categoryGroups.slice(0, MAX_CATEGORY_GROUPS_SHOWN_NON_VERBOSE);
  const hiddenCategoryGroups = categoryGroups.slice(MAX_CATEGORY_GROUPS_SHOWN_NON_VERBOSE);
  const hiddenRuleGroups: RuleGroup[] = [];

  for (const categoryGroup of visibleCategoryGroups) {
    const visibleRuleGroups = categoryGroup.ruleGroups.slice(
      0,
      MAX_RULE_GROUPS_PER_CATEGORY_NON_VERBOSE,
    );
    const remainingRuleGroups = categoryGroup.ruleGroups.slice(
      MAX_RULE_GROUPS_PER_CATEGORY_NON_VERBOSE,
    );
    const issueCount = `${categoryGroup.issues.length} ${categoryGroup.issues.length === 1 ? "issue" : "issues"}`;
    console.log(`${highlighter.bold(categoryGroup.category)} ${highlighter.dim(issueCount)}`);
    for (const ruleGroup of visibleRuleGroups) {
      printDefaultIssueGroup(ruleGroup, checkNameByCheckId);
    }
    console.log("");
    hiddenRuleGroups.push(...remainingRuleGroups);
  }

  hiddenRuleGroups.push(
    ...hiddenCategoryGroups.flatMap((categoryGroup) => categoryGroup.ruleGroups),
  );

  if (hiddenRuleGroups.length > 0) {
    const hiddenIssueCount = hiddenRuleGroups.reduce(
      (total, ruleGroup) => total + ruleGroup.issues.length,
      0,
    );
    const hiddenRuleCount = hiddenRuleGroups.length;
    console.log(
      `  ${highlighter.dim(`… and ${hiddenRuleCount} more rules (${hiddenIssueCount} issues). Run \`npx react-doctor@latest . --verbose\` for all details.`)}`,
    );
    console.log("");
  }
};

const collectAffectedFiles = (issues: ReactDoctorIssue[]): Set<string> =>
  new Set(issues.flatMap((issue) => (issue.location?.filePath ? [issue.location.filePath] : [])));

const printCountsSummaryLine = (
  issues: ReactDoctorIssue[],
  totalSourceFileCount: number,
  elapsedMilliseconds: number,
): void => {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const affectedFileCount = collectAffectedFiles(issues).size;
  const totalIssueCount = issues.length;
  const elapsedTimeLabel = formatElapsedTime(elapsedMilliseconds);

  const issueCountColor =
    errorCount > 0 ? highlighter.error : warningCount > 0 ? highlighter.warn : highlighter.dim;
  const issueCountText = `${totalIssueCount} ${totalIssueCount === 1 ? "issue" : "issues"}`;
  const fileCountText =
    totalSourceFileCount > 0
      ? `across ${affectedFileCount}/${totalSourceFileCount} files`
      : `across ${affectedFileCount} file${affectedFileCount === 1 ? "" : "s"}`;
  const elapsedTimeText = `in ${elapsedTimeLabel}`;

  console.log(
    `  ${issueCountColor(issueCountText)} ${highlighter.dim(`${fileCountText}  ${elapsedTimeText}`)}`,
  );
};

const buildShareUrl = (
  issues: ReactDoctorIssue[],
  score: number | null,
  projectName: string,
): string => {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const affectedFileCount = collectAffectedFiles(issues).size;

  const params = new URLSearchParams();
  params.set("p", projectName);
  if (score !== null) params.set("s", String(score));
  if (errorCount > 0) params.set("e", String(errorCount));
  if (warningCount > 0) params.set("w", String(warningCount));
  if (affectedFileCount > 0) params.set("f", String(affectedFileCount));

  return `${SHARE_BASE_URL}?${params.toString()}`;
};

const writeDiagnosticsDirectory = (issues: ReactDoctorIssue[]): string | null => {
  try {
    const diagnosticsDirectory = path.join(tmpdir(), `react-doctor-diagnostics-${Date.now()}`);
    mkdirSync(diagnosticsDirectory, { recursive: true });
    writeFileSync(
      path.join(diagnosticsDirectory, "diagnostics.json"),
      JSON.stringify(issues, null, 2),
    );
    return diagnosticsDirectory;
  } catch {
    return null;
  }
};

interface ScoreDrain {
  ruleKey: string;
  category: string;
  severity: "error" | "warning";
  count: number;
  penalty: number;
  displayTitle: string;
}

const collectScoreDrains = (
  issues: ReactDoctorIssue[],
  checkNameByCheckId: ReadonlyMap<string, string>,
): ScoreDrain[] => {
  const aggregates = new Map<
    string,
    {
      category: string;
      severity: "error" | "warning";
      count: number;
      displayTitle: string;
    }
  >();
  for (const issue of issues) {
    if (issue.severity === "info") continue;
    const scoringRuleKey = getScoringRuleKey(issue);
    const ruleKey = `${getScoringPluginKey(issue)}/${scoringRuleKey}`;
    const severity: "error" | "warning" = issue.severity === "error" ? "error" : "warning";
    const existing = aggregates.get(ruleKey);
    if (existing) {
      existing.count += 1;
      if (severity === "error") existing.severity = "error";
      continue;
    }
    // For collapsed custom checks (scoring key = checkId) prefer the
    // human-readable check name; for per-rule scoring (oxlint) prefer the
    // issue's own title so each rule is independently identifiable.
    const isCollapsedCheck = issue.source?.checkId === scoringRuleKey;
    const displayTitle = isCollapsedCheck
      ? (checkNameByCheckId.get(scoringRuleKey) ?? issue.title ?? ruleKey)
      : (issue.title ?? scoringRuleKey);
    aggregates.set(ruleKey, {
      category: issue.category,
      severity,
      count: 1,
      displayTitle,
    });
  }
  return [...aggregates.entries()]
    .map(([ruleKey, aggregate]) => ({
      ruleKey,
      category: aggregate.category,
      severity: aggregate.severity,
      count: aggregate.count,
      penalty: rulePenalty(aggregate.severity, aggregate.count),
      displayTitle: aggregate.displayTitle,
    }))
    .toSorted((first, second) => second.penalty - first.penalty);
};

const printVerboseScoreBreakdown = (
  issues: ReactDoctorIssue[],
  score: number,
  checkNameByCheckId: ReadonlyMap<string, string>,
): void => {
  const breakdown = calculateScoreBreakdown(collectScoreDiagnostics(issues));
  const drains = collectScoreDrains(issues, checkNameByCheckId);

  console.log("");
  console.log(highlighter.bold("  Score breakdown"));
  console.log(
    highlighter.dim(
      `    Final: ${score} / ${PERFECT_SCORE}  |  raw penalty ${breakdown.totalRawPenalty.toFixed(
        1,
      )}, capped to ${breakdown.totalCappedPenalty.toFixed(1)} (per-category cap ${PER_CATEGORY_PENALTY_CAP})`,
    ),
  );

  if (breakdown.perCategory.length > 0) {
    console.log("");
    console.log(highlighter.bold("  By category"));
    for (const categoryBreakdown of breakdown.perCategory) {
      const cappedNote =
        categoryBreakdown.rawPenalty > categoryBreakdown.cappedPenalty
          ? highlighter.warn(` (capped from ${categoryBreakdown.rawPenalty.toFixed(1)})`)
          : "";
      console.log(
        `    ${highlighter.gray(
          `-${categoryBreakdown.cappedPenalty.toFixed(1).padStart(5, " ")}`,
        )}  ${categoryBreakdown.category}  ${highlighter.dim(
          `(${categoryBreakdown.ruleKeys} rule${categoryBreakdown.ruleKeys === 1 ? "" : "s"})`,
        )}${cappedNote}`,
      );
    }
  }

  if (drains.length > 0) {
    console.log("");
    console.log(highlighter.bold("  Top score drains"));
    for (const drain of drains.slice(0, MAX_SCORE_DRAINS_SHOWN)) {
      const marker = drain.severity === "error" ? highlighter.error("✗") : highlighter.warn("⚠");
      console.log(
        `    ${highlighter.gray(`-${drain.penalty.toFixed(1).padStart(4, " ")}`)}  ${marker} ${
          drain.displayTitle
        }  ${highlighter.dim(`(${drain.count} issue${drain.count === 1 ? "" : "s"})`)}`,
      );
    }
    if (drains.length > MAX_SCORE_DRAINS_SHOWN) {
      console.log(
        highlighter.dim(
          `    … and ${drains.length - MAX_SCORE_DRAINS_SHOWN} more rule${
            drains.length - MAX_SCORE_DRAINS_SHOWN === 1 ? "" : "s"
          } contributing penalty`,
        ),
      );
    }
  }
};

const printProjectHeader = (result: ReactDoctorResult): void => {
  console.log(
    `${highlighter.bold(result.project.projectName)} ${highlighter.dim(result.project.rootDirectory)}`,
  );
  console.log("");
};

const printResultScoreBlock = (result: ReactDoctorResult): void => {
  const scoreValue = result.score?.value ?? PERFECT_SCORE;
  const scoreLabel = result.score?.label ?? "Great";
  printScoreHeader(scoreValue, scoreLabel);
};

const printSkippedChecksWarning = (result: ReactDoctorResult): void => {
  const failedChecks = result.checks
    .filter((check) => check.status === "failed" || check.status === "skipped")
    .map((check) => check.name);
  if (failedChecks.length > 0) {
    const skippedLabel = failedChecks.join(" and ");
    console.log(
      `  ${highlighter.warn(`Note: ${skippedLabel} checks failed — score may be incomplete.`)}`,
    );
    console.log("");
  }
};

const printInspectionResult = (
  result: ReactDoctorResult,
  flags: CliFlags,
  isOffline: boolean,
): void => {
  if (flags.json) {
    const report = buildReactDoctorJsonReport(result);
    process.stdout.write(
      `${flags.jsonCompact ? JSON.stringify(report) : JSON.stringify(report, null, 2)}\n`,
    );
    return;
  }

  printProjectHeader(result);
  printProjectDetection(result);

  if (result.issues.length === 0) {
    console.log(`${highlighter.success("✔")} No React Doctor issues found.`);
    console.log("");
    printResultScoreBlock(result);
    printSkippedChecksWarning(result);
    printReactReviewCta();
    return;
  }

  printIssueSections(result.issues, flags.verbose, buildCheckNameLookup(result));

  printResultScoreBlock(result);
  printCountsSummaryLine(
    result.issues,
    result.project.sourceFileCount,
    result.durationMilliseconds,
  );

  const diagnosticsDirectory = writeDiagnosticsDirectory(result.issues);
  if (diagnosticsDirectory) {
    console.log(highlighter.gray(`  Full diagnostics written to ${diagnosticsDirectory}`));
  }

  if (!isOffline) {
    console.log("");
    const shareUrl = buildShareUrl(
      result.issues,
      result.score?.value ?? null,
      result.project.projectName,
    );
    console.log(`  ${highlighter.bold("→ Share your results:")} ${highlighter.info(shareUrl)}`);
  }

  if (flags.verbose && result.score && result.issues.length > 0) {
    printVerboseScoreBreakdown(result.issues, result.score.value, buildCheckNameLookup(result));
  }

  printSkippedChecksWarning(result);
  console.log("");
  printReactReviewCta();
};

const toAggregateJsonReport = (results: ReactDoctorResult[]) => {
  const reports = results.map(buildReactDoctorJsonReport);
  const issues = results.flatMap((result) => result.issues);
  const checks = results.flatMap((result) => result.checks);
  const affectedFiles = new Set(
    issues.flatMap((issue) => (issue.location?.filePath ? [issue.location.filePath] : [])),
  );
  const scores = results
    .map((result) => result.score?.value)
    .filter((score): score is number => typeof score === "number");
  const worstScore = scores.length ? Math.min(...scores) : null;
  const worstScoreLabel =
    results.find((result) => result.score?.value === worstScore)?.score?.label ?? null;
  return {
    schemaVersion: 1,
    ok: reports.every((report) => report.ok),
    projects: reports.map((report) => ({
      project: report.project,
      issues: report.issues,
      checks: report.checks,
      summary: report.summary,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      durationMilliseconds: report.durationMilliseconds,
    })),
    issues,
    checks,
    summary: {
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      affectedFileCount: affectedFiles.size,
      totalIssueCount: issues.length,
      score: worstScore,
      scoreLabel: worstScoreLabel,
    },
    startedAt: results[0]?.startedAt,
    completedAt: results.at(-1)?.completedAt,
    durationMilliseconds: results.reduce((total, result) => total + result.durationMilliseconds, 0),
  };
};

const printInspectionResults = (
  results: ReactDoctorResult[],
  flags: CliFlags,
  isOffline: boolean,
): void => {
  if (results.length === 1) {
    printInspectionResult(results[0], flags, isOffline);
    return;
  }
  if (flags.json) {
    const report = toAggregateJsonReport(results);
    process.stdout.write(
      `${flags.jsonCompact ? JSON.stringify(report) : JSON.stringify(report, null, 2)}\n`,
    );
    return;
  }

  for (const result of results) {
    printProjectHeader(result);
    printProjectDetection(result);
    if (result.issues.length === 0) {
      console.log(`${highlighter.success("✔")} No React Doctor issues found.`);
      console.log("");
    } else {
      printIssueSections(result.issues, flags.verbose, buildCheckNameLookup(result));
    }
    printResultScoreBlock(result);
    if (result.issues.length > 0) {
      printCountsSummaryLine(
        result.issues,
        result.project.sourceFileCount,
        result.durationMilliseconds,
      );
      console.log("");
    }
    if (flags.verbose && result.score && result.issues.length > 0) {
      printVerboseScoreBreakdown(result.issues, result.score.value, buildCheckNameLookup(result));
    }
    printSkippedChecksWarning(result);
  }

  const allIssues = results.flatMap((result) => result.issues);

  if (allIssues.length > 0) {
    const diagnosticsDirectory = writeDiagnosticsDirectory(allIssues);
    if (diagnosticsDirectory) {
      console.log(highlighter.gray(`  Full diagnostics written to ${diagnosticsDirectory}`));
    }
  }

  if (!isOffline) {
    const scores = results
      .map((result) => result.score?.value)
      .filter((score): score is number => typeof score === "number");
    const worstScore = scores.length ? Math.min(...scores) : null;
    const shareUrl = buildShareUrl(allIssues, worstScore, results[0]?.project.projectName ?? "");
    console.log(`  ${highlighter.bold("→ Share your results:")} ${highlighter.info(shareUrl)}`);
    console.log("");
  }

  printReactReviewCta();
};

// --- Signal + error handling ---

let isJsonModeActive = false;
let isCompactJsonOutput = false;
let resolvedDirectoryForCancel: string | null = null;
let cancelStartTime = 0;
const pendingCleanups = new Set<() => void>();

const registerPendingCleanup = (cleanup: () => void): (() => void) => {
  pendingCleanups.add(cleanup);
  return () => {
    pendingCleanups.delete(cleanup);
  };
};

const runPendingCleanups = (): void => {
  for (const cleanup of pendingCleanups) {
    try {
      cleanup();
    } catch {
      // Best-effort cleanup during shutdown.
    }
  }
  pendingCleanups.clear();
};

const writeJsonErrorReport = (error: unknown, directory: string, elapsed: number): void => {
  const errorMessage = error instanceof Error ? error.message || error.name : String(error);
  const errorName = error instanceof Error ? error.name : "Error";
  const report = {
    schemaVersion: 1,
    ok: false,
    projects: [],
    issues: [],
    checks: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      affectedFileCount: 0,
      totalIssueCount: 0,
      score: null,
      scoreLabel: null,
    },
    error: { message: errorMessage, name: errorName },
    directory,
    durationMilliseconds: elapsed,
  };
  const serialized = isCompactJsonOutput ? JSON.stringify(report) : JSON.stringify(report, null, 2);
  process.stdout.write(`${serialized}\n`);
};

const exitGracefully = () => {
  runPendingCleanups();
  if (isJsonModeActive) {
    writeJsonErrorReport(
      new Error("Scan cancelled by user (SIGINT/SIGTERM)"),
      resolvedDirectoryForCancel ?? process.cwd(),
      performance.now() - cancelStartTime,
    );
    process.exit(SIGINT_EXIT_CODE);
  }
  console.log("");
  console.log("Cancelled.");
  console.log("");
  process.exit(SIGINT_EXIT_CODE);
};

process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

// HACK: when stdout is piped into a process that closes early (e.g.
// `react-doctor . | head`), Node throws an uncaught EPIPE on the next
// write. Exit cleanly instead of dumping a stack trace.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(0);
});

// --- Mode validation ---

const coerceDiffValue = (value: unknown): boolean | string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length === 0) return undefined;
    if (value === "false") return false;
    if (value === "true") return true;
    return value;
  }
  process.stderr.write(
    `[react-doctor] invalid diff value (expected boolean or string): ${typeof value}. Falling back to no diff.\n`,
  );
  return undefined;
};

const validateModeFlags = (flags: CliFlags): void => {
  const coercedDiff = coerceDiffValue(flags.diff);
  const exclusiveModes = [
    flags.staged ? "--staged" : null,
    flags.unstaged ? "--unstaged" : null,
    flags.changed ? "--changed" : null,
    coercedDiff !== undefined && coercedDiff !== false ? "--diff" : null,
  ].filter((modeName): modeName is string => modeName !== null);

  if (exclusiveModes.length > 1) {
    throw new Error(`Cannot combine ${exclusiveModes.join(" and ")}; pick one mode.`);
  }
  if (flags.yes && flags.full) {
    throw new Error("Cannot combine --yes and --full; pick one.");
  }
  if (flags.score && flags.json) {
    throw new Error("Cannot combine --score and --json; pick one output mode.");
  }
  if (flags.annotations && (flags.json || flags.score)) {
    throw new Error("--annotations cannot be combined with --json or --score.");
  }
  if (flags.explain !== undefined && flags.why !== undefined) {
    throw new Error("Use --explain or --why, not both — they're aliases of the same flag.");
  }
  const explainArgument = flags.explain ?? flags.why;
  if (
    explainArgument !== undefined &&
    (flags.json || flags.score || flags.annotations || flags.staged)
  ) {
    throw new Error(
      "--explain cannot be combined with --json, --score, --annotations, or --staged.",
    );
  }
};

// --- Diff mode prompt ---

const resolveDiffMode = async (
  diffInfo: DiffInfo | null,
  effectiveDiff: boolean | string | undefined,
  shouldSkipPrompts: boolean,
  isQuiet: boolean,
): Promise<boolean> => {
  if (effectiveDiff !== undefined && effectiveDiff !== false) {
    if (diffInfo) return true;
    if (!isQuiet) {
      console.log(
        highlighter.warn("No feature branch or uncommitted changes detected. Running full scan."),
      );
      console.log("");
    }
    return false;
  }

  if (effectiveDiff === false || !diffInfo) return false;

  const changedSourceFiles = filterSourceFiles(diffInfo.changedFiles);
  if (changedSourceFiles.length === 0) return false;
  if (shouldSkipPrompts) return false;
  if (isQuiet) return false;

  const promptMessage = diffInfo.isCurrentChanges
    ? `Found ${changedSourceFiles.length} uncommitted changed files. Only scan those?`
    : `On branch ${diffInfo.currentBranch} (${changedSourceFiles.length} files changed vs ${diffInfo.baseBranch}). Only scan changed files?`;

  const { shouldScanChangedOnly } = await prompts({
    type: "confirm",
    name: "shouldScanChangedOnly",
    message: promptMessage,
    initial: true,
  });
  return Boolean(shouldScanChangedOnly);
};

// --- Explain mode ---

const parseFileLineArgument = (argument: string): { filePath: string; line: number } => {
  const lastColonIndex = argument.lastIndexOf(":");
  if (lastColonIndex === -1) {
    throw new Error(`Expected file:line format, got "${argument}".`);
  }
  const filePath = path.resolve(argument.slice(0, lastColonIndex));
  const line = Number.parseInt(argument.slice(lastColonIndex + 1), 10);
  if (Number.isNaN(line) || line <= 0) {
    throw new Error(`Invalid line number in "${argument}".`);
  }
  return { filePath, line };
};

const runExplain = async (
  fileLineArgument: string,
  rootDirectory: string,
  config: ReactDoctorConfig,
  projectFlag: string | undefined,
): Promise<void> => {
  const { filePath, line } = parseFileLineArgument(fileLineArgument);

  let targetDirectory = rootDirectory;
  if (projectFlag) {
    const discoveredProjects = await discoverProjects(rootDirectory, false, false);
    const matched = await selectProjects(
      discoveredProjects,
      rootDirectory,
      projectFlag,
      true,
      true,
    );
    if (matched.length === 0) {
      throw new Error(`--project resolved to no projects. Cannot run --explain.`);
    }
    if (matched.length > 1) {
      throw new Error(
        `--explain takes a single project; --project resolved to ${matched.length} projects.`,
      );
    }
    targetDirectory = matched[0];
  }

  const result = await createReactDoctor({
    rootDirectory: targetDirectory,
  }).inspect({
    offline: true,
    lint: true,
    deadCode: true,
    config,
  });

  const matchingIssues = result.issues.filter(
    (issue) =>
      issue.location?.line === line &&
      issue.location?.filePath &&
      path.resolve(targetDirectory, issue.location.filePath) === filePath,
  );

  if (matchingIssues.length === 0) {
    console.log(`No react-doctor diagnostics at ${filePath}:${line}.`);
    return;
  }

  for (const issue of matchingIssues) {
    const severitySymbol = issue.severity === "error" ? "✗" : "⚠";
    const colorizeRule = issue.severity === "error" ? highlighter.error : highlighter.warn;
    const severityLabel = colorizeRule(issue.severity);
    console.log(
      `${severitySymbol} ${colorizeRule(issue.title)} ${highlighter.dim(`(${severityLabel})`)} — ${issue.message}`,
    );
    if (issue.category) console.log(highlighter.dim(`  Category: ${issue.category}`));
    if (issue.recommendation) console.log(highlighter.dim(`  ${issue.recommendation}`));
    console.log(
      highlighter.dim(
        "  Add a react-doctor-disable-next-line comment immediately above this line to suppress.",
      ),
    );
    console.log("");
  }
};

// --- Install subcommand ---

const runInstall = async (installOptions: { yes?: boolean; dryRun?: boolean }): Promise<void> => {
  let agentInstall: typeof import("agent-install");
  try {
    agentInstall = await import("agent-install");
  } catch (error) {
    const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : "";
    console.error(
      highlighter.error(
        `Failed to load the bundled "agent-install" module${causeMessage}. Please open an issue at ${CANONICAL_GITHUB_URL}/issues with this output.`,
      ),
    );
    process.exitCode = EXIT_FAILURE_CODE;
    return;
  }

  const {
    installSkillsFromSource,
    SKILL_MANIFEST_FILE,
    getSkillAgentTypes,
    detectInstalledSkillAgents,
  } = agentInstall;
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");

  const distDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceDir = path.join(distDirectory, "skills", "react-doctor");

  if (!existsSync(path.join(sourceDir, SKILL_MANIFEST_FILE))) {
    console.error(
      highlighter.error("Could not locate the react-doctor skill bundled with this package."),
    );
    process.exitCode = EXIT_FAILURE_CODE;
    return;
  }

  const detectedAgents = await detectInstalledSkillAgents();
  if (detectedAgents.length === 0) {
    console.error(highlighter.error("No supported coding agents detected."));
    console.error(
      highlighter.dim(
        "  Looked for config dirs in $HOME (~/.claude, ~/.cursor, ~/.codex, ~/.gemini, ...).",
      ),
    );
    process.exitCode = EXIT_FAILURE_CODE;
    return;
  }

  const skipPrompts = Boolean(installOptions.yes) || !process.stdin.isTTY;
  const allAgentTypes = getSkillAgentTypes().filter(
    (agent) => agent !== "universal" && detectedAgents.includes(agent),
  );

  const selectedAgents = skipPrompts
    ? allAgentTypes
    : ((
        await prompts({
          type: "multiselect",
          name: "agents",
          message: `Install the ${highlighter.info("react-doctor")} skill for:`,
          choices: allAgentTypes.map((agent) => ({
            title: String(agent),
            value: agent,
            selected: true,
          })),
          instructions: false,
          min: 1,
        })
      ).agents ?? []);

  if (selectedAgents.length === 0) return;

  if (installOptions.dryRun) {
    console.log("Dry run — would install react-doctor skill for:");
    for (const agent of selectedAgents) {
      console.log(highlighter.dim(`  - ${String(agent)}`));
    }
    console.log(highlighter.dim(`  Source: ${sourceDir}`));
    return;
  }

  console.log("Installing react-doctor skill...");
  const installResult = await installSkillsFromSource({
    source: sourceDir,
    agents: selectedAgents,
    cwd: process.cwd(),
    mode: "copy",
  });

  if (installResult.failed?.length > 0) {
    console.error(highlighter.error("Some installations failed:"));
    for (const failure of installResult.failed) {
      console.error(highlighter.error(`  ${failure.agent}: ${failure.error}`));
    }
    process.exitCode = EXIT_FAILURE_CODE;
    return;
  }

  console.log(
    `${highlighter.success("✔")} react-doctor skill installed for ${selectedAgents.join(", ")}.`,
  );
};

// --- Main CLI ---

const program = new Command()
  .name("react-doctor")
  .description("Diagnose React codebase health")
  .version(VERSION, "-v, --version", "display the version number")
  .argument("[directory]", "project directory to scan", DEFAULT_DIRECTORY)
  .option("--lint", "enable linting")
  .option("--no-lint", "skip oxlint checks")
  .option("--dead-code", "enable dead code detection")
  .option("--no-dead-code", "skip codebase graph checks")
  .option("--verbose", "show every rule and per-file details (default shows top 3 rules)")
  .option("--custom-rules-only", "run only react-doctor custom oxlint rules")
  .option("--staged", "only inspect staged source files (materializes git index snapshot)")
  .option("--unstaged", "only inspect unstaged and untracked source files")
  .option("--changed", "only inspect source files changed since HEAD")
  .option(
    "--diff [base]",
    "scan only files changed vs base branch (pass `false` to disable; overridden by --full)",
  )
  .option("--json", "output a single structured JSON report (suppresses other output)")
  .option("--json-compact", "with --json, emit compact JSON (no indentation)")
  .option("--offline", "skip telemetry (anonymous, not stored, only used to calculate score)")
  .option("--project <name>", "select workspace project (comma-separated for multiple)")
  .option("-y, --yes", "skip prompts, scan all workspace projects")
  .option("--score", "output only the score")
  .option("--full", "force a full scan (overrides any `diff` value in config or `--diff`)")
  .option("--annotations", "output diagnostics as GitHub Actions annotations")
  .option("--fail-on <level>", "exit with error code on diagnostics: error, warning, none", "error")
  .option("--explain <file:line>", "diagnose why a rule fired at a specific location")
  .option("--why <file:line>", "alias for --explain")
  .option(
    "--respect-inline-disables",
    "respect inline `// eslint-disable*` / `// oxlint-disable*` comments (default)",
  )
  .option(
    "--no-respect-inline-disables",
    "audit mode: neutralize inline lint suppressions before scanning",
  )
  .action(async (directory: string, flags: CliFlags, command: Command) => {
    const isScoreOnly = flags.score;
    const isJsonMode = flags.json;
    const isQuiet = isScoreOnly || isJsonMode;
    const rootDirectory = path.resolve(directory);
    const jsonStartTime = performance.now();

    isJsonModeActive = isJsonMode;
    isCompactJsonOutput = Boolean(flags.jsonCompact);
    resolvedDirectoryForCancel = rootDirectory;
    cancelStartTime = jsonStartTime;

    try {
      validateModeFlags(flags);

      const loadedConfig = await loadReactDoctorConfig(rootDirectory);
      const config: ReactDoctorConfig = loadedConfig?.config ?? {};
      const scanRootDirectory = await resolveConfigRootDirectory(loadedConfig, rootDirectory);
      resolvedDirectoryForCancel = scanRootDirectory;

      const explainArgument = flags.explain ?? flags.why;
      if (explainArgument !== undefined) {
        await runExplain(explainArgument, scanRootDirectory, config, flags.project);
        return;
      }

      if (!isQuiet) {
        console.log(`react-doctor ${highlighter.dim(`v${VERSION}`)}`);
        console.log("");
      }

      if (!flags.offline && isCiEnvironment() && !isQuiet) {
        console.log(highlighter.dim("CI detected — scoring locally."));
        console.log("");
      }

      const configuredDiff = flags.full
        ? false
        : command.getOptionValueSource("diff") === "cli"
          ? flags.diff
          : (config.diff ?? flags.diff);
      const effectiveFlags: CliFlags = {
        ...flags,
        verbose:
          command.getOptionValueSource("verbose") === "cli"
            ? Boolean(flags.verbose)
            : Boolean(config.verbose ?? flags.verbose),
        diff: coerceDiffValue(configuredDiff),
      };

      const failOn =
        command.getOptionValueSource("failOn") === "cli"
          ? normalizeFailOnLevel(flags.failOn)
          : normalizeFailOnLevel(config.failOn ?? flags.failOn);

      const shouldSkipPrompts =
        flags.yes ||
        flags.full ||
        isJsonMode ||
        isNonInteractiveEnvironment() ||
        !process.stdin.isTTY;

      const isOffline = flags.offline || (config.offline ?? false) || isCiEnvironment();

      // --- Staged mode with materialization ---
      if (effectiveFlags.staged) {
        const stagedFiles = getStagedSourceFiles(scanRootDirectory);
        if (stagedFiles.length === 0) {
          if (isJsonMode) {
            const emptyReport = {
              schemaVersion: 1,
              ok: true,
              projects: [],
              issues: [],
              checks: [],
              summary: {
                errorCount: 0,
                warningCount: 0,
                affectedFileCount: 0,
                totalIssueCount: 0,
                score: null,
                scoreLabel: null,
              },
              mode: "staged",
              durationMilliseconds: performance.now() - jsonStartTime,
            };
            process.stdout.write(
              `${flags.jsonCompact ? JSON.stringify(emptyReport) : JSON.stringify(emptyReport, null, 2)}\n`,
            );
          } else if (!isScoreOnly) {
            console.log(highlighter.dim("No staged source files found."));
          }
          return;
        }

        const stagedFileLabel = `${stagedFiles.length} staged ${stagedFiles.length === 1 ? "file" : "files"}`;
        const stagedSpinner = !isQuiet
          ? createProgressSpinner(`Analyzing ${highlighter.info(stagedFileLabel)}`)
          : null;

        let tempDirectory: string | null = null;
        let cleanupSnapshot: (() => void) | null = null;
        let unregisterCleanup: (() => void) | null = null;
        try {
          tempDirectory = mkdtempSync(path.join(tmpdir(), "react-doctor-staged-"));
          const snapshot = materializeStagedFiles(scanRootDirectory, stagedFiles, tempDirectory);
          cleanupSnapshot = snapshot.cleanup;
          unregisterCleanup = registerPendingCleanup(snapshot.cleanup);

          const stagedInspectOptions = {
            lint: resolveBooleanInspectOption(command, "lint", flags.lint, config.lint, true),
            deadCode: false,
            customRulesOnly: resolveBooleanInspectOption(
              command,
              "customRulesOnly",
              flags.customRulesOnly,
              config.customRulesOnly,
              false,
            ),
            offline: isOffline,
            respectInlineDisables: resolveBooleanInspectOption(
              command,
              "respectInlineDisables",
              flags.respectInlineDisables,
              config.respectInlineDisables,
              true,
            ),
            silentLogs: isQuiet,
            config,
            loadedConfig,
          };

          const snapshotProjects = await discoverProjects(
            snapshot.tempDirectory,
            Boolean(config.rootDir),
            false,
          );
          const stagedProjectDirectories = snapshotProjects
            .map((project) => project.directory)
            .filter(
              (projectDirectory) =>
                resolveProjectIncludePaths(
                  snapshot.tempDirectory,
                  projectDirectory,
                  snapshot.stagedFiles,
                )?.length !== 0,
            );
          const projectDirectories =
            stagedProjectDirectories.length > 0
              ? stagedProjectDirectories
              : [snapshot.tempDirectory];

          const results = await Promise.all(
            projectDirectories.map(async (projectDirectory) => {
              const projectIncludePaths = resolveProjectIncludePaths(
                snapshot.tempDirectory,
                projectDirectory,
                snapshot.stagedFiles,
              );
              const result = await createReactDoctor({
                rootDirectory: projectDirectory,
                includePaths: projectIncludePaths,
              }).inspect(stagedInspectOptions);
              const projectRelativePath = path.relative(snapshot.tempDirectory, projectDirectory);
              const originalProjectRoot = path.resolve(scanRootDirectory, projectRelativePath);
              return {
                ...result,
                project: { ...result.project, rootDirectory: originalProjectRoot },
              };
            }),
          );

          stagedSpinner?.stop();

          const allIssues = results.flatMap((result) => result.issues);

          if (flags.score) {
            console.log(String(getWorstScoreValue(results)));
          } else {
            printInspectionResults(results, effectiveFlags, isOffline);
          }

          if (flags.annotations) {
            printAnnotations(allIssues, isJsonMode);
          }

          if (shouldFailForIssues(allIssues, failOn)) {
            process.exitCode = EXIT_FAILURE_CODE;
          }
        } finally {
          stagedSpinner?.stop();
          unregisterCleanup?.();
          cleanupSnapshot?.();
        }
        return;
      }

      // --- Diff mode with interactive prompt ---
      const effectiveDiff = coerceDiffValue(effectiveFlags.diff);
      const explicitBaseBranch = typeof effectiveDiff === "string" ? effectiveDiff : undefined;
      const wantsDiffMode = effectiveDiff !== undefined && effectiveDiff !== false;
      const shouldDetectDiff = wantsDiffMode || (!shouldSkipPrompts && !isQuiet);
      const diffInfo = shouldDetectDiff ? getDiffInfo(scanRootDirectory, explicitBaseBranch) : null;
      const isDiffMode = await resolveDiffMode(diffInfo, effectiveDiff, shouldSkipPrompts, isQuiet);

      let includePaths: string[] | undefined;
      if (isDiffMode && diffInfo) {
        includePaths = filterSourceFiles(diffInfo.changedFiles);
        if (!isQuiet) {
          if (diffInfo.isCurrentChanges) {
            console.log("Scanning uncommitted changes");
          } else {
            console.log(
              `Scanning changes: ${highlighter.info(diffInfo.currentBranch)} → ${highlighter.info(diffInfo.baseBranch)}`,
            );
          }
          console.log("");
        }
      } else if (!effectiveFlags.staged) {
        // When --diff was requested but diff detection failed, we already
        // told the user "Running full scan" — so suppress the diff flag here
        // to avoid resolveIncludePaths invoking a doomed git command that
        // returns [] and silently scans nothing.
        const includePathsFlags: CliFlags =
          wantsDiffMode && !isDiffMode ? { ...effectiveFlags, diff: false } : effectiveFlags;
        includePaths = resolveIncludePaths(scanRootDirectory, includePathsFlags);
      }

      const shouldSkipSourceChecks =
        isActiveChangedFileMode(effectiveFlags, isDiffMode) && includePaths?.length === 0;

      const discoveredProjects = await discoverProjects(
        scanRootDirectory,
        Boolean(config.rootDir),
        shouldSkipSourceChecks,
      );
      const projectDirectories = await selectProjects(
        discoveredProjects,
        scanRootDirectory,
        flags.project,
        shouldSkipPrompts,
        isQuiet,
      );

      const inspectOptions = {
        lint: shouldSkipSourceChecks
          ? false
          : resolveBooleanInspectOption(command, "lint", flags.lint, config.lint, true),
        deadCode:
          shouldSkipSourceChecks || isActiveChangedFileMode(effectiveFlags, isDiffMode)
            ? false
            : resolveBooleanInspectOption(
                command,
                "deadCode",
                flags.deadCode,
                config.deadCode,
                true,
              ),
        customRulesOnly: resolveBooleanInspectOption(
          command,
          "customRulesOnly",
          flags.customRulesOnly,
          config.customRulesOnly,
          false,
        ),
        offline: isOffline,
        respectInlineDisables: resolveBooleanInspectOption(
          command,
          "respectInlineDisables",
          flags.respectInlineDisables,
          config.respectInlineDisables,
          true,
        ),
        silentLogs: isQuiet,
        config,
        loadedConfig,
      };

      const selectedProjectNames = projectDirectories.map((projectDirectory) => {
        const matchedProject = discoveredProjects.find(
          (project) => project.directory === projectDirectory,
        );
        return matchedProject?.name ?? path.basename(projectDirectory);
      });
      const scanSpinnerLabel =
        selectedProjectNames.length === 1
          ? `Analyzing ${highlighter.info(selectedProjectNames[0])}`
          : `Analyzing ${highlighter.info(`${selectedProjectNames.length} projects`)}`;
      const scanSpinner = !isQuiet ? createProgressSpinner(scanSpinnerLabel) : null;

      let results: ReactDoctorResult[];
      try {
        results = await Promise.all(
          projectDirectories.map((projectDirectory) => {
            const projectIncludePaths = shouldSkipSourceChecks
              ? undefined
              : resolveProjectIncludePaths(scanRootDirectory, projectDirectory, includePaths);
            const shouldSkipProjectSourceChecks =
              isActiveChangedFileMode(effectiveFlags, isDiffMode) &&
              projectIncludePaths?.length === 0;
            return createReactDoctor({
              rootDirectory: projectDirectory,
              includePaths: shouldSkipProjectSourceChecks ? undefined : projectIncludePaths,
            }).inspect({
              ...inspectOptions,
              lint: shouldSkipProjectSourceChecks ? false : inspectOptions.lint,
              deadCode: shouldSkipProjectSourceChecks ? false : inspectOptions.deadCode,
            });
          }),
        );
      } finally {
        scanSpinner?.stop();
      }

      const allIssues = results.flatMap((result) => result.issues);

      if (flags.annotations) {
        printAnnotations(allIssues, isJsonMode);
      }

      if (flags.score) {
        console.log(String(getWorstScoreValue(results)));
      } else {
        printInspectionResults(results, effectiveFlags, isOffline);
      }

      if (shouldFailForIssues(allIssues, failOn)) {
        process.exitCode = EXIT_FAILURE_CODE;
      }
    } catch (error) {
      if (isJsonModeActive) {
        writeJsonErrorReport(
          error,
          resolvedDirectoryForCancel ?? rootDirectory,
          performance.now() - jsonStartTime,
        );
        process.exitCode = EXIT_FAILURE_CODE;
        return;
      }
      handleCliError(error);
    }
  })
  .addHelpText(
    "after",
    `
${highlighter.dim("Configuration:")}
  Place a ${highlighter.info("react-doctor.config.json")} (or ${highlighter.info('"reactDoctor"')} key in your package.json) in the project root.
  CLI flags always override config values. See the README for the full schema.

${highlighter.dim("Learn more:")}
  ${highlighter.info(CANONICAL_GITHUB_URL)}
`,
  );

program
  .command("install")
  .description("Install the react-doctor skill into your coding agents")
  .option("-y, --yes", "skip prompts, install for all detected agents")
  .option("--dry-run", "show what would be installed without writing files")
  .action(async (options: { yes?: boolean; dryRun?: boolean }) => {
    try {
      await runInstall(options);
    } catch (error) {
      handleCliError(error);
    }
  });

program.parseAsync().catch((error: unknown) => {
  if (isJsonModeActive) {
    try {
      writeJsonErrorReport(
        error,
        resolvedDirectoryForCancel ?? process.cwd(),
        performance.now() - cancelStartTime,
      );
    } catch {
      process.stdout.write(
        '{"schemaVersion":1,"ok":false,"error":{"message":"Internal error","name":"Error"}}\n',
      );
    }
    process.exit(1);
  }
  handleCliError(error);
});
