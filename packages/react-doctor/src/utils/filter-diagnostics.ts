import type { Diagnostic, ReactDoctorConfig } from "../types.js";
import {
  compileIgnoreOverrides,
  isDiagnosticIgnoredByOverrides,
} from "./apply-ignore-overrides.js";
import { evaluateSuppression } from "./evaluate-suppression.js";
import { compileIgnoredFilePatterns, isFileIgnoredByPatterns } from "./is-ignored-file.js";

const OPENING_TAG_PATTERN = /<([A-Z][\w.]*)/;
const JSX_CHILD_OPEN_PATTERN = /<[A-Za-z]/;

const escapeRegExpSpecials = (rawText: string): string =>
  rawText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveCandidateReadPath = (rootDirectory: string, filePath: string): string => {
  const normalizedFile = filePath.replace(/\\/g, "/");
  if (
    normalizedFile.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalizedFile) ||
    /^[a-zA-Z]:\\/.test(filePath)
  ) {
    return filePath;
  }
  const root = rootDirectory.replace(/\\/g, "/").replace(/\/$/, "");
  return `${root}/${normalizedFile.replace(/^\.\//, "")}`;
};

const createFileLinesCache = (
  rootDirectory: string,
  readFileLinesSync: (filePath: string) => string[] | null,
) => {
  const cache = new Map<string, string[] | null>();

  return (filePath: string): string[] | null => {
    const cached = cache.get(filePath);
    if (cached !== undefined) return cached;
    const absolutePath = resolveCandidateReadPath(rootDirectory, filePath);
    const lines = readFileLinesSync(absolutePath);
    cache.set(filePath, lines);
    return lines;
  };
};

const isInsideTextComponent = (
  lines: string[],
  diagnosticLine: number,
  textComponentNames: Set<string>,
): boolean => {
  for (let lineIndex = diagnosticLine - 1; lineIndex >= 0; lineIndex--) {
    const match = lines[lineIndex].match(OPENING_TAG_PATTERN);
    if (!match) continue;
    const fullTagName = match[1];
    const leafTagName = fullTagName.includes(".")
      ? (fullTagName.split(".").at(-1) ?? fullTagName)
      : fullTagName;
    return textComponentNames.has(fullTagName) || textComponentNames.has(leafTagName);
  }
  return false;
};

interface EnclosingJsxOpener {
  fullName: string;
  leafName: string;
  lineIndex: number;
}

const findEnclosingJsxOpener = (
  lines: string[],
  diagnosticLine: number,
): EnclosingJsxOpener | null => {
  for (let lineIndex = diagnosticLine - 1; lineIndex >= 0; lineIndex--) {
    const match = lines[lineIndex].match(OPENING_TAG_PATTERN);
    if (!match) continue;
    const fullName = match[1];
    const leafName = fullName.includes(".") ? (fullName.split(".").at(-1) ?? fullName) : fullName;
    return { fullName, leafName, lineIndex };
  }
  return null;
};

// Returns the inner-body text of a JSX element starting at `opener`,
// using a forward scan for the matching `</fullName>` or `</leafName>`
// closing tag. Heuristic — operates on raw lines without an AST — but
// good enough to distinguish "wrapper holds only stringifiable
// children" from "wrapper also holds a JSX child element".
//
// Returns `null` when we couldn't confidently locate the enclosing
// element's body (e.g. no matching closing tag, opening tag's `>`
// missing on its own line). Callers should treat `null` as "don't
// suppress" — staying conservative when the heuristic loses
// confidence.
const extractWrapperBodyText = (lines: string[], opener: EnclosingJsxOpener): string | null => {
  const closingPattern = new RegExp(
    `</(?:${escapeRegExpSpecials(opener.fullName)}|${escapeRegExpSpecials(opener.leafName)})\\s*>`,
  );

  let closingLineIndex = -1;
  let closingMatchColumn = -1;
  for (let lineIndex = opener.lineIndex; lineIndex < lines.length; lineIndex++) {
    const match = closingPattern.exec(lines[lineIndex]);
    if (!match) continue;
    closingLineIndex = lineIndex;
    closingMatchColumn = match.index;
    break;
  }
  if (closingLineIndex < 0) return null;

  const openerLine = lines[opener.lineIndex];
  const tagStartIndex = openerLine.indexOf(`<${opener.fullName}`);
  if (tagStartIndex < 0) return null;
  const openerEndIndex = openerLine.indexOf(">", tagStartIndex);

  if (opener.lineIndex === closingLineIndex) {
    if (openerEndIndex < 0 || openerEndIndex >= closingMatchColumn) return null;
    return openerLine.slice(openerEndIndex + 1, closingMatchColumn);
  }

  const segments: string[] = [];
  if (openerEndIndex >= 0) {
    segments.push(openerLine.slice(openerEndIndex + 1));
  }
  for (let lineIndex = opener.lineIndex + 1; lineIndex < closingLineIndex; lineIndex++) {
    segments.push(lines[lineIndex]);
  }
  segments.push(lines[closingLineIndex].slice(0, closingMatchColumn));
  return segments.join("\n");
};

