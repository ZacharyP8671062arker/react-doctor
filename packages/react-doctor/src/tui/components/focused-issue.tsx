import { Box, Text } from "ink";
import { FOCUSED_ISSUE_HELP_MAX_CHARS } from "../constants.js";
import type { GroupedRule } from "../types.js";
import { colorForSeverity, symbolForSeverity } from "../utils/color-for-severity.js";
import { readSourceSnippet } from "../utils/read-source-snippet.js";
import { toRelativePath } from "../utils/relative-path.js";
import { truncatePath } from "../utils/truncate-path.js";
import { truncateText } from "../utils/truncate-text.js";
import { SourceSnippet } from "./source-snippet.js";

interface FocusedIssueProps {
  rule: GroupedRule;
  rootDirectory: string;
  contentWidth: number;
}

const RULE_HEADER_OVERHEAD = 4;

export const FocusedIssue = ({ rule, rootDirectory, contentWidth }: FocusedIssueProps) => {
  const severityColor = colorForSeverity(rule.severity);
  const sitesCount = rule.diagnostics.length;
  const firstSite = rule.diagnostics[0];
  const snippet =
    firstSite && firstSite.line > 0 ? readSourceSnippet(firstSite.filePath, firstSite.line) : null;
  const sitesLabel = `  ${sitesCount} site${sitesCount === 1 ? "" : "s"}`;
  const ruleNameBudget = Math.max(10, contentWidth - RULE_HEADER_OVERHEAD - sitesLabel.length);
  const truncatedRuleKey = truncateText(rule.ruleKey, ruleNameBudget);
  const messageBudget = Math.max(20, contentWidth - 4);
  const helpBudget = Math.min(FOCUSED_ISSUE_HELP_MAX_CHARS, Math.max(20, contentWidth - 6));
  const pathBudget = Math.max(20, contentWidth - 6);
  const snippetWidth = Math.max(20, contentWidth - 6);
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={severityColor} bold>
          {symbolForSeverity(rule.severity)} {truncatedRuleKey}
        </Text>
        <Text color="gray">{sitesLabel}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text>{truncateText(rule.message, messageBudget)}</Text>
      </Box>
      {rule.help ? (
        <Box marginLeft={2}>
          <Text color="gray">→ {truncateText(rule.help, helpBudget)}</Text>
        </Box>
      ) : null}
      {firstSite ? (
        <Box flexDirection="column" marginTop={1} marginLeft={4}>
          <Text color="cyan">
            {truncatePath(
              `${toRelativePath(firstSite.filePath, rootDirectory)}${
                firstSite.line > 0 ? `:${firstSite.line}` : ""
              }`,
              pathBudget,
            )}
          </Text>
          {snippet ? (
            <Box marginTop={0}>
              <SourceSnippet snippet={snippet} maxLineWidth={snippetWidth} />
            </Box>
          ) : null}
          {sitesCount > 1 ? (
            <Box marginTop={1}>
              <Text color="gray">
                + {sitesCount - 1} more site{sitesCount - 1 === 1 ? "" : "s"}
              </Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};
