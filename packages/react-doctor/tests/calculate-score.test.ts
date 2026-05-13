import { describe, expect, it } from "vite-plus/test";
import { calculateReactDoctorScore } from "../src/sdk/index.js";
import type { ReactDoctorIssue } from "../src/sdk/index.js";

const createDeadCodeIssue = (ruleId: string, filePath: string): ReactDoctorIssue => ({
  id: `react-doctor/codebase/dead-code/${ruleId}/${filePath}`,
  title: "Dead code",
  message: "Sample dead code finding",
  severity: "warning",
  category: "codebase",
  location: { filePath },
  source: {
    checkId: "react-doctor/codebase/dead-code",
    pluginName: "react-doctor",
    ruleId,
  },
});

const createOxlintIssue = (ruleId: string, filePath: string, line: number): ReactDoctorIssue => ({
  id: `react-doctor/oxlint/${ruleId}/${filePath}/${line}`,
  title: ruleId,
  message: "Sample oxlint finding",
  severity: "warning",
  category: "oxlint",
  location: { filePath, line },
  source: {
    checkId: "react-doctor/oxlint",
    pluginName: "react-doctor",
    ruleId,
  },
});

describe("calculateReactDoctorScore", () => {
  it("scores a clean codebase at the perfect score", () => {
    expect(calculateReactDoctorScore([]).value).toBe(100);
  });

  it("groups sub-rule IDs of a single custom check into one scoring entry", () => {
    const issues: ReactDoctorIssue[] = [];
    const subRuleIds = [
      "unused-file",
      "unused-export",
      "unused-type-export",
      "namespace-only-export",
      "duplicate-export",
      "unused-enum-member",
      "unused-class-member",
    ];
    for (const ruleId of subRuleIds) {
      for (let inner = 0; inner < 10; inner += 1) {
        issues.push(createDeadCodeIssue(ruleId, `src/dead-${ruleId}-${inner}.ts`));
      }
    }
    expect(calculateReactDoctorScore(issues).value).toBe(97);
  });

  it("keeps oxlint sub-rules scored independently", () => {
    const issues: ReactDoctorIssue[] = [
      createOxlintIssue("no-array-index-as-key", "src/list.tsx", 4),
      createOxlintIssue("no-fetch-in-effect", "src/widget.tsx", 9),
      createOxlintIssue("nextjs-no-img-element", "src/hero.tsx", 14),
    ];
    expect(calculateReactDoctorScore(issues).value).toBe(98);
  });

  it("keeps the perfect-score floor at zero for genuinely broken codebases", () => {
    const issues: ReactDoctorIssue[] = [];
    for (let ruleIndex = 0; ruleIndex < 200; ruleIndex += 1) {
      issues.push(createOxlintIssue(`rule-${ruleIndex}`, "src/file.tsx", ruleIndex));
    }
    expect(calculateReactDoctorScore(issues).value).toBe(0);
  });
});
