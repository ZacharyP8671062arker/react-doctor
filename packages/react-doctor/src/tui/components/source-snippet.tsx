import { Box, Text } from "ink";
import type { SourceSnippetResult } from "../utils/read-source-snippet.js";
import { truncateText } from "../utils/truncate-text.js";

interface SourceSnippetProps {
  snippet: SourceSnippetResult;
  maxLineWidth: number;
}

const padLineNumber = (lineNumber: number, maxDigits: number): string =>
  String(lineNumber).padStart(maxDigits);

const LINE_PREFIX_OVERHEAD = 4;

export const SourceSnippet = ({ snippet, maxLineWidth }: SourceSnippetProps) => {
  if (snippet.errorMessage) {
    return (
      <Box>
        <Text color="gray">[unable to read snippet]</Text>
      </Box>
    );
  }
  if (snippet.lines.length === 0) {
    return (
      <Box>
        <Text color="gray">[no snippet available]</Text>
      </Box>
    );
  }
  const maxDigits = String(snippet.endLine).length;
  const sourceTextBudget = Math.max(8, maxLineWidth - maxDigits - LINE_PREFIX_OVERHEAD);
  return (
    <Box flexDirection="column">
      {snippet.lines.map((line) => {
        const isHighlighted = line.isHighlighted;
        const indicator = isHighlighted ? "▸" : " ";
        return (
          <Box key={line.lineNumber}>
            <Text color={isHighlighted ? "red" : "gray"}>{indicator}</Text>
            <Text color="gray"> {padLineNumber(line.lineNumber, maxDigits)} │ </Text>
            <Text color={isHighlighted ? "white" : "gray"} bold={isHighlighted}>
              {truncateText(line.text, sourceTextBudget)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
