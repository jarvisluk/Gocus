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

function collectShellFiles() {
  return collectMatchingFiles({
    projectRoot,
    roots: checkedRoots,
    extensions: checkedExtensions,
  });
}

function checkShellFileSyntax(filePath) {
  const result = spawnSync("bash", ["-n", filePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status === 0) return null;

  return processFailure(projectRoot, filePath, result);
}

function runShellSyntaxCheck(files = collectShellFiles()) {
  return {
    checkedFiles: files,
    failures: files.map(checkShellFileSyntax).filter(Boolean),
  };
}

function main() {
  const { checkedFiles, failures } = runShellSyntaxCheck();

  if (failures.length) {
    console.error(`Shell syntax failed (${failures.length} file${failures.length === 1 ? "" : "s"}):`);
    for (const failure of failures) {
      console.error(formatProcessFailure(failure, "bash -n"));
    }
    process.exitCode = 1;
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
  runShellSyntaxCheck,
};
