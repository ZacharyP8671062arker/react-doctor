import path from "node:path";
import { render } from "ink";
import {
  detectNonInteractiveEnvironment,
  type NonInteractiveDetection,
} from "../utils/is-non-interactive-environment.js";
import { App } from "./app.js";

export interface RunTuiOptions {
  directory: string;
  watch?: boolean;
  review?: boolean;
  project?: string;
}

interface TuiPreflightResult {
  ok: boolean;
  reason?: string;
  hint?: string;
}

const checkTuiPreflight = (
  envSource: NodeJS.ProcessEnv = process.env,
  isStdoutTty: boolean = Boolean(process.stdout.isTTY),
  isStdinTty: boolean = Boolean(process.stdin.isTTY),
): TuiPreflightResult => {
  if (!isStdoutTty || !isStdinTty) {
    return {
      ok: false,
      reason: "no interactive TTY (stdin or stdout is not a terminal)",
      hint: "Run `react-doctor tui` from a real terminal, or use `react-doctor` for non-interactive output.",
    };
  }
  const detection: NonInteractiveDetection = detectNonInteractiveEnvironment(envSource);
  if (detection.isNonInteractive) {
    return {
      ok: false,
      reason: `agent / CI environment detected (${detection.triggeringEnvVar} is set)`,
      hint: "The interactive TUI is disabled in coding-agent and CI sessions. Use `react-doctor` for non-interactive output, or `react-doctor --json` for a parseable report.",
    };
  }
  return { ok: true };
};

const writePreflightFailure = (preflight: TuiPreflightResult): void => {
  process.stderr.write(`react-doctor tui: ${preflight.reason ?? "preflight failed"}.\n`);
  if (preflight.hint) process.stderr.write(`${preflight.hint}\n`);
};

export { checkTuiPreflight };

export const runTui = async (options: RunTuiOptions): Promise<void> => {
  const preflight = checkTuiPreflight();
  if (!preflight.ok) {
    writePreflightFailure(preflight);
    process.exitCode = 1;
    return;
  }
  const initialMode = options.review ? "review" : "dashboard";
  const renderInstance = render(
    <App
      rootDirectory={path.resolve(options.directory)}
      initialMode={initialMode}
      startWatching={Boolean(options.watch)}
      preselectedProject={options.project}
    />,
    {
      exitOnCtrlC: false,
      // HACK: alternate screen buffer is the same mechanism vim / htop / less
      // use. Without it, Ink renders in the primary buffer, and when the
      // dashboard grows between frames (initial scanning state -> populated
      // results) the previous shorter frame can leave residue scrolled up
      // out of the redraw region. Alternate screen guarantees clean
      // in-place updates and restores the user's terminal contents on exit.
      alternateScreen: true,
    },
  );
  await renderInstance.waitUntilExit();
};
