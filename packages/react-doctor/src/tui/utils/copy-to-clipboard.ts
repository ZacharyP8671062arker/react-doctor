import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface ClipboardResult {
  ok: boolean;
  via?: string;
  fallbackPath?: string;
  error?: string;
}

interface CommandSpec {
  command: string;
  args: string[];
}

const COMMANDS_BY_PLATFORM: Record<string, CommandSpec[]> = {
  darwin: [{ command: "pbcopy", args: [] }],
  win32: [{ command: "clip", args: [] }],
  linux: [
    { command: "wl-copy", args: [] },
    { command: "xclip", args: ["-selection", "clipboard"] },
    { command: "xsel", args: ["-b", "-i"] },
  ],
};

interface CopyOptions {
  spawnImpl?: typeof spawn;
  platform?: NodeJS.Platform;
  tmpDirImpl?: () => string;
  writeFileImpl?: typeof writeFileSync;
}

const trySpawn = (spawnImpl: typeof spawn, spec: CommandSpec, data: string): Promise<boolean> =>
  new Promise((resolve) => {
    let didResolve = false;
    const settle = (success: boolean): void => {
      if (didResolve) return;
      didResolve = true;
      resolve(success);
    };
    try {
      const child = spawnImpl(spec.command, spec.args, {
        stdio: ["pipe", "ignore", "ignore"],
      });
      child.on("error", () => settle(false));
      child.on("close", (exitCode) => settle(exitCode === 0));
      if (child.stdin) {
        child.stdin.on("error", () => settle(false));
        child.stdin.end(data);
      } else {
        settle(false);
      }
    } catch {
      settle(false);
    }
  });

const writeFallbackFile = (
  text: string,
  tmpDirImpl: () => string,
  writeFileImpl: typeof writeFileSync,
): { fallbackPath?: string; error?: string } => {
  try {
    const fallbackPath = path.join(tmpDirImpl(), `react-doctor-issue-${Date.now()}.md`);
    writeFileImpl(fallbackPath, text, "utf8");
    return { fallbackPath };
  } catch (writeError) {
    return { error: (writeError as Error)?.message ?? "failed to write fallback file" };
  }
};

export const copyToClipboard = async (
  text: string,
  options: CopyOptions = {},
): Promise<ClipboardResult> => {
  const spawnImpl = options.spawnImpl ?? spawn;
  const platformKey = options.platform ?? process.platform;
  const tmpDirImpl = options.tmpDirImpl ?? tmpdir;
  const writeFileImpl = options.writeFileImpl ?? writeFileSync;

  const candidates = COMMANDS_BY_PLATFORM[platformKey] ?? [];
  for (const candidate of candidates) {
    const ok = await trySpawn(spawnImpl, candidate, text);
    if (ok) return { ok: true, via: candidate.command };
  }

  const fallback = writeFallbackFile(text, tmpDirImpl, writeFileImpl);
  if (fallback.fallbackPath) {
    return { ok: false, fallbackPath: fallback.fallbackPath };
  }
  return { ok: false, error: fallback.error ?? "no clipboard command available" };
};
