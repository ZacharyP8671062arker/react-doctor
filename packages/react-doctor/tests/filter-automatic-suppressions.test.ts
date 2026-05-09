import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { filterAutomaticSuppressions } from "../src/utils/filter-automatic-suppressions.js";
import type { Diagnostic } from "../src/types.js";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "react-doctor-auto-suppress-test-"));

afterAll(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

const buildDiagnostic = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  filePath: "src/components/Foo.tsx",
  plugin: "react-doctor",
  rule: "no-array-index-as-key",
  severity: "warning",
  message: "Avoid index as key",
  help: "",
  line: 10,
  column: 1,
  category: "Correctness",
  ...overrides,
});

describe("filterAutomaticSuppressions", () => {
  describe("test-file rule scoping", () => {
    it("drops a noise-rule diagnostic that fires inside a test file", () => {
      const diagnostics = [
        buildDiagnostic({
          filePath: "src/components/__tests__/Foo.test.tsx",
          rule: "no-array-index-as-key",
        }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, tempDirectory, null)).toEqual([]);
    });

    it("keeps a noise-rule diagnostic that fires in production source", () => {
      const diagnostics = [
        buildDiagnostic({ filePath: "src/components/Foo.tsx", rule: "no-array-index-as-key" }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, tempDirectory, null)).toHaveLength(1);
    });

    it("keeps correctness rules (not in the test-noise set) in test files", () => {
      const diagnostics = [
        buildDiagnostic({
          filePath: "src/components/Foo.test.tsx",
          plugin: "react",
          rule: "rules-of-hooks",
        }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, tempDirectory, null)).toHaveLength(1);
    });

    it("respects `suppressNoiseRulesInTestFiles: false` from user config", () => {
      const diagnostics = [
        buildDiagnostic({
          filePath: "src/components/Foo.test.tsx",
          rule: "no-array-index-as-key",
        }),
      ];
      expect(
        filterAutomaticSuppressions(diagnostics, tempDirectory, {
          suppressNoiseRulesInTestFiles: false,
        }),
      ).toHaveLength(1);
    });

    it("drops noise rules in `.stories.tsx` files (Storybook fixtures)", () => {
      const diagnostics = [
        buildDiagnostic({
          filePath: "src/components/Button.stories.tsx",
          rule: "no-many-boolean-props",
        }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, tempDirectory, null)).toEqual([]);
    });
  });

  describe("build-entry dead-code suppression", () => {
    const setupProject = (
      caseId: string,
      builtArtifacts: string[],
    ): { projectDir: string; absoluteSrcPath: string } => {
      const projectDir = path.join(tempDirectory, caseId);
      fs.mkdirSync(path.join(projectDir, "src", "worker"), { recursive: true });
      fs.writeFileSync(path.join(projectDir, "src", "worker", "worker.ts"), "// source");
      for (const artifactPath of builtArtifacts) {
        const fullPath = path.join(projectDir, artifactPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, "// built");
      }
      return { projectDir, absoluteSrcPath: path.join(projectDir, "src", "worker", "worker.ts") };
    };

    it("drops a `knip/files` diagnostic when a matching dist artifact exists", () => {
      const { projectDir, absoluteSrcPath } = setupProject("with-dist-worker", [
        "dist/worker/worker.js",
      ]);
      const diagnostics = [
        buildDiagnostic({
          filePath: absoluteSrcPath,
          plugin: "knip",
          rule: "files",
          category: "Dead Code",
          line: 0,
          column: 0,
        }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, projectDir, null)).toEqual([]);
    });

    it("keeps `knip/files` when the source has no matching built artifact", () => {
      const { projectDir, absoluteSrcPath } = setupProject("no-dist-worker", []);
      const diagnostics = [
        buildDiagnostic({
          filePath: absoluteSrcPath,
          plugin: "knip",
          rule: "files",
          category: "Dead Code",
          line: 0,
          column: 0,
        }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, projectDir, null)).toHaveLength(1);
    });

    it("does NOT touch other knip rules even when a dist artifact exists", () => {
      const { projectDir, absoluteSrcPath } = setupProject("dist-but-other-knip-rule", [
        "dist/worker/worker.js",
      ]);
      const diagnostics = [
        buildDiagnostic({
          filePath: absoluteSrcPath,
          plugin: "knip",
          rule: "exports",
          category: "Dead Code",
          line: 0,
          column: 0,
        }),
      ];
      expect(filterAutomaticSuppressions(diagnostics, projectDir, null)).toHaveLength(1);
    });

    it("respects `suppressDeadCodeForBuildEntries: false` from user config", () => {
      const { projectDir, absoluteSrcPath } = setupProject("opt-out-build-entry", [
        "dist/worker/worker.js",
      ]);
      const diagnostics = [
        buildDiagnostic({
          filePath: absoluteSrcPath,
          plugin: "knip",
          rule: "files",
          category: "Dead Code",
          line: 0,
          column: 0,
        }),
      ];
      expect(
        filterAutomaticSuppressions(diagnostics, projectDir, {
          suppressDeadCodeForBuildEntries: false,
        }),
      ).toHaveLength(1);
    });
  });

  it("returns the input array untouched when both suppressions are disabled (fast path)", () => {
    const diagnostics = [
      buildDiagnostic({
        filePath: "src/components/Foo.test.tsx",
        rule: "no-array-index-as-key",
      }),
    ];
    expect(
      filterAutomaticSuppressions(diagnostics, tempDirectory, {
        suppressNoiseRulesInTestFiles: false,
        suppressDeadCodeForBuildEntries: false,
      }),
    ).toBe(diagnostics);
  });
});
