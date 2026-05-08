import { Box, Text } from "ink";
import {
  CATEGORY_BAR_MAX_WIDTH_CHARS,
  CATEGORY_BAR_MIN_WIDTH_CHARS,
  CATEGORY_BREAKDOWN_DEFAULT_LIMIT,
} from "../constants.js";
import type { CategoryBreakdown as CategoryBreakdownEntry } from "../types.js";
import { truncateText } from "../utils/truncate-text.js";

interface CategoryBreakdownProps {
  breakdown: CategoryBreakdownEntry[];
  contentWidth: number;
  limit?: number;
}

const titleCase = (rawCategory: string): string => {
  if (rawCategory.length === 0) return "Uncategorized";
  return rawCategory
    .split(/[-_\s]+/)
    .map((segment) =>
      segment.length === 0 ? segment : segment[0].toUpperCase() + segment.slice(1),
    )
    .join(" ");
};

const computeNameWidth = (entries: CategoryBreakdownEntry[], contentWidth: number): number => {
  const longestName = entries.reduce(
    (longestSoFar, entry) => Math.max(longestSoFar, titleCase(entry.category).length),
    0,
  );
  const reservedForBarAndCount = CATEGORY_BAR_MIN_WIDTH_CHARS + 6;
  const widthBudget = Math.max(8, contentWidth - reservedForBarAndCount);
  return Math.min(longestName, widthBudget, 18);
};

const computeBarWidth = (contentWidth: number, nameWidth: number): number => {
  const reserved = nameWidth + 6;
  const available = contentWidth - reserved;
  if (available < CATEGORY_BAR_MIN_WIDTH_CHARS) return CATEGORY_BAR_MIN_WIDTH_CHARS;
  return Math.min(CATEGORY_BAR_MAX_WIDTH_CHARS, available);
};

const padRight = (text: string, width: number): string => {
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
};

export const CategoryBreakdown = ({
  breakdown,
  contentWidth,
  limit = CATEGORY_BREAKDOWN_DEFAULT_LIMIT,
}: CategoryBreakdownProps) => {
  if (breakdown.length === 0) return null;
  const visibleEntries = breakdown.slice(0, limit);
  const remainingCount = breakdown.length - visibleEntries.length;
  const maxTotal = Math.max(...visibleEntries.map((entry) => entry.total), 1);
  const nameWidth = computeNameWidth(visibleEntries, contentWidth);
  const barWidth = computeBarWidth(contentWidth, nameWidth);
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">By category</Text>
      </Box>
      {visibleEntries.map((entry) => {
        const filledCount = Math.max(1, Math.round((entry.total / maxTotal) * barWidth));
        const emptyCount = Math.max(0, barWidth - filledCount);
        const barColor = entry.errorCount > 0 ? "red" : "yellow";
        const truncatedName = truncateText(titleCase(entry.category), nameWidth);
        return (
          <Box key={entry.category}>
            <Text color="gray"> </Text>
            <Text color="white">{padRight(truncatedName, nameWidth)}</Text>
            <Text color="gray"> </Text>
            <Text color={barColor}>{"█".repeat(filledCount)}</Text>
            <Text color="gray">{"░".repeat(emptyCount)}</Text>
            <Text color="gray"> </Text>
            <Text color="white" bold>
              {entry.total}
            </Text>
            {entry.errorCount > 0 ? (
              <>
                <Text color="gray"> </Text>
                <Text color="red">{entry.errorCount}✗</Text>
              </>
            ) : null}
          </Box>
        );
      })}
      {remainingCount > 0 ? (
        <Box>
          <Text color="gray">
            {" "}
            + {remainingCount} more categor{remainingCount === 1 ? "y" : "ies"}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};
