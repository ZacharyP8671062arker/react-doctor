export {
  clearReactDoctorConfigCache,
  loadReactDoctorConfig,
  resolveConfigRootDirectory,
} from "../core/config.js";
export {
  calculateReactDoctorScore,
  buildReactDoctorJsonReport,
  summarizeReactDoctorResult,
} from "../core/reports.js";
export { calculateScore, getScoreLabel } from "../core/score.js";
export type { CalculateScoreOptions, ScoreDiagnostic } from "../core/score.js";
export {
  discoverReactProject,
  parseReactMajorVersion,
  toOxlintProjectInfo,
} from "../core/project.js";
export { filterReactDoctorIssues } from "../core/diagnostics.js";
export { OXLINT_CHECK_ID, runOxlint } from "../core/runners/oxlint.js";
export type { RunOxlintOptions } from "../core/runners/oxlint.js";
export {
  ReactDoctorError,
  ReactDoctorCancelledError,
  ReactDoctorConfigError,
  ReactDoctorConfigNotFoundError,
  ReactDoctorInvalidConfigError,
  ReactDoctorProjectError,
  ReactDoctorProjectNotFoundError,
  ReactDoctorPackageJsonNotFoundError,
  ReactDoctorNoReactDependencyError,
  ReactDoctorAmbiguousProjectError,
  ReactDoctorCheckError,
  ReactDoctorCheckFailedError,
  ReactDoctorCheckSkippedError,
  ReactDoctorRunnerUnavailableError,
  ReactDoctorUnsupportedRuntimeError,
  ReactDoctorTimeoutError,
  ReactDoctorReportError,
  isReactDoctorError,
  toReactDoctorErrorInfo,
} from "../core/errors.js";
export type { ReactDoctorErrorInfo, ReactDoctorErrorOptions } from "../core/errors.js";
export { createRuleRegistry, defineRule, ruleRegistry } from "../core/rules/index.js";
export type { ReactDoctorRuleRegistry, RuleRegistryOptions } from "../core/rules/registry.js";
export {
  ALL_REACT_DOCTOR_OXLINT_RULE_KEYS,
  BUILTIN_A11Y_OXLINT_RULES,
  BUILTIN_OXLINT_RULES,
  BUILTIN_REACT_OXLINT_RULES,
  CURATED_OXLINT_RULES,
  DEAD_CODE_RULE_ID,
  DEPENDENCIES_RULE_ID,
  GLOBAL_REACT_DOCTOR_OXLINT_RULES,
  NEXTJS_OXLINT_RULES,
  REACT_ARCHITECTURE_RULE_ID,
  REACT_COMPILER_OXLINT_RULES,
  REACT_DOCTOR_CUSTOM_OXLINT_RULES,
  REACT_DOCTOR_OXLINT_PLUGIN_NAMESPACE,
  REACT_DOCTOR_OXLINT_RULE_ID_PREFIX,
  REACT_NATIVE_OXLINT_RULES,
  TANSTACK_QUERY_OXLINT_RULES,
  TANSTACK_START_OXLINT_RULES,
  buildReactDoctorOxlintCapabilities,
  createReactDoctorOxlintConfig,
  coreRules,
  reactDoctorOxlintPlugin,
  reactDoctorOxlintRuleMetadata,
  reactProjectStructureRule,
  reactPeerRangeMinMajor,
  shouldEnableReactDoctorOxlintRule,
} from "../core/rules/index.js";
export type {
  OxlintEsTreeNode,
  OxlintParsedRgb,
  OxlintRule,
  OxlintRuleContext,
  OxlintRuleExample,
  OxlintRuleMetadata,
  OxlintRulePlugin,
  OxlintRuleSeverityMap,
  OxlintRuleVisitors,
  ReactDoctorOxlintConfigOptions,
  ReactDoctorOxlintFramework,
  ReactDoctorOxlintGeneratedConfig,
  ReactDoctorOxlintJsPluginEntry,
  ReactDoctorOxlintProjectInfo,
  ReactDoctorRule,
  ReactDoctorRuleContext,
  ReactDoctorRuleExample,
  ReactDoctorRuleMetadata,
  ReactDoctorRuleResult,
} from "../core/rules/index.js";
export type {
  InspectReactProjectOptions,
  ReactDoctorCheckResult,
  ReactDoctorIssue,
  ReactDoctorIssueSource,
  ReactDoctorConfig,
  ReactDoctorFailOnLevel,
  ReactDoctorIgnoreConfig,
  ReactDoctorIgnoreOverride,
  ReactDoctorJsonReport,
  ReactDoctorJsonReportSummary,
  ReactDoctorResult,
  ReactDoctorRuleSelection,
  ReactDoctorScore,
  ReactProjectFramework,
  ReactProjectInfo,
  SourceLocation,
} from "../core/types.js";
export { reactDoctorEslintPlugin } from "../eslint-plugin.js";
export { clearCaches, diagnose } from "./compat.js";
export type {
  Diagnostic,
  DiagnoseOptions,
  DiagnoseResult,
  ProjectInfo,
  ScoreResult,
} from "./compat.js";
export { createReactDoctor, inspectReactProject } from "./create-react-doctor.js";
export type { CreateReactDoctorOptions, ReactDoctor } from "./create-react-doctor.js";
