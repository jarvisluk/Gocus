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
const cssCommentPattern = /\/\*[\s\S]*?\*\//g;
const cssRulePattern = /([^{}]+)\{([^{}]+)\}/g;
const stylesheetImportPattern = /^\s*@import\s+["']([^"']+\.css)["'];\s*$/;
const backdropFilterDeclarationPattern = /^\s*(-webkit-)?backdrop-filter\s*:\s*([^;]+);/;
const boxShadowDeclarationPattern = /^\s*box-shadow\s*:\s*([^;]+);/;
const cssRawColorLiteralPattern = /#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\(/;
const themeTokenStylesheets = new Set([
  "src/styles/theme.css",
  "src/styles/theme-presets-dark.css",
  "src/styles/theme-presets-dark-variants.css",
  "src/styles/theme-presets-light.css",
]);
const maxCssFileLines = 78;
const minDuplicateCssDeclarationCount = 3;

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

function sourceLineCount(content) {
  if (!content) return 0;
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

function checkCssFileSize(relativeFilePath, content) {
  if (!relativeFilePath.endsWith(".css")) return [];

  const lineCount = sourceLineCount(content);
  if (lineCount <= maxCssFileLines) return [];

  return [
    `${relativeFilePath}:1: keep CSS files at or below ${maxCssFileLines} lines ` +
      `(currently ${lineCount}); split by surface or shared pattern`,
  ];
}

function checkBackdropFilterTokens(relativeFilePath, content) {
  if (!relativeFilePath.endsWith(".css")) return [];

  return content.split("\n").flatMap((line, index) => {
    const match = line.match(backdropFilterDeclarationPattern);
    if (!match) return [];

    const value = match[2].trim();
    if (value === "none" || value.startsWith("var(")) return [];

    return [`${relativeFilePath}:${index + 1}: use a backdrop-filter custom property or none`];
  });
}

function checkBoxShadowTokens(relativeFilePath, content) {
  if (!relativeFilePath.endsWith(".css") || relativeFilePath === "src/styles/theme.css") return [];

  return content.split("\n").flatMap((line, index) => {
    const match = line.match(boxShadowDeclarationPattern);
    if (!match) return [];

    const value = match[1].trim();
    if (!value.includes("rgba(")) return [];

    return [`${relativeFilePath}:${index + 1}: move rgba box-shadow values into theme custom properties`];
  });
}

function isThemeTokenStylesheet(relativeFilePath) {
  return themeTokenStylesheets.has(relativeFilePath.replaceAll("\\", "/"));
}

function checkRawCssColorTokens(relativeFilePath, content) {
  if (!relativeFilePath.endsWith(".css") || isThemeTokenStylesheet(relativeFilePath)) return [];

  return stripCssComments(content)
    .split("\n")
    .flatMap((line, index) => {
      if (!cssRawColorLiteralPattern.test(line)) return [];
      return [`${relativeFilePath}:${index + 1}: move raw color values into theme custom properties`];
    });
}

function lineNumberFromIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function cssDeclarationSignature(ruleBody) {
  return ruleBody
    .split(";")
    .map((declaration) => declaration.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join(";");
}

function stripCssComments(content) {
  return content.replace(cssCommentPattern, (comment) => comment.replace(/[^\n]/g, ""));
}

function cssRuleDeclarationBlocks(relativeFilePath, content) {
  if (!relativeFilePath.endsWith(".css")) return [];

  const contentWithoutComments = stripCssComments(content);
  return [...contentWithoutComments.matchAll(cssRulePattern)].flatMap((match) => {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const signature = cssDeclarationSignature(match[2]);
    if (!signature) return [];

    const declarationCount = signature.split(";").length;
    if (declarationCount < minDuplicateCssDeclarationCount) return [];

    return [
      {
        declarationCount,
        lineNumber: lineNumberFromIndex(contentWithoutComments, match.index + match[1].search(/\S/)),
        relativeFilePath,
        selector,
        signature,
      },
    ];
  });
}

function checkDuplicateCssDeclarationBlocks(fileContents) {
  const declarationBlocksBySignature = new Map();

  for (const { relativeFilePath, content } of fileContents) {
    for (const block of cssRuleDeclarationBlocks(relativeFilePath, content)) {
      if (!declarationBlocksBySignature.has(block.signature)) {
        declarationBlocksBySignature.set(block.signature, []);
      }
      declarationBlocksBySignature.get(block.signature).push(block);
    }
  }

  return [...declarationBlocksBySignature.values()].flatMap((blocks) => {
    if (blocks.length < 2) return [];

    const [firstBlock, ...duplicateBlocks] = blocks;
    return duplicateBlocks.map((block) => {
      const firstLocation = `${firstBlock.relativeFilePath}:${firstBlock.lineNumber} ${firstBlock.selector}`;
      return (
        `${block.relativeFilePath}:${block.lineNumber}: duplicate CSS declaration block ` +
        `(${block.declarationCount} declarations) also used by ${firstLocation}`
      );
    });
  });
}

function normalizedRelativeFilePath(relativeFilePath) {
  return relativeFilePath.replaceAll("\\", "/");
}

function resolveStylesheetImport(importerRelativeFilePath, importSpecifier) {
  if (!importSpecifier.startsWith(".")) return "";

  const importerDirectory = path.posix.dirname(normalizedRelativeFilePath(importerRelativeFilePath));
  const importedFilePath = path.posix.normalize(path.posix.join(importerDirectory, importSpecifier));

  if (path.posix.isAbsolute(importedFilePath) || importedFilePath.startsWith("../")) return "";
  if (!importedFilePath.startsWith("src/styles/")) return "";
  return importedFilePath;
}

function stylesheetManifestImports(content, importerRelativeFilePath = "src/styles.css") {
  return content.split("\n").flatMap((line, index) => {
    const match = line.match(stylesheetImportPattern);
    if (!match) return [];
    const relativeFilePath = resolveStylesheetImport(importerRelativeFilePath, match[1]);
    if (!relativeFilePath) return [];
    return [{ lineNumber: index + 1, relativeFilePath }];
  });
}

function hasStylesheetImport(content) {
  return content.split("\n").some((line) => stylesheetImportPattern.test(line));
}

function checkStylesheetManifest(fileContents) {
  const fileContentsByPath = new Map(
    fileContents.map(({ relativeFilePath, content }) => [normalizedRelativeFilePath(relativeFilePath), content]),
  );
  const manifest = fileContentsByPath.get("src/styles.css");
  if (!manifest) return ["src/styles.css:1: missing stylesheet import manifest"];

  const stylesheetFiles = new Set(
    [...fileContentsByPath.keys()]
      .filter((relativeFilePath) => relativeFilePath.startsWith("src/styles/") && relativeFilePath.endsWith(".css")),
  );
  const failures = [];
  const importedFiles = new Set();
  const traversedManifests = new Set();

  function checkImportOnlyStylesheet(relativeFilePath, content) {
    return content.split("\n").flatMap((line, index) => {
      if (!line.trim() || stylesheetImportPattern.test(line)) return [];
      return [`${relativeFilePath}:${index + 1}: keep stylesheet manifest import-only`];
    });
  }

  function walkStylesheetManifest(relativeFilePath, ancestry = []) {
    if (traversedManifests.has(relativeFilePath)) return;
    traversedManifests.add(relativeFilePath);

    const content = fileContentsByPath.get(relativeFilePath) ?? "";
    failures.push(...checkImportOnlyStylesheet(relativeFilePath, content));

    for (const [index, line] of content.split("\n").entries()) {
      const match = line.match(stylesheetImportPattern);
      if (!match) continue;

      const lineNumber = index + 1;
      const importedFilePath = resolveStylesheetImport(relativeFilePath, match[1]);
      if (!importedFilePath || !stylesheetFiles.has(importedFilePath)) {
        const fallbackFilePath = importedFilePath || match[1];
        failures.push(`${relativeFilePath}:${lineNumber}: import existing stylesheet ${fallbackFilePath}`);
        continue;
      }

      if (ancestry.includes(importedFilePath)) {
        failures.push(`${relativeFilePath}:${lineNumber}: remove cyclic stylesheet import ${importedFilePath}`);
        continue;
      }

      if (importedFiles.has(importedFilePath)) {
        failures.push(`${relativeFilePath}:${lineNumber}: remove duplicate stylesheet import ${importedFilePath}`);
        continue;
      }

      importedFiles.add(importedFilePath);
      const importedContent = fileContentsByPath.get(importedFilePath) ?? "";
      if (hasStylesheetImport(importedContent)) {
        walkStylesheetManifest(importedFilePath, [...ancestry, importedFilePath]);
      }
    }
  }

  walkStylesheetManifest("src/styles.css", ["src/styles.css"]);

  for (const relativeFilePath of [...stylesheetFiles].sort((left, right) => left.localeCompare(right))) {
    if (!importedFiles.has(relativeFilePath)) {
      failures.push(`src/styles.css:1: import stylesheet ${relativeFilePath}`);
    }
  }

  return failures;
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
      ...fileContents.flatMap(({ relativeFilePath, content }) => checkCssFileSize(relativeFilePath, content)),
      ...fileContents.flatMap(({ relativeFilePath, content }) => checkBackdropFilterTokens(relativeFilePath, content)),
      ...fileContents.flatMap(({ relativeFilePath, content }) => checkBoxShadowTokens(relativeFilePath, content)),
      ...fileContents.flatMap(({ relativeFilePath, content }) => checkRawCssColorTokens(relativeFilePath, content)),
      ...checkUnusedCssCustomProperties(fileContents),
      ...checkDuplicateCssDeclarationBlocks(fileContents),
      ...checkStylesheetManifest(fileContents),
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
  checkBackdropFilterTokens,
  checkBoxShadowTokens,
  checkContent,
  checkCssFileSize,
  checkDuplicateCssDeclarationBlocks,
  checkRawCssColorTokens,
  checkStylesheetManifest,
  checkUnusedCssCustomProperties,
  collectCheckedFiles,
  cssDeclarationSignature,
  cssCustomPropertyDefinitions,
  cssCustomPropertyUsages,
  cssRuleDeclarationBlocks,
  stylesheetManifestImports,
  hasGitTreeBarrelImport,
  hasInlinePoliteStatusViewLiteral,
  hasReactImport,
  hasRendererRuntimeImport,
  isThemeTokenStylesheet,
  isRendererSourceFile,
  resolveStylesheetImport,
  isSrcLibFile,
  isViewModelFile,
  maxCssFileLines,
  maxLineLength,
  minDuplicateCssDeclarationCount,
  runHygieneCheck,
  sourceLineCount,
};
