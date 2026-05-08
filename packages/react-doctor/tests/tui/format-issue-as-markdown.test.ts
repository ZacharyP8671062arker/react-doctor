import { describe, expect, it } from "vite-plus/test";
import type { Diagnostic } from "../../src/types.js";
import type { GroupedRule } from "../../src/tui/types.js";
import { formatIssueAsMarkdown } from "../../src/tui/utils/format-issue-as-markdown.js";

const buildDiagnostic = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  filePath: "/repo/src/UserCard.tsx",
  plugin: "react-doctor",
  rule: "no-fetch-in-effect",
  severity: "error",
  message: "Avoid fetch inside useEffect.",
  help: "Use a data-fetching library.",
  line: 42,
  column: 1,
  category: "state-effects",
  ...overrides,
});

const buildRule = (overrides: Partial<GroupedRule> = {}): GroupedRule => ({
  ruleKey: "react-doctor/no-fetch-in-effect",
  plugin: "react-doctor",
  rule: "no-fetch-in-effect",
  severity: "error",
  category: "state-effects",
  message: "Avoid fetch inside useEffect.",
  help: "Use a data-fetching library like TanStack Query.",
  diagnostics: [buildDiagnostic()],
  ...overrides,
});

describe("formatIssueAsMarkdown", () => {
  it("includes the rule id, severity, and site count in the header", () => {
    const markdown = formatIssueAsMarkdown(buildRule(), "/repo");
    expect(markdown).toContain(
      "**React Doctor — react-doctor/no-fetch-in-effect** (1 site, error)",
    );
  });

  it("pluralizes 'sites' correctly when there is more than one", () => {
    const rule = buildRule({
      diagnostics: [
        buildDiagnostic({ line: 10 }),
        buildDiagnostic({ line: 20 }),
        buildDiagnostic({ line: 30 }),
      ],
    });
    const markdown = formatIssueAsMarkdown(rule, "/repo");
    expect(markdown).toContain("(3 sites, error)");
  });

  it("renders the message and the help suggestion", () => {
    const markdown = formatIssueAsMarkdown(buildRule(), "/repo");
    expect(markdown).toContain("Avoid fetch inside useEffect.");
    expect(markdown).toContain("Suggestion: Use a data-fetching library like TanStack Query.");
  });

  it("lists every site with its file path relative to the project root", () => {
    const rule = buildRule({
      diagnostics: [
        buildDiagnostic({ filePath: "/repo/src/A.tsx", line: 11 }),
        buildDiagnostic({ filePath: "/repo/src/B.tsx", line: 22 }),
      ],
    });
    const markdown = formatIssueAsMarkdown(rule, "/repo");
    expect(markdown).toContain("- src/A.tsx:11");
    expect(markdown).toContain("- src/B.tsx:22");
  });

  it("truncates the site list with a '… + N more' suffix when over the cap", () => {
    const diagnostics: Diagnostic[] = Array.from({ length: 12 }, (_, idx) =>
      buildDiagnostic({ line: 100 + idx }),
    );
    const markdown = formatIssueAsMarkdown(buildRule({ diagnostics }), "/repo");
    expect(markdown).toContain("… + 4 more");
  });

  it("ends with an actionable instruction the agent can act on", () => {
    const markdown = formatIssueAsMarkdown(buildRule(), "/repo");
    expect(markdown.trim().endsWith("`react-doctor/no-fetch-in-effect`.")).toBe(true);
    expect(markdown).toContain("Please fix all 1 occurrence of");
  });
});
