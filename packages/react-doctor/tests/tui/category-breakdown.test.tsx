import { describe, expect, it } from "vite-plus/test";
import { render } from "ink-testing-library";
import { CategoryBreakdown } from "../../src/tui/components/category-breakdown.js";
import { computeCategoryBreakdown } from "../../src/tui/utils/category-breakdown.js";
import type { Diagnostic } from "../../src/types.js";
import { stripAnsi } from "./strip-ansi.js";

const buildDiagnostic = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  filePath: "/repo/src/App.tsx",
  plugin: "react-doctor",
  rule: "rule",
  severity: "warning",
  message: "msg",
  help: "",
  line: 10,
  column: 1,
  category: "performance",
  ...overrides,
});

describe("computeCategoryBreakdown", () => {
  it("returns an empty array when there are no diagnostics", () => {
    expect(computeCategoryBreakdown([])).toEqual([]);
  });

  it("groups diagnostics by category and counts severities separately", () => {
    const diagnostics: Diagnostic[] = [
      buildDiagnostic({ category: "performance", severity: "error" }),
      buildDiagnostic({ category: "performance", severity: "warning" }),
      buildDiagnostic({ category: "performance", severity: "warning" }),
      buildDiagnostic({ category: "state-effects", severity: "error" }),
      buildDiagnostic({ category: "accessibility", severity: "warning" }),
    ];
    const breakdown = computeCategoryBreakdown(diagnostics);
    expect(breakdown).toEqual([
      { category: "performance", errorCount: 1, warningCount: 2, total: 3 },
      { category: "state-effects", errorCount: 1, warningCount: 0, total: 1 },
      { category: "accessibility", errorCount: 0, warningCount: 1, total: 1 },
    ]);
  });

  it("sorts categories by total desc", () => {
    const diagnostics: Diagnostic[] = [
      buildDiagnostic({ category: "small" }),
      buildDiagnostic({ category: "big" }),
      buildDiagnostic({ category: "big" }),
      buildDiagnostic({ category: "big" }),
      buildDiagnostic({ category: "medium" }),
      buildDiagnostic({ category: "medium" }),
    ];
    const sortedCategories = computeCategoryBreakdown(diagnostics).map((entry) => entry.category);
    expect(sortedCategories).toEqual(["big", "medium", "small"]);
  });

  it("treats missing category as 'uncategorized'", () => {
    const diagnostic = buildDiagnostic({ category: "" });
    expect(computeCategoryBreakdown([diagnostic])[0].category).toBe("uncategorized");
  });
});

describe("CategoryBreakdown component", () => {
  const sampleBreakdown = [
    { category: "performance", errorCount: 5, warningCount: 10, total: 15 },
    { category: "state-effects", errorCount: 4, warningCount: 4, total: 8 },
    { category: "accessibility", errorCount: 0, warningCount: 5, total: 5 },
    { category: "architecture", errorCount: 2, warningCount: 0, total: 2 },
  ];

  it("renders a header and one row per category", () => {
    const { lastFrame } = render(
      <CategoryBreakdown breakdown={sampleBreakdown} contentWidth={60} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("By category");
    expect(frame).toContain("Performance");
    expect(frame).toContain("State Effects");
    expect(frame).toContain("Accessibility");
    expect(frame).toContain("Architecture");
    expect(frame).toContain("15");
    expect(frame).toContain("8");
  });

  it("uses bars proportional to the category with the highest total", () => {
    const { lastFrame } = render(
      <CategoryBreakdown breakdown={sampleBreakdown} contentWidth={60} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    const lines = frame.split("\n");
    const performanceLine = lines.find((line) => line.includes("Performance")) ?? "";
    const accessibilityLine = lines.find((line) => line.includes("Accessibility")) ?? "";
    const performanceFilled = (performanceLine.match(/█/g) ?? []).length;
    const accessibilityFilled = (accessibilityLine.match(/█/g) ?? []).length;
    expect(performanceFilled).toBeGreaterThan(accessibilityFilled);
  });

  it("appends an error count badge only for categories that contain errors", () => {
    const { lastFrame } = render(
      <CategoryBreakdown breakdown={sampleBreakdown} contentWidth={60} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("5✗");
    expect(frame).toContain("4✗");
    expect(frame).not.toMatch(/Accessibility[^\n]*✗/);
  });

  it("shows a '+ N more categories' line when truncated by the limit", () => {
    const longBreakdown = [
      ...sampleBreakdown,
      { category: "security", errorCount: 1, warningCount: 0, total: 1 },
      { category: "dead-code", errorCount: 0, warningCount: 1, total: 1 },
    ];
    const { lastFrame } = render(
      <CategoryBreakdown breakdown={longBreakdown} contentWidth={60} limit={4} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("+ 2 more categories");
  });

  it("never lets a row overflow the contentWidth budget", () => {
    const { lastFrame } = render(
      <CategoryBreakdown breakdown={sampleBreakdown} contentWidth={40} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    for (const line of frame.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("renders nothing for an empty breakdown", () => {
    const { lastFrame } = render(<CategoryBreakdown breakdown={[]} contentWidth={60} />);
    expect(lastFrame() ?? "").toBe("");
  });
});
