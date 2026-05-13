import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import {
  IGNORED_DIRECTORY_NAMES,
  PACKAGE_JSON_FILENAME,
  SOURCE_FILE_EXTENSIONS,
} from "./rules/codebase/analyzer/constants.js";
import { readPackageJson } from "./rules/codebase/analyzer/manifest.js";
import type { PackageJsonObject } from "./rules/codebase/analyzer/index.js";
import type { ReactDoctorOxlintFramework, ReactDoctorOxlintProjectInfo } from "./rules/index.js";
import type { ReactProjectFramework, ReactProjectInfo } from "./types.js";

interface DependencyInfo {
  reactVersion: string | null;
  reactPeerDependencyRange: string | null;
  tailwindVersion: string | null;
  framework: ReactProjectFramework;
  hasReactCompiler: boolean;
  hasTanStackAI: boolean;
  hasTanStackQuery: boolean;
}

interface PackageInfo {
  manifest: PackageJsonObject | null;
  packageJsonPath: string | null;
  catalogs: CatalogInfo;
}

interface SourceFileInfo {
  count: number;
  hasTypeScript: boolean;
}

interface CatalogInfo {
  defaultVersions: Map<string, string>;
  groupedVersions: Map<string, Map<string, string>>;
}

const FRAMEWORK_PACKAGES: Record<string, ReactProjectFramework> = {
  "@remix-run/react": "remix",
  "@tanstack/react-start": "tanstack-start",
  expo: "expo",
  gatsby: "gatsby",
  next: "nextjs",
  "react-native": "react-native",
  "react-scripts": "cra",
  vite: "vite",
};

const REACT_COMPILER_PACKAGES: ReadonlySet<string> = new Set([
  "babel-plugin-react-compiler",
  "eslint-plugin-react-compiler",
  "react-compiler-runtime",
]);

const REACT_COMPILER_PACKAGE_REFERENCE_PATTERN =
  /babel-plugin-react-compiler|react-compiler-runtime|eslint-plugin-react-compiler|["']react-compiler["']/;
const REACT_COMPILER_ENABLED_FLAG_PATTERN = /["']?reactCompiler["']?\s*:\s*(?:true\b|\{)/;

const NEXT_CONFIG_FILENAMES: ReadonlyArray<string> = [
  "next.config.cjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
];
const BABEL_CONFIG_FILENAMES: ReadonlyArray<string> = [
  ".babelrc",
  ".babelrc.json",
  "babel.config.cjs",
  "babel.config.js",
  "babel.config.json",
  "babel.config.mjs",
];
const VITE_CONFIG_FILENAMES: ReadonlyArray<string> = [
  "vite.config.cjs",
  "vite.config.cts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.mts",
  "vite.config.ts",
  "vitest.config.js",
  "vitest.config.ts",
];
const EXPO_CONFIG_FILENAMES: ReadonlyArray<string> = ["app.config.js", "app.config.ts", "app.json"];

const TANSTACK_AI_PACKAGES: ReadonlySet<string> = new Set([
  "@tanstack/ai",
  "@tanstack/ai-code-mode",
]);

const TANSTACK_QUERY_PACKAGES: ReadonlySet<string> = new Set([
  "@tanstack/query-core",
  "@tanstack/react-query",
  "react-query",
]);

const SOURCE_FILE_EXTENSION_SET: ReadonlySet<string> = new Set(SOURCE_FILE_EXTENSIONS);

const createEmptyCatalogInfo = (): CatalogInfo => ({
  defaultVersions: new Map(),
  groupedVersions: new Map(),
});

const isSourceFileName = (fileName: string): boolean =>
  SOURCE_FILE_EXTENSION_SET.has(path.extname(fileName));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const addCatalogVersions = (target: Map<string, string>, value: unknown): void => {
  if (!isRecord(value)) return;
  for (const [packageName, version] of Object.entries(value)) {
    if (typeof version === "string") target.set(packageName, version);
  }
};

const addGroupedCatalogVersions = (catalogs: CatalogInfo, value: unknown): void => {
  if (!isRecord(value)) return;
  for (const [catalogName, entries] of Object.entries(value)) {
    const versions = catalogs.groupedVersions.get(catalogName) ?? new Map<string, string>();
    addCatalogVersions(versions, entries);
    catalogs.groupedVersions.set(catalogName, versions);
  }
};

const mergeManifestCatalogs = (catalogs: CatalogInfo, manifest: PackageJsonObject | null): void => {
  if (!manifest) return;
  addCatalogVersions(catalogs.defaultVersions, manifest.catalog);
  addGroupedCatalogVersions(catalogs, manifest.catalogs);
  const workspaces: unknown = manifest.workspaces;
  if (isRecord(workspaces)) {
    addCatalogVersions(catalogs.defaultVersions, workspaces.catalog);
    addGroupedCatalogVersions(catalogs, workspaces.catalogs);
  }
};

const PNPM_WORKSPACE_FILENAME = "pnpm-workspace.yaml";

const stripYamlComment = (line: string): string => {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== "\\") {
      quote = quote === character ? null : (quote ?? character);
    }
    if (character === "#" && !quote) return line.slice(0, index);
  }
  return line;
};

