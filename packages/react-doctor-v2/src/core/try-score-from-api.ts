import { FETCH_TIMEOUT_MS, SCORE_API_URL } from "../constants.js";
import type { ReactDoctorIssue, ReactDoctorScore } from "./types.js";

interface ApiDiagnostic {
  plugin: string;
  rule: string;
  severity: "error" | "warning";
  message: string;
  help: string;
  line: number;
  column: number;
  category: string;
}

const parseScoreResult = (value: unknown): ReactDoctorScore | null => {
  if (typeof value !== "object" || value === null) return null;
  if (!("score" in value) || !("label" in value)) return null;
  const scoreValue = Reflect.get(value, "score");
  const labelValue = Reflect.get(value, "label");
  if (typeof scoreValue !== "number" || typeof labelValue !== "string") return null;
  return { value: scoreValue, label: labelValue };
};

const issueToApiDiagnostic = (issue: ReactDoctorIssue): ApiDiagnostic => ({
  plugin: issue.source?.pluginName ?? issue.source?.checkId ?? "react-doctor",
  rule: issue.source?.ruleId ?? issue.id,
  severity: issue.severity === "error" ? "error" : "warning",
  message: issue.message,
  help: issue.recommendation ?? "",
  line: issue.location?.line ?? 0,
  column: issue.location?.column ?? 0,
  category: issue.category,
});

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

const describeFailure = (error: unknown): string => {
  if (isAbortError(error)) {
    return `timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
  }
  if (error instanceof Error && error.message) return error.message;
  return String(error);
};

export const tryScoreFromApi = async (
  issues: ReactDoctorIssue[],
  fetchImplementation: typeof fetch | undefined,
): Promise<ReactDoctorScore | null> => {
  if (typeof fetchImplementation !== "function") return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImplementation(SCORE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnostics: issues.map(issueToApiDiagnostic) }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `[react-doctor] Score API returned ${response.status} ${response.statusText} — using local scoring`,
      );
      return null;
    }

    return parseScoreResult(await response.json());
  } catch (error) {
    console.warn(
      `[react-doctor] Score API unreachable (${describeFailure(error)}) — using local scoring`,
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};
