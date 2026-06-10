const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

function runGit(repoPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", repoPath, ...args],
      {
        timeout: options.timeout ?? 10000,
        maxBuffer: options.maxBuffer ?? 1024 * 1024 * 4,
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve(stdout.trimEnd());
      },
    );
  });
}

function isNotGitRepositoryError(error) {
  const errorText = `${error?.stderr ?? ""}\n${error?.message ?? ""}`.toLowerCase();
  return errorText.includes("not a git repository") || errorText.includes("not a git work tree");
}

function safeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function realPathForCompare(pathValue) {
  try {
    return await fs.realpath(pathValue);
  } catch {
    return path.resolve(pathValue);
  }
}

async function gitCommonDirKey(root) {
  const gitCommonDir = await runGit(root, ["rev-parse", "--git-common-dir"]).catch(() => "");
  if (!gitCommonDir) return `path:${path.resolve(root)}`;
  const absoluteGitCommonDir = path.isAbsolute(gitCommonDir) ? gitCommonDir : path.resolve(root, gitCommonDir);
  return `git:${await realPathForCompare(absoluteGitCommonDir)}`;
}

module.exports = {
  gitCommonDirKey,
  isNotGitRepositoryError,
  realPathForCompare,
  runGit,
  safeInteger,
};