const stripYamlValue = (value: string): string =>
  stripYamlComment(value)
    .trim()
    .replace(/^["']|["']$/g, "");

interface PnpmWorkspaceFile {
  patterns: string[];
  defaultCatalog: Map<string, string>;
  namedCatalogs: Map<string, Map<string, string>>;
}

const parsePnpmWorkspaceFile = (content: string): PnpmWorkspaceFile => {
  const result: PnpmWorkspaceFile = {
    patterns: [],
    defaultCatalog: new Map(),
    namedCatalogs: new Map(),
  };
  type Section = "none" | "packages" | "catalog" | "catalogs" | "named-catalog";
  let section: Section = "none";
  let currentCatalogName = "";

  for (const rawLine of content.split("\n")) {
    const line = stripYamlComment(rawLine);
    if (line.trim().length === 0) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0) {
      if (trimmed === "packages:") {
        section = "packages";
        continue;
      }
      if (trimmed === "catalog:") {
        section = "catalog";
        continue;
      }
      if (trimmed === "catalogs:") {
        section = "catalogs";
        continue;
      }
      // Flat-form list item ("packages:\n- apps/*") — stay in the
      // current section instead of resetting.
      if (trimmed.startsWith("-") && section === "packages") {
        const pattern = stripYamlValue(trimmed.slice(1));
        if (pattern) result.patterns.push(pattern);
        continue;
      }
      section = "none";
      continue;
    }

    if (section === "packages") {
      if (trimmed.startsWith("-")) {
        const pattern = stripYamlValue(trimmed.slice(1));
        if (pattern) result.patterns.push(pattern);
      }
      continue;
    }

    if (section === "catalog") {
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex > 0) {
        const key = stripYamlValue(trimmed.slice(0, colonIndex));
        const value = stripYamlValue(trimmed.slice(colonIndex + 1));
        if (key && value) result.defaultCatalog.set(key, value);
      }
      continue;
    }

    if (section === "catalogs") {
      if (trimmed.endsWith(":") && !trimmed.includes(" ")) {
        currentCatalogName = stripYamlValue(trimmed.slice(0, -1));
        result.namedCatalogs.set(currentCatalogName, new Map());
        section = "named-catalog";
      }
      continue;
    }

    if (section === "named-catalog") {
      if (indent <= 2 && trimmed.endsWith(":") && !trimmed.includes(" ")) {
        currentCatalogName = stripYamlValue(trimmed.slice(0, -1));
        result.namedCatalogs.set(currentCatalogName, new Map());
        continue;
      }
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex > 0 && currentCatalogName) {
        const key = stripYamlValue(trimmed.slice(0, colonIndex));
        const value = stripYamlValue(trimmed.slice(colonIndex + 1));
        if (key && value) {
          const catalog = result.namedCatalogs.get(currentCatalogName);
          if (catalog) catalog.set(key, value);
        }
      }
    }
  }

  return result;
};

const readPnpmWorkspaceFile = async (directory: string): Promise<PnpmWorkspaceFile | null> => {
  try {
    const content = await fs.readFile(path.join(directory, PNPM_WORKSPACE_FILENAME), "utf8");
    return parsePnpmWorkspaceFile(content);
  } catch {
    return null;
  }
};

const mergePnpmWorkspaceCatalogs = (catalogs: CatalogInfo, file: PnpmWorkspaceFile): void => {
  for (const [name, version] of file.defaultCatalog) {
    catalogs.defaultVersions.set(name, version);
  }
  for (const [catalogName, entries] of file.namedCatalogs) {
    const target = catalogs.groupedVersions.get(catalogName) ?? new Map<string, string>();
    for (const [name, version] of entries) target.set(name, version);
    catalogs.groupedVersions.set(catalogName, target);
  }
};