const isInsideStringOnlyWrapper = (
  lines: string[],
  diagnosticLine: number,
  wrapperNames: Set<string>,
): boolean => {
  const opener = findEnclosingJsxOpener(lines, diagnosticLine);
  if (!opener) return false;
  if (!wrapperNames.has(opener.fullName) && !wrapperNames.has(opener.leafName)) return false;
  const bodyText = extractWrapperBodyText(lines, opener);
  if (bodyText === null) return false;
  return !JSX_CHILD_OPEN_PATTERN.test(bodyText);
};

export const filterIgnoredDiagnostics = (
  diagnostics: Diagnostic[],
  config: ReactDoctorConfig,
  rootDirectory: string,
  readFileLinesSync: (filePath: string) => string[] | null,
): Diagnostic[] => {
  const ignoredRules = new Set(
    Array.isArray(config.ignore?.rules)
      ? config.ignore.rules.filter((rule): rule is string => typeof rule === "string")
      : [],
  );
  const ignoredFilePatterns = compileIgnoredFilePatterns(config);
  const compiledOverrides = compileIgnoreOverrides(config);
  const textComponentNames = new Set(
    Array.isArray(config.textComponents)
      ? config.textComponents.filter((name): name is string => typeof name === "string")
      : [],
  );
  const hasTextComponents = textComponentNames.size > 0;
  const rawTextWrapperComponentNames = new Set(
    Array.isArray(config.rawTextWrapperComponents)
      ? config.rawTextWrapperComponents.filter((name): name is string => typeof name === "string")
      : [],
  );
  const hasRawTextWrappers = rawTextWrapperComponentNames.size > 0;
  const getFileLines = createFileLinesCache(rootDirectory, readFileLinesSync);

  return diagnostics.filter((diagnostic) => {
    const ruleIdentifier = `${diagnostic.plugin}/${diagnostic.rule}`;
    if (ignoredRules.has(ruleIdentifier)) return false;
    if (isFileIgnoredByPatterns(diagnostic.filePath, rootDirectory, ignoredFilePatterns)) {
      return false;
    }
    if (isDiagnosticIgnoredByOverrides(diagnostic, rootDirectory, compiledOverrides)) return false;

    if (
      (hasTextComponents || hasRawTextWrappers) &&
      diagnostic.rule === "rn-no-raw-text" &&
      diagnostic.line > 0
    ) {
      const lines = getFileLines(diagnostic.filePath);
      if (lines) {
        if (
          hasTextComponents &&
          isInsideTextComponent(lines, diagnostic.line, textComponentNames)
        ) {
          return false;
        }
        if (
          hasRawTextWrappers &&
          isInsideStringOnlyWrapper(lines, diagnostic.line, rawTextWrapperComponentNames)
        ) {
          return false;
        }
      }
    }

    return true;
  });
};

export const filterInlineSuppressions = (
  diagnostics: Diagnostic[],
  rootDirectory: string,
  readFileLinesSync: (filePath: string) => string[] | null,
): Diagnostic[] => {
  const getFileLines = createFileLinesCache(rootDirectory, readFileLinesSync);

  return diagnostics.flatMap((diagnostic) => {
    if (diagnostic.line <= 0) return [diagnostic];

    const lines = getFileLines(diagnostic.filePath);
    if (!lines) return [diagnostic];

    const ruleIdentifier = `${diagnostic.plugin}/${diagnostic.rule}`;
    const diagnosticLineIndex = diagnostic.line - 1;

    const evaluation = evaluateSuppression(lines, diagnosticLineIndex, ruleIdentifier);
    if (evaluation.isSuppressed) return [];
    return evaluation.nearMissHint
      ? [{ ...diagnostic, suppressionHint: evaluation.nearMissHint }]
      : [diagnostic];
  });
};
