#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  collectMatchingFiles,
  formatProcessFailure,
  processFailure,
} = require("./lib/file-checks.cjs");

const projectRoot = path.resolve(__dirname, "..");
const checkedRoots = ["scripts", "tools"];
const checkedExtensions = new Set([".sh"]);

function isBashAvailable() {
  const result = spawnSync("bash", ["--version"], {
    cwd: projectRoot,
    stdio: "ignore",
  });

  return !result.error && result.status === 0;
}

function collectShellFiles() {
  return collectMatchingFiles({
    projectRoot,
    roots: checkedRoots,
    extensions: checkedExtensions,
  });
}

function checkShellFileSyntax(filePath) {
  if (!isBashAvailable()) return null;

  const result = spawnSync("bash", ["-n", filePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status === 0) return null;

  return processFailure(projectRoot, filePath, result);
}

function runShellSyntaxCheck(files = collectShellFiles()) {
  const skipped = !isBashAvailable();

  return {
    checkedFiles: files,
    failures: skipped ? [] : files.map(checkShellFileSyntax).filter(Boolean),
    skipped,
  };
}

function main() {
  const { checkedFiles, failures, skipped } = runShellSyntaxCheck();

  if (failures.length) {
    console.error(`Shell syntax failed (${failures.length} file${failures.length === 1 ? "" : "s"}):`);
    for (const failure of failures) {
      console.error(formatProcessFailure(failure, "bash -n"));
    }
    process.exitCode = 1;
  } else if (skipped) {
    console.log(`Shell syntax skipped for ${checkedFiles.length} file${checkedFiles.length === 1 ? "" : "s"}; bash is unavailable.`);
  } else {
    console.log(`Shell syntax passed for ${checkedFiles.length} file${checkedFiles.length === 1 ? "" : "s"}.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkShellFileSyntax,
  collectShellFiles,
  isBashAvailable,
  runShellSyntaxCheck,
};
