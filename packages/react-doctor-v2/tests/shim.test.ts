import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { diagnose as diagnoseFromMainSdk } from "../src/sdk/index.js";
import { diagnose } from "../src/sdk/compat.js";

describe("deprecated API shim", () => {
  it("maps diagnose() to the advanced SDK result", async () => {
    const result = await diagnose("src");

    expect(result).toEqual({
      diagnostics: [],
      score: {
        score: 100,
        label: "Great",
      },
      project: {
        rootDirectory: path.resolve("src"),
        projectName: "react-doctor-v2",
        reactVersion: null,
        tailwindVersion: expect.anything(),
        framework: "unknown",
        hasTypeScript: true,
        hasReactCompiler: false,
        hasTanStackQuery: false,
        sourceFileCount: expect.any(Number),
      },
      elapsedMilliseconds: expect.any(Number),
    });
  });

  it("exports diagnose() alongside the main SDK", async () => {
    const result = await diagnoseFromMainSdk("src");

    expect(result.project.rootDirectory).toBe(path.resolve("src"));
  });
});
