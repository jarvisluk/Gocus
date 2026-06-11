#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { collectMatchingFiles, relativePath } = require("./lib/file-checks.cjs");

const projectRoot = path.resolve(__dirname, "..");
const checkedRoots = ["src", "scripts", "electron", "tools", "docs"];
const checkedRootFiles = [
  "DESIGN.md",
  "README.md",
  "ROADMAP.md",
  "index.html",
  "package.json",
  "stylelint.config.cjs",
  "tsconfig.json",
  "vite.config.ts",
];
const maxLineLength = 140;
const textExtensions = new Set([".cjs", ".css", ".html", ".js", ".json", ".md", ".sh", ".ts", ".tsx"]);
const statusViewLiteralFile = "src/lib/statusView.ts";
const rendererRuntimeModules = [
  "electron",
  "node:[^\"']+",
  "fs",
  "path",
  "os",
  "child_process",
  "url",
  "crypto",
  "process",
  "buffer",
  "stream",
  "util",
  "events",
];
const rendererRuntimeModulePattern = rendererRuntimeModules.join("|");
const rendererRuntimeImportPattern = new RegExp(
  `^\\s*import\\b.*\\bfrom\\s*["'](?:${rendererRuntimeModulePattern})["']|` +
    `^\\s*import\\s*["'](?:${rendererRuntimeModulePattern})["']|` +
    `\\brequire\\(\\s*["'](?:${rendererRuntimeModulePattern})["']\\s*\\)`,
);
const gitTreeBarrelImportPattern = /^\s*import\b.*\bfrom\s*["'](?:\.\.\/git-tree|\.\/git-tree|src\/git-tree)["']/;
const cssCustomPropertyDefinitionPattern = /^\s*(--[a-z0-9-]+)\s*:/;
const cssCustomPropertyUsagePattern = /var\(\s*(--[a-z0-9-]+)\b/g;

function isSrcLibFile(relativeFilePath) {
  return relativeFilePath.replaceAll("\\", "/").startsWith("src/lib/");
}

function isRendererSourceFile(relativeFilePath) {
  const normalizedFilePath = relativeFilePath.replaceAll("\\", "/");
  return normalizedFilePath.startsWith("src/") && /\.(ts|tsx)$/.test(normalizedFilePath);
}

function isViewModelFile(relativeFilePath) {
  const normalizedFilePath = relativeFilePath.replaceAll("\\", "/");
  return (
    (normalizedFilePath.startsWith("src/lib/") || normalizedFilePath.startsWith("src/git-tree/")) &&
    normalizedFilePath.endsWith("View.ts")
  );
}

function hasInlinePoliteStatusViewLiteral(line) {
  return /role:\s*["']status["']/.test(line) || /ariaLive:\s*["']polite["']/.test(line);
}

function hasReactImport(line) {
  return /^\s*import\b.*\bfrom\s*["']react["']/.test(line) || /^\s*import\s*["']react["']/.test(line);
}

function hasRendererRuntimeImport(line) {
  return rendererRuntimeImportPattern.test(line);
}

function hasGitTreeBarrelImport(line) {
  return gitTreeBarrelImportPattern.test(line);
}

function checkContent(relativeFilePath, content) {
  const lines = content.split("\n");
  const failures = [];
  const normalizedFilePath = relativeFilePath.replaceAll("\\", "/");
  const enforceStatusViewHelper = isSrcLibFile(relativeFilePath) && normalizedFilePath !== statusViewLiteralFile;
  const enforceFrameworkFreeViewModel = isViewModelFile(relativeFilePath);
  const enforceRendererRuntimeBoundary = isRendererSourceFile(relativeFilePath);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const lineNumber = index + 1;

    if (/[ \t]+$/.test(line)) {
      failures.push(`${relativeFilePath}:${lineNumber}: trailing whitespace`);
    }

    if (line.includes("\t")) {
      failures.push(`${relativeFilePath}:${lineNumber}: tab character`);
    }

    if (line.length > maxLineLength) {
      failures.push(`${relativeFilePath}:${lineNumber}: ${line.length} chars`);
    }

    if (enforceStatusViewHelper && hasInlinePoliteStatusViewLiteral(line)) {
      failures.push(`${relativeFilePath}:${lineNumber}: use politeStatusView for polite status live-region props`);
    }

    if (enforceFrameworkFreeViewModel && hasReactImport(line)) {
      failures.push(`${relativeFilePath}:${lineNumber}: keep view-model files free of React imports`);
    }

    if (enforceRendererRuntimeBoundary && hasRendererRuntimeImport(line)) {
      failures.push(`${relativeFilePath}:${lineNumber}: keep renderer source free of Node/Electron runtime imports`);
    }

    if (enforceRendererRuntimeBoundary && hasGitTreeBarrelImport(line)) {
      failures.push(`${relativeFilePath}:${lineNumber}: import git-tree modules directly instead of the barrel`);
    }
  }

  return failures;
}

function cssCustomPropertyDefinitions(relativeFilePath, content) {
  if (!relativeFilePath.endsWith(".css")) return [];

  return content.split("\n").flatMap((line, index) => {
    const match = line.match(cssCustomPropertyDefinitionPattern);
    if (!match) return [];
    return [{ name: match[1], relativeFilePath, lineNumber: index + 1 }];
  });
}

function cssCustomPropertyUsages(content) {
  return new Set([...content.matchAll(cssCustomPropertyUsagePattern)].map((match) => match[1]));
}

function checkUnusedCssCustomProperties(fileContents) {
  const definitions = fileContents.flatMap(({ relativeFilePath, content }) => {
    return cssCustomPropertyDefinitions(relativeFilePath, content);
  });
  const usedProperties = cssCustomPropertyUsages(fileContents.map(({ content }) => content).join("\n"));

  return definitions.flatMap(({ name, relativeFilePath, lineNumber }) => {
    if (usedProperties.has(name)) return [];
    return [`${relativeFilePath}:${lineNumber}: remove unused CSS custom property ${name}`];
  });
}

function collectCheckedFiles() {
  return collectMatchingFiles({
    projectRoot,
    roots: checkedRoots,
    rootFiles: checkedRootFiles,
    extensions: textExtensions,
  });
}

function runHygieneCheck() {
  const checkedFiles = collectCheckedFiles();
  const fileContents = checkedFiles.map((filePath) => ({
    filePath,
    relativeFilePath: relativePath(projectRoot, filePath),
    content: fs.readFileSync(filePath, "utf8"),
  }));

  return {
    checkedFiles,
    failures: [
      ...fileContents.flatMap(({ relativeFilePath, content }) => checkContent(relativeFilePath, content)),
      ...checkUnusedCssCustomProperties(fileContents),
    ],
  };
}

function main() {
  const { checkedFiles, failures } = runHygieneCheck();

  if (failures.length) {
    console.error(`Source hygiene failed (${failures.length} issue${failures.length === 1 ? "" : "s"}):`);
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Source hygiene passed for ${checkedFiles.length} files.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkContent,
  checkUnusedCssCustomProperties,
  collectCheckedFiles,
  cssCustomPropertyDefinitions,
  cssCustomPropertyUsages,
  hasGitTreeBarrelImport,
  hasInlinePoliteStatusViewLiteral,
  hasReactImport,
  hasRendererRuntimeImport,
  isRendererSourceFile,
  isSrcLibFile,
  isViewModelFile,
  maxLineLength,
  runHygieneCheck,
};
