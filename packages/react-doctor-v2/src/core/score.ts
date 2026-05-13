import {
  ERROR_RULE_PENALTY,
  PERFECT_SCORE,
  SCORE_GOOD_THRESHOLD,
  SCORE_OK_THRESHOLD,
  WARNING_RULE_PENALTY,
} from "../constants.js";

/**
 * Log-scaled per rule. One issue still costs; 1000 issues don't zero a big repo.
 * Comparable across repo sizes.
 */
export interface ScoreDiagnostic {
  plugin: string;
  rule: string;
  severity: "error" | "warning";
}

export interface CalculateScoreOptions {
  perfectScore?: number;
}

export const getScoreLabel = (score: number): string => {
  if (score >= SCORE_GOOD_THRESHOLD) return "Great";
  if (score >= SCORE_OK_THRESHOLD) return "Needs work";
  return "Critical";
};

const rulePenalty = (severity: "error" | "warning", count: number): number => {
  const base = severity === "error" ? ERROR_RULE_PENALTY : WARNING_RULE_PENALTY;
  return base * (1 + Math.log2(count));
};

export const calculateScore = (
  diagnostics: ScoreDiagnostic[],
  options: CalculateScoreOptions = {},
): number => {
  const perfectScore = options.perfectScore ?? PERFECT_SCORE;
  if (diagnostics.length === 0) return perfectScore;

  const ruleCounts = new Map<string, number>();
  const ruleSeverities = new Map<string, "error" | "warning">();

  for (const diagnostic of diagnostics) {
    const ruleKey = `${diagnostic.plugin}/${diagnostic.rule}`;
    ruleCounts.set(ruleKey, (ruleCounts.get(ruleKey) ?? 0) + 1);
    if (diagnostic.severity === "error" || !ruleSeverities.has(ruleKey)) {
      ruleSeverities.set(ruleKey, diagnostic.severity);
    }
  }

  let totalPenalty = 0;
  for (const [ruleKey, count] of ruleCounts) {
    const severity = ruleSeverities.get(ruleKey) ?? "warning";
    totalPenalty += rulePenalty(severity, count);
  }

  return Math.max(0, Math.min(perfectScore, Math.round(perfectScore - totalPenalty)));
};
