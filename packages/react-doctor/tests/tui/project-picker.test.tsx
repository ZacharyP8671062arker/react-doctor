import { describe, expect, it } from "vite-plus/test";
import { render } from "ink-testing-library";
import { ProjectPicker } from "../../src/tui/components/project-picker.js";
import { appReducer, buildInitialState } from "../../src/tui/store.js";
import type { AppState } from "../../src/tui/types.js";
import type { WorkspacePackage } from "../../src/types.js";
import { stripAnsi } from "./strip-ansi.js";

const SAMPLE_PACKAGES: WorkspacePackage[] = [
  { name: "ami", directory: "/repo/packages/ami" },
  { name: "admin", directory: "/repo/packages/admin" },
  { name: "docs", directory: "/repo/packages/docs" },
];

const advance = (
  initialState: AppState,
  ...actions: Parameters<typeof appReducer>[1][]
): AppState =>
  actions.reduce((accumulated, action) => appReducer(accumulated, action), initialState);

describe("ProjectPicker rendering", () => {
  it("renders every workspace package with its relative directory", () => {
    const { lastFrame } = render(
      <ProjectPicker rootDirectory="/repo" packages={SAMPLE_PACKAGES} cursorIndex={0} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Multiple React projects found");
    expect(frame).toContain("ami");
    expect(frame).toContain("packages/ami");
    expect(frame).toContain("admin");
    expect(frame).toContain("docs");
  });

  it("highlights the cursor row with a marker", () => {
    const { lastFrame } = render(
      <ProjectPicker rootDirectory="/repo" packages={SAMPLE_PACKAGES} cursorIndex={1} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    const lines = frame.split("\n");
    const cursorLine = lines.find((line) => line.includes("▸"));
    expect(cursorLine).toBeDefined();
    expect(cursorLine).toContain("admin");
    expect(cursorLine).not.toContain("ami");
  });

  it("renders the keyboard hint footer", () => {
    const { lastFrame } = render(
      <ProjectPicker rootDirectory="/repo" packages={SAMPLE_PACKAGES} cursorIndex={0} />,
    );
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("[↑↓]");
    expect(frame).toContain("scan this project");
    expect(frame).toContain("[q]");
  });
});

describe("project-picker reducer transitions", () => {
  it("starts with no selectedDirectory and an empty workspacePackages list", () => {
    const initial = buildInitialState("/repo");
    expect(initial.selectedDirectory).toBeNull();
    expect(initial.workspacePackages).toEqual([]);
    expect(initial.workspaceCursor).toBe(0);
  });

  it("set-workspace-packages stores discovered packages and resets the cursor", () => {
    const initial = buildInitialState("/repo");
    const next = appReducer(initial, {
      type: "set-workspace-packages",
      packages: SAMPLE_PACKAGES,
    });
    expect(next.workspacePackages).toEqual(SAMPLE_PACKAGES);
    expect(next.workspaceCursor).toBe(0);
  });

  it("navigate-workspace clamps to the available range", () => {
    const initial = appReducer(buildInitialState("/repo"), {
      type: "set-workspace-packages",
      packages: SAMPLE_PACKAGES,
    });
    const movedDownPastEnd = advance(initial, { type: "navigate-workspace", delta: 99 });
    expect(movedDownPastEnd.workspaceCursor).toBe(SAMPLE_PACKAGES.length - 1);
    const movedUpPastStart = advance(movedDownPastEnd, { type: "navigate-workspace", delta: -99 });
    expect(movedUpPastStart.workspaceCursor).toBe(0);
  });

  it("select-workspace sets selectedDirectory which gates scanning", () => {
    const initial = appReducer(buildInitialState("/repo"), {
      type: "set-workspace-packages",
      packages: SAMPLE_PACKAGES,
    });
    expect(initial.selectedDirectory).toBeNull();
    const picked = appReducer(initial, {
      type: "select-workspace",
      directory: SAMPLE_PACKAGES[1].directory,
    });
    expect(picked.selectedDirectory).toBe(SAMPLE_PACKAGES[1].directory);
  });
});
