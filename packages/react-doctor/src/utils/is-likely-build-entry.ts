import fs from "node:fs";
import path from "node:path";

// HACK: knip flags a source file as unused when no other source file
// imports it — but library entry points (CLI scripts, web/service
// workers, additional bundle entries) are imported by the BUILD
// process, not by other source files. They land in the dist tree
// under a matching path, get referenced from package.json
// `exports`/`main`/`module`/`bin`, and ship to consumers — so
// flagging them as dead code is a false positive.
//
// We detect this by checking, for each unused-source-file diagnostic,
// whether a matching artifact exists under any of the common build
// output directories (`dist`, `build`, `lib`, `out`, `esm`, `cjs`).
// "Matching" means: same path under the build dir as under `src/`,
// with the source extension swapped for a built one (`.js`, `.mjs`,
// `.cjs`).
//
// Examples (all suppressed when the build artifact is present):
//   src/cli.ts                    ↔ dist/cli.js
//   src/worker/worker.ts          ↔ dist/worker/worker.js
//   src/worker/worker-portable.ts ↔ build/worker/worker-portable.mjs
//
// Trade-offs:
//   - Requires the project to have been built. Pre-build, every
//     entry would still be flagged. We accept this — `npx
//     react-doctor` is most often run after install (and post-install
//     `prepare` scripts are routine for libraries).
//   - Doesn't cover non-standard dist directories. The list below
//     is the de-facto convention; users with exotic outputs can fall
//     back to `react-doctor.config.json` overrides.
//   - We don't try to verify the dist file actually re-exports the
//     source — only that a path-matching artifact exists. Conservative
//     in the right direction: false negatives (flagging a real dead
//     file even though there's a coincidental dist artifact) are
//     vanishingly rare; false positives (flagging a real entry) are
//     the user-facing pain we're fixing.
const BUILD_OUTPUT_DIRECTORIES = ["dist", "build", "lib", "out", "esm", "cjs"];
const BUILD_OUTPUT_EXTENSIONS = ["js", "mjs", "cjs"];
const SOURCE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

const stripSourcePrefix = (relativePath: string): string | null => {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  // Match either `src/<rest>` or just a top-level file (`cli.ts`,
  // `index.ts`) — both shapes can be library entries.
  const srcMatch = normalized.match(/^src\/(.+)$/);
  return srcMatch ? srcMatch[1] : normalized.includes("/") ? null : normalized;
};

const buildOutputCandidates = (sourceRelativeTrunk: string): string[] => {
  const trunkWithoutExtension = sourceRelativeTrunk.replace(SOURCE_EXTENSION_PATTERN, "");
  if (trunkWithoutExtension === sourceRelativeTrunk) return [];
  return BUILD_OUTPUT_DIRECTORIES.flatMap((outputDir) =>
    BUILD_OUTPUT_EXTENSIONS.map(
      (extension) => `${outputDir}/${trunkWithoutExtension}.${extension}`,
    ),
  );
};

export const isLikelyBuildEntry = (sourceRelativePath: string, rootDirectory: string): boolean => {
  const sourceTrunk = stripSourcePrefix(sourceRelativePath);
  if (!sourceTrunk) return false;
  return buildOutputCandidates(sourceTrunk).some((candidate) =>
    fs.existsSync(path.join(rootDirectory, candidate)),
  );
};