const collectAncestorCatalogs = async (rootDirectory: string): Promise<CatalogInfo> => {
  const catalogs = createEmptyCatalogInfo();
  let currentDirectory = rootDirectory;
  while (true) {
    mergeManifestCatalogs(catalogs, await readPackageJson(currentDirectory));
    const pnpmFile = await readPnpmWorkspaceFile(currentDirectory);
    if (pnpmFile) mergePnpmWorkspaceCatalogs(catalogs, pnpmFile);
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) return catalogs;
    currentDirectory = parentDirectory;
  }
};

const readNearestPackageInfo = async (rootDirectory: string): Promise<PackageInfo> => {
  const catalogs = await collectAncestorCatalogs(rootDirectory);
  let currentDirectory = rootDirectory;
  while (true) {
    const manifest = await readPackageJson(currentDirectory);
    if (manifest) {
      return {
        manifest,
        packageJsonPath: path.join(currentDirectory, PACKAGE_JSON_FILENAME),
        catalogs,
      };
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return { manifest: null, packageJsonPath: null, catalogs };
    }
    currentDirectory = parentDirectory;
  }
};

const collectDependencies = (manifest: PackageJsonObject | null): Map<string, string> =>
  new Map(
    [
      ...Object.entries(manifest?.peerDependencies ?? {}),
      ...Object.entries(manifest?.dependencies ?? {}),
      ...Object.entries(manifest?.devDependencies ?? {}),
      ...Object.entries(manifest?.optionalDependencies ?? {}),
    ].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );

const hasAnyDependency = (
  dependencies: ReadonlyMap<string, string>,
  packageNames: ReadonlySet<string>,
): boolean => {
  for (const packageName of packageNames) {
    if (dependencies.has(packageName)) return true;
  }
  return false;
};

const hasReactCompilerDependency = (manifest: PackageJsonObject | null): boolean =>
  hasAnyDependency(collectDependencies(manifest), REACT_COMPILER_PACKAGES);

const detectFramework = (dependencies: ReadonlyMap<string, string>): ReactProjectFramework => {
  for (const [packageName, framework] of Object.entries(FRAMEWORK_PACKAGES)) {
    if (dependencies.has(packageName)) return framework;
  }
  return dependencies.has("react") ? "react" : "unknown";
};

const toResolvedDependencyVersion = (
  packageName: string,
  version: string | null | undefined,
  catalogs: CatalogInfo,
): string | null => {
  if (!version) return null;
  if (version.startsWith("catalog:")) {
    const catalogName = version.slice("catalog:".length);
    if (!catalogName) return catalogs.defaultVersions.get(packageName) ?? null;
    return catalogs.groupedVersions.get(catalogName)?.get(packageName) ?? null;
  }
  if (version.startsWith("workspace:")) return null;
  return version;
};

export const parseReactMajorVersion = (version: string | null): number | null => {
  if (!version) return null;
  const match = version.match(/\d+/);
  if (!match) return null;
  return Number.parseInt(match[0], 10);
};

const getDependencyInfo = (packageInfo: PackageInfo): DependencyInfo => {
  const { catalogs, manifest } = packageInfo;
  const dependencies = collectDependencies(manifest);
  const reactVersion = toResolvedDependencyVersion("react", dependencies.get("react"), catalogs);
  return {
    reactVersion,
    reactPeerDependencyRange:
      typeof manifest?.peerDependencies?.react === "string"
        ? manifest.peerDependencies.react
        : null,
    tailwindVersion: toResolvedDependencyVersion(
      "tailwindcss",
      dependencies.get("tailwindcss"),
      catalogs,
    ),
    framework: detectFramework(dependencies),
    hasReactCompiler: hasReactCompilerDependency(manifest),
    hasTanStackAI: hasAnyDependency(dependencies, TANSTACK_AI_PACKAGES),
    hasTanStackQuery: hasAnyDependency(dependencies, TANSTACK_QUERY_PACKAGES),
  };
};

const readTextFile = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
};

const hasReactCompilerConfigText = (content: string): boolean =>
  REACT_COMPILER_ENABLED_FLAG_PATTERN.test(content) ||
  REACT_COMPILER_PACKAGE_REFERENCE_PATTERN.test(content);

const hasReactCompilerInConfigFiles = async (
  directory: string,
  filenames: ReadonlyArray<string>,
): Promise<boolean> => {
  for (const filename of filenames) {
    const content = await readTextFile(path.join(directory, filename));
    if (content && hasReactCompilerConfigText(content)) return true;
  }
  return false;
};

