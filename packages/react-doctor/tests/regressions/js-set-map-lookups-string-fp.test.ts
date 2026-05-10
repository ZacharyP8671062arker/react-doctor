import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { collectRuleHits, setupReactProject } from "./_helpers.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rd-js-set-map-string-fp-"));

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("js-set-map-lookups: string-receiver false-positive freedom", () => {
  it("does NOT flag indexOf on a string identifier named like a string (`contents`)", async () => {
    // Reported on @pierre/diffs:
    //   const contents: string = ...
    //   const newlinePos = contents.indexOf('\n', linePos)
    // Substring search on a string can't be rewritten as a Set lookup;
    // the rule must skip when the receiver is named like a string.
    const projectDir = setupReactProject(tempRoot, "string-id-indexOf", {
      files: {
        "src/scan.ts": `export const scan = (contents: string, fromIndex: number): number[] => {
  const positions: number[] = [];
  let cursor = fromIndex;
  while (cursor < contents.length) {
    const next = contents.indexOf("\\n", cursor);
    if (next === -1) break;
    positions.push(next);
    cursor = next + 1;
  }
  return positions;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag includes on `Element.textContent` (DOM string property)", async () => {
    // Reported on @pierre/diffs (test util):
    //   if (style?.textContent?.includes(expected) === true) { ... }
    // textContent is statically typed as string | undefined; this is
    // substring search, not array membership.
    const projectDir = setupReactProject(tempRoot, "textContent-includes", {
      files: {
        "src/wait-for-style.ts": `export const waitForStyle = async (
  selector: string,
  expected: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const style = document.querySelector(selector);
    if (style?.textContent?.includes(expected) === true) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(\`Timed out waiting for \${expected}\`);
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag includes on a string literal receiver", async () => {
    const projectDir = setupReactProject(tempRoot, "string-literal-includes", {
      files: {
        "src/check.ts": `export const checkLetters = (letters: string[]): number => {
  let matches = 0;
  for (const letter of letters) {
    if ("aeiou".includes(letter)) matches++;
  }
  return matches;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag includes on a `.toLowerCase()` chain (string-returning method)", async () => {
    const projectDir = setupReactProject(tempRoot, "toLowerCase-includes", {
      files: {
        "src/filter.ts": `export const filterByQuery = (titles: string[], query: string): string[] => {
  const matches: string[] = [];
  for (const title of titles) {
    if (title.toLowerCase().includes(query.toLowerCase())) matches.push(title);
  }
  return matches;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag includes on a `String(...)` cast", async () => {
    const projectDir = setupReactProject(tempRoot, "String-cast-includes", {
      files: {
        "src/check.ts": `export const includesIdMarker = (values: unknown[]): number => {
  let matches = 0;
  for (const value of values) {
    if (String(value).includes("id-")) matches++;
  }
  return matches;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag includes on a template literal receiver", async () => {
    const projectDir = setupReactProject(tempRoot, "template-literal-includes", {
      files: {
        "src/check.ts": `export const checkPrefix = (ids: string[], prefix: string): number => {
  let count = 0;
  for (const id of ids) {
    if (\`prefix-\${id}\`.includes(prefix)) count++;
  }
  return count;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });

  it("STILL flags array.includes() on an array variable (the real perf case)", async () => {
    const projectDir = setupReactProject(tempRoot, "array-still-flagged", {
      files: {
        "src/filter.ts": `export const filterAllowed = (items: string[]): string[] => {
  const allowed = ["alpha", "beta", "gamma"];
  const result: string[] = [];
  for (const item of items) {
    if (allowed.includes(item)) result.push(item);
  }
  return result;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("STILL flags array.indexOf() on an array variable", async () => {
    const projectDir = setupReactProject(tempRoot, "array-indexOf-flagged", {
      files: {
        "src/positions.ts": `export const positions = (items: string[], targets: string[]): number[] => {
  const indices: number[] = [];
  for (const target of targets) {
    indices.push(items.indexOf(target));
  }
  return indices;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag includes on optional-chained DOM string property (`style?.textContent?.includes(...)`)", async () => {
    // Verifies that the ChainExpression wrapper isn't blocking the
    // string-receiver detection — the AST shape oxlint produces for
    // `a?.b?.c.includes(x)` puts a ChainExpression around the whole
    // member chain.
    const projectDir = setupReactProject(tempRoot, "optional-chain-includes", {
      files: {
        "src/check.ts": `export const checkInner = (root: Element | null, expected: string): boolean => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const inner = root?.querySelector("span");
    if (inner?.textContent?.includes(expected) === true) return true;
  }
  return false;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "js-set-map-lookups");
    expect(hits).toHaveLength(0);
  });
});
