const fs = require("node:fs");
const path = require("node:path");

const defaultIgnoredDirectories = new Set([".git", "dist", "node_modules"]);

function relativePath(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

function hasAllowedExtension(filePath, extensions) {
  return extensions.has(path.extname(filePath));
}

function walkMatchingFiles(directoryPath, options) {
  const { extensions, ignoredDirectories = defaultIgnoredDirectories } = options;
  if (!fs.existsSync(directoryPath)) return [];

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...walkMatchingFiles(entryPath, options));
      }
      continue;
    }

    if (entry.isFile() && hasAllowedExtension(entryPath, extensions)) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectMatchingFiles(options) {
  const {
    projectRoot,
    roots,
    rootFiles = [],
    extensions,
    ignoredDirectories = defaultIgnoredDirectories,
  } = options;
  const nestedFiles = roots.flatMap((root) => {
    return walkMatchingFiles(path.join(projectRoot, root), { extensions, ignoredDirectories });
  });
  const topLevelFiles = rootFiles
    .map((filePath) => path.join(projectRoot, filePath))
    .filter((filePath) => fs.existsSync(filePath) && hasAllowedExtension(filePath, extensions));

  return [...new Set([...nestedFiles, ...topLevelFiles])].sort((left, right) => {
    return relativePath(projectRoot, left).localeCompare(relativePath(projectRoot, right));
  });
}

function processFailure(projectRoot, filePath, result) {
  return {
    filePath,
    relativeFilePath: relativePath(projectRoot, filePath),
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? result.error?.message ?? "").trim(),
  };
}

function formatProcessFailure(failure, fallbackCommand) {
  const lines = [`\n${failure.relativeFilePath}`];
  if (failure.stderr) lines.push(failure.stderr);
  if (failure.stdout) lines.push(failure.stdout);
  if (!failure.stderr && !failure.stdout) {
    lines.push(`${fallbackCommand} exited with ${failure.signal ?? failure.status}`);
  }
  return lines.join("\n");
}

module.exports = {
  collectMatchingFiles,
  defaultIgnoredDirectories,
  formatProcessFailure,
  processFailure,
  relativePath,
};