const hasReactCompilerInLocalConfig = async (directory: string): Promise<boolean> =>
  (await hasReactCompilerInConfigFiles(directory, NEXT_CONFIG_FILENAMES)) ||
  (await hasReactCompilerInConfigFiles(directory, BABEL_CONFIG_FILENAMES)) ||
  (await hasReactCompilerInConfigFiles(directory, VITE_CONFIG_FILENAMES)) ||
  (await hasReactCompilerInConfigFiles(directory, EXPO_CONFIG_FILENAMES));

const hasWorkspaceBoundary = (manifest: PackageJsonObject | null): boolean =>
  Boolean(manifest?.workspaces);

const hasDirectoryEntry = async (directory: string, entryName: string): Promise<boolean> => {
  try {
    await fs.access(path.join(directory, entryName));
    return true;
  } catch {
    return false;
  }
};

const hasReactCompilerInAncestorPackage = async (rootDirectory: string): Promise<boolean> => {
  let currentDirectory = path.dirname(rootDirectory);
  while (currentDirectory !== path.dirname(currentDirectory)) {
    const manifest = await readPackageJson(currentDirectory);
    if (hasReactCompilerDependency(manifest)) return true;
    if (hasWorkspaceBoundary(manifest) || (await hasDirectoryEntry(currentDirectory, ".git"))) {
      return false;
    }
    currentDirectory = path.dirname(currentDirectory);
  }
  return false;
};

const detectReactCompiler = async (
  rootDirectory: string,
  manifest: PackageJsonObject | null,
): Promise<boolean> => {
  if (hasReactCompilerDependency(manifest)) return true;
  if (await hasReactCompilerInLocalConfig(rootDirectory)) return true;
  return hasReactCompilerInAncestorPackage(rootDirectory);
};

const collectSourceFileInfo = async (rootDirectory: string): Promise<SourceFileInfo> => {
  const sourceFileInfo: SourceFileInfo = {
    count: 0,
    hasTypeScript: false,
  };
  const directories = [rootDirectory];

  while (directories.length > 0) {
    const directory = directories.pop();
    if (!directory) continue;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          directories.push(path.join(directory, entry.name));
        }
        continue;
      }
      if (entry.isFile() && isSourceFileName(entry.name)) {
        sourceFileInfo.count++;
        sourceFileInfo.hasTypeScript ||= /\.(cts|mts|ts|tsx)$/.test(entry.name);
      }
    }
  }

  return sourceFileInfo;
};

export const toOxlintProjectInfo = (project: ReactProjectInfo): ReactDoctorOxlintProjectInfo => {
  const framework: ReactDoctorOxlintFramework =
    project.framework === "nextjs" ||
    project.framework === "expo" ||
    project.framework === "react-native" ||
    project.framework === "tanstack-start"
      ? project.framework
      : "react";

  return {
    framework,
    hasReactCompiler: project.hasReactCompiler,
    hasTanStackAI: project.hasTanStackAI,
    hasTanStackQuery: project.hasTanStackQuery,
    hasTypeScript: project.hasTypeScript,
    reactMajorVersion: project.reactMajorVersion,
    reactPeerDependencyRange: project.reactPeerDependencyRange,
    tailwindVersion: project.tailwindVersion,
  };
};

const hasFile = async (filePath: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
};

const toNpmWorkspacePatterns = (manifest: PackageJsonObject | null): string[] => {
  const workspaces: unknown = manifest?.workspaces;
  if (!workspaces) return [];
  if (Array.isArray(workspaces)) {
    return workspaces.filter((value): value is string => typeof value === "string");
  }
  if (isRecord(workspaces) && Array.isArray(workspaces.packages)) {
    return workspaces.packages.filter((value): value is string => typeof value === "string");
  }
  return [];
};

const isMonorepoRoot = async (directory: string): Promise<boolean> => {
  const manifest = await readPackageJson(directory);
  if (toNpmWorkspacePatterns(manifest).length > 0) return true;
  return hasFile(path.join(directory, PNPM_WORKSPACE_FILENAME));
};

const findAncestorMonorepoRoot = async (startDirectory: string): Promise<string | null> => {
  let currentDirectory = path.dirname(startDirectory);
  while (currentDirectory !== path.dirname(currentDirectory)) {
    if (await isMonorepoRoot(currentDirectory)) return currentDirectory;
    currentDirectory = path.dirname(currentDirectory);
  }
  return null;
};

