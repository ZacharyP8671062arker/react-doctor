import type { Diagnostic, ReactDoctorConfig } from "../types.js";
import { filterAutomaticSuppressions } from "./filter-automatic-suppressions.js";
import { filterIgnoredDiagnostics, filterInlineSuppressions } from "./filter-diagnostics.js";

interface MergeAndFilterOptions {
  respectInlineDisables?: boolean;
}

// HACK: three suppression layers, applied in order:
//   1. Automatic (test-file rule scoping, build-entry dead-code).
//      Project-driven defaults; opt out via `suppressNoiseRulesInTestFiles`
//      / `suppressDeadCodeForBuildEntries` config flags. For
//      file-level fine control, opt out and use `ignore.overrides`.
//   2. User config (`ignore.rules` / `ignore.files` / `ignore.overrides`).
//      Always filtering further; never re-enables automatic drops.
//   3. Inline `// react-doctor-disable*`. Per-site authoring escape hatch;
//      only runs when `respectInlineDisables` isn't explicitly false.
export const mergeAndFilterDiagnostics = (
  mergedDiagnostics: Diagnostic[],
  directory: string,
  userConfig: ReactDoctorConfig | null,
  readFileLinesSync: (filePath: string) => string[] | null,
  options: MergeAndFilterOptions = {},
): Diagnostic[] => {
  const autoSuppressed = filterAutomaticSuppressions(mergedDiagnostics, directory, userConfig);
  const userFiltered = userConfig
    ? filterIgnoredDiagnostics(autoSuppressed, userConfig, directory, readFileLinesSync)
    : autoSuppressed;
  if (options.respectInlineDisables === false) return userFiltered;
  return filterInlineSuppressions(userFiltered, directory, readFileLinesSync);
};
