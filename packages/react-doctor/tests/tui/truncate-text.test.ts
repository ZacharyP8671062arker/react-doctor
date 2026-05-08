import { describe, expect, it } from "vite-plus/test";
import { truncateText } from "../../src/tui/utils/truncate-text.js";
import { truncatePath } from "../../src/tui/utils/truncate-path.js";

describe("truncateText", () => {
  it("returns the original text when it already fits", () => {
    expect(truncateText("hello", 10)).toBe("hello");
    expect(truncateText("hello", 5)).toBe("hello");
  });

  it("appends an ellipsis when the text exceeds the budget", () => {
    expect(truncateText("hello world", 8)).toBe("hello w…");
  });

  it("returns just an ellipsis at width 1", () => {
    expect(truncateText("anything", 1)).toBe("…");
  });

  it("returns an empty string for non-positive widths", () => {
    expect(truncateText("hello", 0)).toBe("");
    expect(truncateText("hello", -3)).toBe("");
  });
});

describe("truncatePath", () => {
  it("returns the path unchanged when it already fits", () => {
    expect(truncatePath("src/App.tsx:14", 30)).toBe("src/App.tsx:14");
  });

  it("preserves the file-name tail and middle-truncates the prefix", () => {
    const longPath = "packages/react-doctor/tests/fixtures/basic-react/src/design-issues.tsx:128";
    const truncated = truncatePath(longPath, 50);
    expect(truncated.length).toBe(50);
    expect(truncated.endsWith("/design-issues.tsx:128")).toBe(true);
    expect(truncated.startsWith("…")).toBe(true);
  });

  it("falls back to end-truncation when the tail itself is wider than the budget", () => {
    const truncated = truncatePath("a/very-very-long-file-name-here.tsx:42", 16);
    expect(truncated.length).toBe(16);
    expect(truncated.endsWith("…")).toBe(true);
  });

  it("returns end-truncation for paths without slashes", () => {
    expect(truncatePath("config.json", 6)).toBe("confi…");
  });
});