const expandWorkspacePattern = async (
  rootDirectory: string,
  pattern: string,
): Promise<string[]> => {
  // HACK: collapse "**" to "*" — sufficient for dependency lookup in
  // the common (single-level) workspace layout. Deep nested workspaces
  // are rare and finding tailwindcss in *any* workspace is enough.
  const normalized = pattern.replace(/\*\*/g, "*");
  const wildcardIndex = normalized.indexOf("*");
  if (wildcardIndex < 0) {
    const directory = path.resolve(rootDirectory, normalized);
    return (await hasFile(path.join(directory, PACKAGE_JSON_FILENAME))) ? [directory] : [];
  }
  const prefix = normalized.slice(0, wildcardIndex).replace(/\/$/, "");
  const suffix = normalized.slice(wildcardIndex + 1).replace(/^\//, "");
  const baseDirectory = path.resolve(rootDirectory, prefix || ".");
  let entries: Dirent[];
  try {
    entries = await fs.readdir(baseDirectory, { withFileTypes: true });
  } catch {
    return [];
  }
  const directories: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || IGNORED_DIRECTORY_NAMES.has(entry.name)) continue;
    const candidate = path.join(baseDirectory, entry.name, suffix);
    if (await hasFile(path.join(candidate, PACKAGE_JSON_FILENAME))) directories.push(candidate);
  }
  return directories;
};

const findTailwindcssInWorkspaces = async (
  monorepoRoot: string,
  catalogs: CatalogInfo,
): Promise<string | null> => {
  const manifest = await readPackageJson(monorepoRoot);
  const npmPatterns = toNpmWorkspacePatterns(manifest);
  const pnpmFile = await readPnpmWorkspaceFile(monorepoRoot);
  const pnpmPatterns = pnpmFile?.patterns ?? [];
  const patterns = [...new Set([...npmPatterns, ...pnpmPatterns])].filter(
    (entry) => !entry.startsWith("!"),
  );

  for (const pattern of patterns) {
    const directories = await expandWorkspacePattern(monorepoRoot, pattern);
    for (const directory of directories) {
      const workspaceManifest = await readPackageJson(directory);
      const dependencies = collectDependencies(workspaceManifest);
      const resolved = toResolvedDependencyVersion(
        "tailwindcss",
        dependencies.get("tailwindcss"),
        catalogs,
      );
      if (resolved) return resolved;
    }
  }
  return null;
};

export const discoverReactProject = async (rootDirectory: string): Promise<ReactProjectInfo> => {
  const resolvedRootDirectory = path.resolve(rootDirectory);
  const packageInfo = await readNearestPackageInfo(resolvedRootDirectory);
  const dependencyInfo = getDependencyInfo(packageInfo);

  let tailwindVersion = dependencyInfo.tailwindVersion;
  if (!tailwindVersion && (await isMonorepoRoot(resolvedRootDirectory))) {
    tailwindVersion = await findTailwindcssInWorkspaces(
      resolvedRootDirectory,
      packageInfo.catalogs,
    );
  }
  // HACK: leaf workspace inside a monorepo — walk up to the ancestor
  // monorepo root and search its sibling workspaces for tailwindcss.
  // Mirrors v1's findDependencyInfoFromMonorepoRoot. Trade-off: a leaf
  // package with no Tailwind that lives inside a Tailwind-using
  // monorepo will be (correctly) treated as Tailwind-capable, since the
  // toolchain it ships against is Tailwind-flavoured.
  if (!tailwindVersion) {
    const ancestorMonorepoRoot = await findAncestorMonorepoRoot(resolvedRootDirectory);
    if (ancestorMonorepoRoot) {
      tailwindVersion = await findTailwindcssInWorkspaces(
        ancestorMonorepoRoot,
        packageInfo.catalogs,
      );
    }
  }

  const sourceFileInfo = await collectSourceFileInfo(resolvedRootDirectory);
  const hasReactCompiler =
    dependencyInfo.hasReactCompiler ||
    (await detectReactCompiler(resolvedRootDirectory, packageInfo.manifest));

  return {
    rootDirectory: resolvedRootDirectory,
    projectName: packageInfo.manifest?.name ?? path.basename(resolvedRootDirectory),
    packageJsonPath: packageInfo.packageJsonPath,
    reactVersion: dependencyInfo.reactVersion,
    reactMajorVersion: parseReactMajorVersion(dependencyInfo.reactVersion),
    reactPeerDependencyRange: dependencyInfo.reactPeerDependencyRange,
    tailwindVersion,
    framework: dependencyInfo.framework,
    hasTypeScript: sourceFileInfo.hasTypeScript,
    hasReactCompiler,
    hasTanStackAI: dependencyInfo.hasTanStackAI,
    hasTanStackQuery: dependencyInfo.hasTanStackQuery,
    sourceFileCount: sourceFileInfo.count,
  };
};
