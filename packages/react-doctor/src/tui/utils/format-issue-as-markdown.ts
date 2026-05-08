import type { GroupedRule } from "../types.js";
import { readSourceSnippet } from "./read-source-snippet.js";
import { toRelativePath } from "./relative-path.js";

const SITES_SHOWN_IN_LIST = 8;

export const formatIssueAsMarkdown = (rule: GroupedRule, rootDirectory: string): string => {
  const sitesCount = rule.diagnostics.length;
  const sitesLabel = `${sitesCount} site${sitesCount === 1 ? "" : "s"}`;
  const lines: string[] = [
    `**React Doctor — ${rule.ruleKey}** (${sitesLabel}, ${rule.severity})`,
    "",
    rule.message,
  ];

  if (rule.help) {
    lines.push("", `Suggestion: ${rule.help}`);
  }

  if (sitesCount > 0) {
    lines.push("", "Sites:");
    const visibleSites = rule.diagnostics.slice(0, SITES_SHOWN_IN_LIST);
    for (const diagnostic of visibleSites) {
      const relativePath = toRelativePath(diagnostic.filePath, rootDirectory);
      lines.push(`- ${relativePath}${diagnostic.line > 0 ? `:${diagnostic.line}` : ""}`);
    }
    if (sitesCount > visibleSites.length) {
      lines.push(`- … + ${sitesCount - visibleSites.length} more`);
    }

    const firstDiagnostic = rule.diagnostics[0];
    if (firstDiagnostic && firstDiagnostic.line > 0) {
      const snippet = readSourceSnippet(firstDiagnostic.filePath, firstDiagnostic.line);
      if (snippet.lines.length > 0 && !snippet.errorMessage) {
        const relativePath = toRelativePath(firstDiagnostic.filePath, rootDirectory);
        lines.push("", `Code at ${relativePath}:${firstDiagnostic.line}:`, "```");
        for (const sourceLine of snippet.lines) {
          const lineNumberLabel = String(sourceLine.lineNumber).padStart(4);
          const marker = sourceLine.isHighlighted ? "▸" : " ";
          lines.push(`${marker} ${lineNumberLabel} | ${sourceLine.text}`);
        }
        lines.push("```");
      }
    }
  }

  lines.push(
    "",
    `Please fix all ${sitesCount} occurrence${sitesCount === 1 ? "" : "s"} of \`${rule.ruleKey}\`.`,
  );

  return lines.join("\n");
};
