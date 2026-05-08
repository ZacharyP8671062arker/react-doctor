import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vite-plus/test";
import { copyToClipboard } from "../../src/tui/utils/copy-to-clipboard.js";

interface FakeChildEvents {
  exitCode: number;
  emitErrorImmediately?: boolean;
}

const buildFakeChild = (childBehavior: FakeChildEvents) => {
  const childEmitter = new EventEmitter();
  const stdinEmitter = new EventEmitter() as EventEmitter & {
    end: (data?: string) => void;
  };
  stdinEmitter.end = () => {
    if (childBehavior.emitErrorImmediately) {
      setImmediate(() => childEmitter.emit("error", new Error("ENOENT")));
      return;
    }
    setImmediate(() => childEmitter.emit("close", childBehavior.exitCode));
  };
  return Object.assign(childEmitter, { stdin: stdinEmitter });
};

describe("copyToClipboard", () => {
  it("uses pbcopy on darwin and reports the command it succeeded with", async () => {
    const spawnImpl = vi.fn(() =>
      buildFakeChild({ exitCode: 0 }),
    ) as unknown as typeof import("node:child_process").spawn;
    const result = await copyToClipboard("hello", { spawnImpl, platform: "darwin" });
    expect(result.ok).toBe(true);
    expect(result.via).toBe("pbcopy");
    expect(spawnImpl).toHaveBeenCalledWith("pbcopy", [], expect.any(Object));
  });

  it("uses clip on win32", async () => {
    const spawnImpl = vi.fn(() =>
      buildFakeChild({ exitCode: 0 }),
    ) as unknown as typeof import("node:child_process").spawn;
    const result = await copyToClipboard("hello", { spawnImpl, platform: "win32" });
    expect(result.ok).toBe(true);
    expect(result.via).toBe("clip");
  });

  it("falls through linux candidates when the first command isn't available", async () => {
    const calls: string[] = [];
    const spawnImpl = vi.fn((command: string) => {
      calls.push(command);
      if (command === "wl-copy" || command === "xclip") {
        return buildFakeChild({ exitCode: 1, emitErrorImmediately: true });
      }
      return buildFakeChild({ exitCode: 0 });
    }) as unknown as typeof import("node:child_process").spawn;
    const result = await copyToClipboard("hello", { spawnImpl, platform: "linux" });
    expect(result.ok).toBe(true);
    expect(result.via).toBe("xsel");
    expect(calls).toEqual(["wl-copy", "xclip", "xsel"]);
  });

  it("falls back to writing a tmp file when no clipboard command exists", async () => {
    const spawnImpl = vi.fn(() =>
      buildFakeChild({ exitCode: 1, emitErrorImmediately: true }),
    ) as unknown as typeof import("node:child_process").spawn;
    const writeFileImpl = vi.fn(
      () => undefined,
    ) as unknown as typeof import("node:fs").writeFileSync;
    const tmpDirImpl = () => "/tmp";
    const result = await copyToClipboard("hello", {
      spawnImpl,
      platform: "linux",
      tmpDirImpl,
      writeFileImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.fallbackPath).toMatch(/^\/tmp\/react-doctor-issue-\d+\.md$/);
    expect(writeFileImpl).toHaveBeenCalledTimes(1);
  });

  it("returns an error result when the platform has no commands and the file write also fails", async () => {
    const spawnImpl = vi.fn() as unknown as typeof import("node:child_process").spawn;
    const writeFileImpl = vi.fn(() => {
      throw new Error("disk full");
    }) as unknown as typeof import("node:fs").writeFileSync;
    const result = await copyToClipboard("hello", {
      spawnImpl,
      platform: "freebsd" as NodeJS.Platform,
      tmpDirImpl: () => "/tmp",
      writeFileImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("disk full");
  });
});
