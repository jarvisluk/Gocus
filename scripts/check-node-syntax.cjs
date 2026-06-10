#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  collectMatchingFiles,
  formatProcessFailure,
  processFailure,
} = require("./lib/file-checks.cjs");

const projectRoot = path.resolve(__dirname, "..");
const checkedRoots = ["scripts", "electron", "tools"];
const checkedExtensions = new Set([".cjs", ".js"]);

function collectNodeFiles() {
  return collectMatchingFiles({
    projectRoot,
    roots: checkedRoots,
    extensions: checkedExtensions,
  });
}

function checkNodeFileSyntax(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status === 0) return null;

  return processFailure(projectRoot, filePath, result);
}

function runNodeSyntaxCheck(files = collectNodeFiles()) {
  return {
    checkedFiles: files,
    failures: files.map(checkNodeFileSyntax).filter(Boolean),
  };
}

function main() {
  const { checkedFiles, failures } = runNodeSyntaxCheck();

  if (failures.length) {
    console.error(`Node syntax failed (${failures.length} file${failures.length === 1 ? "" : "s"}):`);
    for (const failure of failures) {
      console.error(formatProcessFailure(failure, "node --check"));
    }
    process.exitCode = 1;
  } else {
    console.log(`Node syntax passed for ${checkedFiles.length} files.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkNodeFileSyntax,
  collectNodeFiles,
  runNodeSyntaxCheck,
};
