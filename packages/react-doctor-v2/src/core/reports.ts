import { calculateScore, getScoreLabel, type ScoreDiagnostic } from "./score.js";
import type {
  ReactDoctorIssue,
  ReactDoctorJsonReport,
  ReactDoctorJsonReportSummary,
  ReactDoctorResult,
  ReactDoctorScore,
} from "./types.js";

const toScoreDiagnostic = (issue: ReactDoctorIssue): ScoreDiagnostic => {
  const plugin = issue.source?.pluginName ?? "react-doctor";
  const rule = issue.source?.ruleId ?? issue.id;
  const severity: "error" | "warning" = issue.severity === "error" ? "error" : "warning";
  return { plugin, rule, severity };
};

export const calculateReactDoctorScore = (issues: ReactDoctorIssue[]): ReactDoctorScore => {
  const value = calculateScore(issues.map(toScoreDiagnostic));
  return { value, label: getScoreLabel(value) };
};

export const summarizeReactDoctorResult = (
  result: ReactDoctorResult,
): ReactDoctorJsonReportSummary => {
  const affectedFiles = new Set(
    result.issues.flatMap((issue) => (issue.location?.filePath ? [issue.location.filePath] : [])),
  );
  return {
    errorCount: result.issues.filter((issue) => issue.severity === "error").length,
    warningCount: result.issues.filter((issue) => issue.severity === "warning").length,
    affectedFileCount: affectedFiles.size,
    totalIssueCount: result.issues.length,
    score: result.score?.value ?? null,
    scoreLabel: result.score?.label ?? null,
  };
};

export const buildReactDoctorJsonReport = (result: ReactDoctorResult): ReactDoctorJsonReport => ({
  schemaVersion: 1,
  ok: result.status === "completed" && !result.issues.some((issue) => issue.severity === "error"),
  project: result.project,
  issues: result.issues,
  checks: result.checks,
  summary: summarizeReactDoctorResult(result),
  startedAt: result.startedAt,
  completedAt: result.completedAt,
  durationMilliseconds: result.durationMilliseconds,
});
