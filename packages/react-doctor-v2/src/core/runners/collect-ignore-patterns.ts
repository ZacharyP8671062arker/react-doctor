import fs from "node:fs";
import path from "node:path";

const IGNORE_FILENAMES = [".eslintignore", ".oxlintignore", ".prettierignore"];
const LINGUIST_ATTRIBUTE_PATTERN = /^linguist-(?:vendored|generated)(?:=([a-zA-Z0-9]+))?$/i;
const FALSY_LINGUIST_VALUES = new Set(["false", "0", "off", "no"]);

const stripGitignoreEscape = (pattern: string): string => {
  if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) return pattern.slice(1);
  return pattern;
};

const readIgnoreFile = (filePath: string): string[] => {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  const patterns: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    patterns.push(stripGitignoreEscape(trimmed));
  }
  return patterns;
};

const isTruthyLinguistAttribute = (token: string): boolean => {
  const match = LINGUIST_ATTRIBUTE_PATTERN.exec(token);
  if (!match) return false;
  if (match[1] === undefined) return true;
  return !FALSY_LINGUIST_VALUES.has(match[1].toLowerCase());
};

const parseGitattributesLinguistPaths = (filePath: string): string[] => {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  const paths: string[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;
    const [pathSpec, ...attributes] = tokens;
    if (attributes.some(isTruthyLinguistAttribute)) paths.push(pathSpec);
  }
  return paths;
};

// HACK: when an ignore file lives at an ancestor directory, its patterns are
// anchored at the ancestor — but oxlint runs from `rootDirectory`. Translate
// each pattern so that:
//   - non-path, non-anchored patterns (e.g. `node_modules`, `.DS_Store`) pass
//     through unchanged because gitignore semantics already match them anywhere
//   - path-bearing patterns scoped to `rootDirectory`'s subtree get their
//     `<relPath>/` prefix stripped (e.g. `apps/studio/public` → `public` when
//     scanning `apps/studio`)
//   - path-bearing patterns OUTSIDE `rootDirectory`'s subtree get dropped
// This lets a workspace pick up its monorepo-root `.prettierignore` without
// either silently losing patterns or having oxlint look for files that don't
// exist relative to its cwd.
const translatePattern = (pattern: string, relPath: string): string | null => {
  if (relPath === "") return pattern;
  const isNegation = pattern.startsWith("!");
  let body = isNegation ? pattern.slice(1) : pattern;
  const isAnchored = body.startsWith("/");
  if (isAnchored) body = body.slice(1);
  if (!isAnchored && !body.includes("/")) return pattern;
  const prefix = `${relPath}/`;
  if (!body.startsWith(prefix)) return null;
  const remaining = body.slice(prefix.length);
  return `${isNegation ? "!" : ""}${remaining}`;
};

// Walks up from `rootDirectory` to the nearest `.git` (or filesystem root),
// collecting ignore patterns at every level. v2 fans out per workspace, so a
// monorepo-root `.prettierignore` listing `apps/studio/public` would otherwise
// be invisible when oxlint runs from `apps/studio` — and oxlint would scan
// vendored bundles (Monaco editor's tsWorker.js, generated `.d.ts` files)
// inside the public/ directory, blowing wall-clock past 1200s on supabase.
export const collectIgnorePatterns = (rootDirectory: string): string[] => {
  const seen = new Set<string>();
  const patterns: string[] = [];
  const add = (pattern: string): void => {
    if (seen.has(pattern)) return;
    seen.add(pattern);
    patterns.push(pattern);
  };
  let currentDirectory = rootDirectory;
  while (true) {
    const relPath = path.relative(currentDirectory, rootDirectory);
    for (const fileName of IGNORE_FILENAMES) {
      for (const pattern of readIgnoreFile(path.join(currentDirectory, fileName))) {
        const translated = translatePattern(pattern, relPath);
        if (translated !== null) add(translated);
      }
    }
    for (const linguistPath of parseGitattributesLinguistPaths(
      path.join(currentDirectory, ".gitattributes"),
    )) {
      const translated = translatePattern(linguistPath, relPath);
      if (translated !== null) add(translated);
    }
    if (fs.existsSync(path.join(currentDirectory, ".git"))) break;
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  return patterns;
};
