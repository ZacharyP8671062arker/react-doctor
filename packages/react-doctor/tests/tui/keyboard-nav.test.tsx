import { Box, useInput } from "ink";
import { render } from "ink-testing-library";
import { useReducer, useRef, type ReactElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import { appReducer, buildInitialState } from "../../src/tui/store.js";
import type { AppState } from "../../src/tui/types.js";

const ARROW_UP = "\u001B[A";
const ARROW_DOWN = "\u001B[B";
const ARROW_LEFT = "\u001B[D";
const ARROW_RIGHT = "\u001B[C";
const ENTER = "\r";
// HACK: a bare \x1B can be interpreted as the start of an ANSI sequence by Ink's
// keypress parser; double-escape (\x1B\x1B) is the canonical "escape pressed"
// byte sequence in parseKeypress (see ink/parse-keypress.js).
const ESC = "\u001B\u001B";

interface KeyboardHarnessProps {
  initialState: AppState;
  onState: (state: AppState) => void;
  mode: "review" | "picker" | "help";
}

const KeyboardHarness = ({ initialState, onState, mode }: KeyboardHarnessProps): ReactElement => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  onState(state);

  useInput((rawInput, key) => {
    const currentState = stateRef.current;

    if (mode === "help" && currentState.helpVisible) {
      if (key.escape || rawInput === "?") {
        dispatch({ type: "toggle-help" });
        return;
      }
      return;
    }

    if (mode === "picker") {
      if (key.upArrow || rawInput === "k") {
        dispatch({ type: "navigate-workspace", delta: -1 });
        return;
      }
      if (key.downArrow || rawInput === "j") {
        dispatch({ type: "navigate-workspace", delta: 1 });
        return;
      }
      if (key.return) {
        const chosen = currentState.workspacePackages[currentState.workspaceCursor];
        if (chosen) dispatch({ type: "select-workspace", directory: chosen.directory });
      }
      return;
    }

    if (mode === "review") {
      if (key.upArrow || rawInput === "k") {
        dispatch({ type: "navigate-rule", delta: -1 });
        return;
      }
      if (key.downArrow || rawInput === "j") {
        dispatch({ type: "navigate-rule", delta: 1 });
        return;
      }
      if (key.leftArrow || rawInput === "h") {
        dispatch({ type: "navigate-site", delta: -1 });
        return;
      }
      if (key.rightArrow || rawInput === "l") {
        dispatch({ type: "navigate-site", delta: 1 });
        return;
      }
    }
  });

  return <Box />;
};

const buildReviewState = (): AppState => {
  const baseState = buildInitialState("/repo");
  return {
    ...baseState,
    groupedRules: [
      {
        ruleKey: "react-doctor/rule-a",
        plugin: "react-doctor",
        rule: "rule-a",
        severity: "error",
        category: "performance",
        message: "",
        help: "",
        diagnostics: [
          {
            filePath: "/repo/a.tsx",
            plugin: "react-doctor",
            rule: "rule-a",
            severity: "error",
            message: "",
            help: "",
            line: 1,
            column: 1,
            category: "performance",
          },
          {
            filePath: "/repo/a.tsx",
            plugin: "react-doctor",
            rule: "rule-a",
            severity: "error",
            message: "",
            help: "",
            line: 2,
            column: 1,
            category: "performance",
          },
        ],
      },
      {
        ruleKey: "react-doctor/rule-b",
        plugin: "react-doctor",
        rule: "rule-b",
        severity: "warning",
        category: "performance",
        message: "",
        help: "",
        diagnostics: [
          {
            filePath: "/repo/b.tsx",
            plugin: "react-doctor",
            rule: "rule-b",
            severity: "warning",
            message: "",
            help: "",
            line: 5,
            column: 1,
            category: "performance",
          },
        ],
      },
    ],
  };
};

const buildPickerState = (): AppState => ({
  ...buildInitialState("/repo"),
  workspacePackages: [
    { name: "ami", directory: "/repo/packages/ami" },
    { name: "admin", directory: "/repo/packages/admin" },
    { name: "docs", directory: "/repo/packages/docs" },
  ],
});

const captureLatest = () => {
  let latest: AppState | null = null;
  return {
    onState: (state: AppState) => {
      latest = state;
    },
    getLatest: (): AppState => {
      if (!latest) throw new Error("state never captured");
      return latest;
    },
  };
};

describe("review-mode arrow nav", () => {
  it("arrow down advances the rule cursor and arrow up moves it back", async () => {
    const capture = captureLatest();
    const { stdin } = render(
      <KeyboardHarness mode="review" initialState={buildReviewState()} onState={capture.onState} />,
    );
    stdin.write(ARROW_DOWN);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().selectedRuleIndex).toBe(1);
    stdin.write(ARROW_UP);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().selectedRuleIndex).toBe(0);
  });

  it("j and k mirror arrow down / arrow up", async () => {
    const capture = captureLatest();
    const { stdin } = render(
      <KeyboardHarness mode="review" initialState={buildReviewState()} onState={capture.onState} />,
    );
    stdin.write("j");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().selectedRuleIndex).toBe(1);
    stdin.write("k");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().selectedRuleIndex).toBe(0);
  });

  it("arrow right advances site index within a rule, arrow left walks back", async () => {
    const capture = captureLatest();
    const { stdin } = render(
      <KeyboardHarness mode="review" initialState={buildReviewState()} onState={capture.onState} />,
    );
    stdin.write(ARROW_RIGHT);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().selectedSiteIndex).toBe(1);
    stdin.write(ARROW_LEFT);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().selectedSiteIndex).toBe(0);
  });
});

describe("project picker arrow nav", () => {
  it("arrow down moves the workspace cursor and arrow up reverses it", async () => {
    const capture = captureLatest();
    const { stdin } = render(
      <KeyboardHarness mode="picker" initialState={buildPickerState()} onState={capture.onState} />,
    );
    stdin.write(ARROW_DOWN);
    stdin.write(ARROW_DOWN);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().workspaceCursor).toBe(2);
    stdin.write(ARROW_UP);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(capture.getLatest().workspaceCursor).toBe(1);
  });

  it("enter selects the package at the current cursor", async () => {
    const capture = captureLatest();
    const { stdin } = render(
      <KeyboardHarness mode="picker" initialState={buildPickerState()} onState={capture.onState} />,
    );
    stdin.write(ARROW_DOWN);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(capture.getLatest().workspaceCursor).toBe(1);
    stdin.write(ENTER);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(capture.getLatest().selectedDirectory).toBe("/repo/packages/admin");
  });
});

describe("help overlay close behaviour", () => {
  it("escape closes the help overlay", async () => {
    const capture = captureLatest();
    const initial: AppState = { ...buildInitialState("/repo"), helpVisible: true };
    const { stdin } = render(
      <KeyboardHarness mode="help" initialState={initial} onState={capture.onState} />,
    );
    expect(capture.getLatest().helpVisible).toBe(true);
    stdin.write(ESC);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(capture.getLatest().helpVisible).toBe(false);
  });

  it("? also toggles the help overlay closed", async () => {
    const capture = captureLatest();
    const initial: AppState = { ...buildInitialState("/repo"), helpVisible: true };
    const { stdin } = render(
      <KeyboardHarness mode="help" initialState={initial} onState={capture.onState} />,
    );
    expect(capture.getLatest().helpVisible).toBe(true);
    stdin.write("?");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(capture.getLatest().helpVisible).toBe(false);
  });
});
