#!/usr/bin/env node

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const conventionalSubjectPattern =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([A-Za-z0-9._/-]+\))?!?: .+/;

function commitSubject(message) {
  return String(message || "").split(/\r?\n/, 1)[0].trim();
}

function isConventionalCommitSubject(subject) {
  return conventionalSubjectPattern.test(subject);
}

function validateCommitMessage(message) {
  const subject = commitSubject(message);
  return {
    subject,
    valid: isConventionalCommitSubject(subject),
  };
}

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }

  return result.stdout.trim();
}

function commitsForRange(range) {
  if (!range) return [];
  const output = runGit(["log", "--format=%H%x00%s", range]);
  if (!output) return [];

  return output.split(/\r?\n/).map((line) => {
    const [hash, subject] = line.split("\x00");
    return { hash, subject };
  });
}

function parseArgs(argv) {
  const args = { mode: "range", range: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--commit-msg-file") {
      args.mode = "file";
      args.file = argv[index + 1];
      index += 1;
    } else if (arg === "--range") {
      args.mode = "range";
      args.range = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.mode = "help";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/check-commit-messages.cjs --commit-msg-file .git/COMMIT_EDITMSG
  node scripts/check-commit-messages.cjs --range origin/main..HEAD`);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.mode === "help") {
    printUsage();
    return 0;
  }

  if (args.mode === "file") {
    if (!args.file) throw new Error("--commit-msg-file requires a path.");
    const result = validateCommitMessage(fs.readFileSync(args.file, "utf8"));
    if (result.valid) return 0;

    console.error(`Commit subject must use Conventional Commits: ${result.subject || "(empty subject)"}`);
    console.error("Expected format: type(scope?): subject, for example: fix: handle Windows tray labels");
    return 1;
  }

  if (!args.range) throw new Error("--range is required unless --commit-msg-file is used.");
  const invalidCommits = commitsForRange(args.range).filter((commit) => !isConventionalCommitSubject(commit.subject));
  if (invalidCommits.length === 0) return 0;

  console.error("Commit subjects must use Conventional Commits:");
  for (const commit of invalidCommits) {
    console.error(`- ${commit.hash.slice(0, 7)} ${commit.subject || "(empty subject)"}`);
  }
  console.error("Expected format: type(scope?): subject, for example: feat: add release checks");
  return 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  commitSubject,
  commitsForRange,
  isConventionalCommitSubject,
  main,
  validateCommitMessage,
};
