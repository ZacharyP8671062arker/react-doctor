import type { Diagnostic, ReactDoctorConfig } from "../types.js";
import { isLikelyBuildEntry } from "./is-likely-build-entry.js";
import { isTestFilePath } from "./is-test-file.js";
import { RULES_DISABLED_IN_TEST_FILES } from "./rules-disabled-in-test-files.js";
import { toRelativePath } from "./to-relative-path.js";

interface FilterAutomaticSuppressionsOptions {
  /**
   * When `true` (default), rules that fire on patterns tests
   * legitimately need (e.g. `no-array-index-as-key`, `no-giant-component`,
   * `no-react19-deprecated-apis`) are suppressed in any file matched by
   * `isTestFilePath`. Set `false` to score test files with the full
   * production rule set.
   */
  suppressNoiseRulesInTestFiles?: boolean;
  /**
   * When `true` (default), `knip/files` diagnostics are suppressed for
   * source files that have a matching artifact in a build-output
   * directory (`dist`, `build`, `lib`, `out`, `esm`, `cjs`) — those are
   * library entry points consumed externally, not dead code. Set
   * `false` to flag every unimported source file regardless.
   */
  suppressDeadCodeForBuildEntries?: boolean;
}

const KNIP_UNUSED_FILE_RULE_ID = "knip/files";

// HACK: runs as a project-driven (no user-config required) filter
// pass over the merged diagnostics. Two suppressions:
//   1. Test files: rules that encode "you wouldn't want this in
//      production code" don't apply to fixtures that intentionally
//      exercise the bad pattern.
//   2. Build entries: source files with a matching artifact under a
//      common build-output dir aren't dead — they're library entry
//      points consumed via the build, not via source imports.
//
// User overrides (`ignore.overrides`, `ignore.rules`, inline disable
// comments) compose with this filter — they run later in the
// pipeline and can re-suppress, but can't un-suppress what we drop
// here. Inverting an automatic suppression intentionally requires a
// config flag rather than a rule re-enable, since the auto-suppression
// is the intended behavior.
export const filterAutomaticSuppressions = (
  diagnostics: Diagnostic[],
  rootDirectory: string,
  userConfig: ReactDoctorConfig | null,
  options: FilterAutomaticSuppressionsOptions = {},
): Diagnostic[] => {
  const suppressNoiseRulesInTestFiles =
    options.suppressNoiseRulesInTestFiles ?? userConfig?.suppressNoiseRulesInTestFiles ?? true;
  const suppressDeadCodeForBuildEntries =
    options.suppressDeadCodeForBuildEntries ?? userConfig?.suppressDeadCodeForBuildEntries ?? true;

  if (!suppressNoiseRulesInTestFiles && !suppressDeadCodeForBuildEntries) return diagnostics;

  // HACK: cache the per-file path-shape checks so a file with N
  // diagnostics doesn't re-run the regex / fs lookup N times.
  const isTestPathCache = new Map<string, boolean>();
  const isBuildEntryCache = new Map<string, boolean>();

  const isTest = (relativeFilePath: string): boolean => {
    const cached = isTestPathCache.get(relativeFilePath);
    if (cached !== undefined) return cached;
    const result = isTestFilePath(relativeFilePath);
    isTestPathCache.set(relativeFilePath, result);
    return result;
  };

  const isBuildEntry = (relativeFilePath: string): boolean => {
    const cached = isBuildEntryCache.get(relativeFilePath);
    if (cached !== undefined) return cached;
    const result = isLikelyBuildEntry(relativeFilePath, rootDirectory);
    isBuildEntryCache.set(relativeFilePath, result);
    return result;
  };

  return diagnostics.filter((diagnostic) => {
    const relativeFilePath = toRelativePath(diagnostic.filePath, rootDirectory);
    const ruleIdentifier = `${diagnostic.plugin}/${diagnostic.rule}`;

    if (
      suppressNoiseRulesInTestFiles &&
      RULES_DISABLED_IN_TEST_FILES.has(ruleIdentifier) &&
      isTest(relativeFilePath)
    ) {
      return false;
    }

    if (
      suppressDeadCodeForBuildEntries &&
      ruleIdentifier === KNIP_UNUSED_FILE_RULE_ID &&
      isBuildEntry(relativeFilePath)
    ) {
      return false;
    }

    return true;
  });
};
