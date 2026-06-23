#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { collectMatchingFiles, relativePath } = require("./lib/file-checks.cjs");

const projectRoot = path.resolve(__dirname, "..");
const checkedRoots = ["src", "scripts", "electron", "tools", "docs", ".github"];
const checkedRootFiles = [
  ".env.example",
  "DESIGN.md",
  "README.md",
  "ROADMAP.md",
  "index.html",
  "package.json",
  "package-lock.json",
  "stylelint.config.cjs",
  "tsconfig.json",
  "vite.config.ts",
];
const textExtensions = new Set([".cjs", ".css", ".html", ".js", ".json", ".md", ".sh", ".ts", ".tsx", ".yml", ".yaml"]);
const secretPatterns = [
  { label: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/g },
  { label: "GitHub token", pattern: /(?:gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{80,255})/g },
  { label: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { label: "npm token", pattern: /npm_[A-Za-z0-9]{36}/g },
  { label: "OpenAI-style API key", pattern: /sk-[A-Za-z0-9]{20,}/g },
  { label: "private key", pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP |)PRIVATE KEY-----/g },
  { label: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { label: "Stripe secret key", pattern: /sk_(?:live|test)_[A-Za-z0-9]{16,}/g },
];

function lineNumberFromIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function findSecretFindingsInContent(relativeFilePath, content) {
  return secretPatterns.flatMap(({ label, pattern }) => {
    pattern.lastIndex = 0;
    return [...content.matchAll(pattern)].map((match) => ({
      label,
      lineNumber: lineNumberFromIndex(content, match.index),
      relativeFilePath,
    }));
  });
}

function collectSecretScanFiles() {
  return collectMatchingFiles({
    projectRoot,
    roots: checkedRoots,
    rootFiles: checkedRootFiles,
    extensions: textExtensions,
  });
}

function checkFileForSecrets(filePath) {
  return findSecretFindingsInContent(relativePath(projectRoot, filePath), fs.readFileSync(filePath, "utf8"));
}

function formatFinding(finding) {
  return `${finding.relativeFilePath}:${finding.lineNumber}: possible ${finding.label}`;
}

function runSecretScan(files = collectSecretScanFiles()) {
  return {
    checkedFiles: files,
    findings: files.flatMap(checkFileForSecrets),
  };
}

function main() {
  const { checkedFiles, findings } = runSecretScan();

  if (findings.length) {
    console.error(`Secret scan failed (${findings.length} finding${findings.length === 1 ? "" : "s"}):`);
    console.error(findings.map(formatFinding).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Secret scan passed for ${checkedFiles.length} files.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFileForSecrets,
  collectSecretScanFiles,
  findSecretFindingsInContent,
  formatFinding,
  lineNumberFromIndex,
  runSecretScan,
  secretPatterns,
};
