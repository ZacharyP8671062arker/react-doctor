import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { isLikelyBuildEntry } from "../src/utils/is-likely-build-entry.js";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "react-doctor-build-entry-test-"));

afterAll(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

const setupProjectWithDist = (
  caseId: string,
  files: { sources?: string[]; builtArtifacts?: string[] } = {},
): string => {
  const projectDir = path.join(tempDirectory, caseId);
  for (const sourcePath of files.sources ?? []) {
    const fullPath = path.join(projectDir, sourcePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, "// source");
  }
  for (const artifactPath of files.builtArtifacts ?? []) {
    const fullPath = path.join(projectDir, artifactPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, "// built");
  }
  return projectDir;
};

describe("isLikelyBuildEntry", () => {
  it("matches src/cli.ts to dist/cli.js", () => {
    const projectDir = setupProjectWithDist("cli-dist-js", {
      sources: ["src/cli.ts"],
      builtArtifacts: ["dist/cli.js"],
    });
    expect(isLikelyBuildEntry("src/cli.ts", projectDir)).toBe(true);
  });

  it("matches the user-reported worker entries (`src/worker/worker.ts` ↔ `dist/worker/worker.js`)", () => {
    const projectDir = setupProjectWithDist("workers", {
      sources: ["src/worker/worker.ts", "src/worker/worker-portable.ts"],
      builtArtifacts: ["dist/worker/worker.js", "dist/worker/worker-portable.js"],
    });
    expect(isLikelyBuildEntry("src/worker/worker.ts", projectDir)).toBe(true);
    expect(isLikelyBuildEntry("src/worker/worker-portable.ts", projectDir)).toBe(true);
  });

  it("matches across all common build directories and extensions", () => {
    const projectDir = setupProjectWithDist("multi-build-dirs", {
      sources: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts", "src/f.ts", "src/g.ts"],
      builtArtifacts: [
        "dist/a.js",
        "build/b.js",
        "lib/c.js",
        "out/d.js",
        "esm/e.mjs",
        "cjs/f.cjs",
        "dist/g.mjs",
      ],
    });
    for (const sourceFile of ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts", "g.ts"]) {
      expect(isLikelyBuildEntry(`src/${sourceFile}`, projectDir)).toBe(true);
    }
  });

  it("returns false when no matching artifact exists in any build dir", () => {
    const projectDir = setupProjectWithDist("no-built-output", {
      sources: ["src/orphan.ts"],
      builtArtifacts: [],
    });
    expect(isLikelyBuildEntry("src/orphan.ts", projectDir)).toBe(false);
  });

  it("returns false when artifact path differs from source path", () => {
    const projectDir = setupProjectWithDist("path-mismatch", {
      sources: ["src/feature/utility.ts"],
      builtArtifacts: ["dist/utility.js"],
    });
    expect(isLikelyBuildEntry("src/feature/utility.ts", projectDir)).toBe(false);
  });

  it("handles top-level files (no `src/` prefix) like `cli.ts` at the root", () => {
    const projectDir = setupProjectWithDist("flat-cli", {
      sources: ["cli.ts"],
      builtArtifacts: ["dist/cli.js"],
    });
    expect(isLikelyBuildEntry("cli.ts", projectDir)).toBe(true);
  });

  it("does NOT match nested top-level files outside src/ (avoids overreach)", () => {
    const projectDir = setupProjectWithDist("nested-top-level", {
      sources: ["scripts/build.ts"],
      builtArtifacts: ["dist/scripts/build.js"],
    });
    expect(isLikelyBuildEntry("scripts/build.ts", projectDir)).toBe(false);
  });

  it("returns false for source files without a recognizable JS/TS extension", () => {
    const projectDir = setupProjectWithDist("no-extension", {
      sources: ["src/data.json"],
      builtArtifacts: ["dist/data.json"],
    });
    expect(isLikelyBuildEntry("src/data.json", projectDir)).toBe(false);
  });

  it("normalizes Windows-style backslashes in the source path", () => {
    const projectDir = setupProjectWithDist("windows-style-paths", {
      sources: ["src/cli.ts"],
      builtArtifacts: ["dist/cli.js"],
    });
    expect(isLikelyBuildEntry("src\\cli.ts", projectDir)).toBe(true);
  });
});
