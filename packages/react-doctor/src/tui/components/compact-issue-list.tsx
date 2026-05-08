import { Box, Text } from "ink";
import { TOP_ISSUES_COMPACT_LIMIT } from "../constants.js";
import type { GroupedRule } from "../types.js";
import { colorForSeverity, symbolForSeverity } from "../utils/color-for-severity.js";
import { truncateText } from "../utils/truncate-text.js";

interface CompactIssueListProps {
  rules: GroupedRule[];
  excludeFirst: boolean;
  contentWidth: number;
  limit?: number;
}

const SEVERITY_AND_SPACE_COLS = 2;
const COUNT_PADDING_COLS = 2;

const padRight = (text: string, width: number): string => {
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
};

export const CompactIssueList = ({
  rules,
  excludeFirst,
  contentWidth,
  limit = TOP_ISSUES_COMPACT_LIMIT,
}: CompactIssueListProps) => {
  const displayedRules = excludeFirst ? rules.slice(1) : rules;
  const visibleRules = displayedRules.slice(0, limit);
  const remainingRulesCount = displayedRules.length - visibleRules.length;
  if (visibleRules.length === 0 && remainingRulesCount === 0) return null;
  const longestSiteSuffix = visibleRules.reduce((widestSoFar, rule) => {
    const siteCount = rule.diagnostics.length;
    const suffix = `${siteCount} site${siteCount === 1 ? "" : "s"}`;
    return Math.max(widestSoFar, suffix.length);
  }, 0);
  const ruleNameWidth = Math.max(
    10,
    contentWidth - SEVERITY_AND_SPACE_COLS - longestSiteSuffix - COUNT_PADDING_COLS,
  );
  return (
    <Box flexDirection="column">
      {visibleRules.map((rule) => {
        const severityColor = colorForSeverity(rule.severity);
        const siteCount = rule.diagnostics.length;
        const truncatedRuleName = truncateText(rule.rule, ruleNameWidth);
        return (
          <Box key={rule.ruleKey}>
            <Text color={severityColor}>
              {symbolForSeverity(rule.severity)} {padRight(truncatedRuleName, ruleNameWidth)}
            </Text>
            <Text color="gray">
              {siteCount} site{siteCount === 1 ? "" : "s"}
            </Text>
          </Box>
        );
      })}
      {remainingRulesCount > 0 ? (
        <Box>
          <Text color="gray">
            + {remainingRulesCount} more rule{remainingRulesCount === 1 ? "" : "s"}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};
