const fs = require("node:fs/promises");
const path = require("node:path");
const {
  gitCommonDirKey,
  isNotGitRepositoryError,
  realPathForCompare,
  runGit,
} = require("./gitCore.cjs");
const { parseLog } = require("./gitGraph.cjs");
const { applyNumstat, isConflictedStatus, parseStatus } = require("./gitStatus.cjs");

const starterGitIgnore = [
  "# Git Peek starter .gitignore",
  "",
  "# OS files",
  ".DS_Store",
  "Thumbs.db",
  "",
  "# Local environment",
  ".env",
  ".env.*",
  "!.env.example",
  ".venv/",
  "venv/",
  "",
  "# Dependencies",
  "node_modules/",
  "",
  "# Build and test output",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  "",
  "# Logs",
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "pnpm-debug.log*",
  "",
  "# Python cache",
  "__pycache__/",
  "*.py[cod]",
  "",
].join("\n");

const defaultCommitLogLimit = 300;
const maxCommitLogLimit = 2000;

function normalizeCommitLogLimit(value = process.env.GIT_PEEK_COMMIT_LOG_LIMIT) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultCommitLogLimit;
  return Math.min(parsed, maxCommitLogLimit);
}

async function readFolderWithoutGit(folderPath) {
  if (typeof folderPath !== "string" || !folderPath.trim()) {
    throw new Error("Choose a folder before initializing Git.");
  }

  const resolvedPath = path.resolve(folderPath);
  const stats = await fs.stat(resolvedPath);
  if (!stats.isDirectory()) throw new Error("Choose a folder before initializing Git.");

  let hasGitIgnore = false;
  try {
    hasGitIgnore = (await fs.stat(path.join(resolvedPath, ".gitignore"))).isFile();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  return {
    path: resolvedPath,
    name: path.basename(resolvedPath) || resolvedPath,
    hasGitIgnore,
  };
}

async function writeStarterGitIgnore(root) {
  const gitIgnorePath = path.join(root, ".gitignore");

  try {
    const stats = await fs.stat(gitIgnorePath);
    if (stats.isFile()) return { created: false };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await fs.writeFile(gitIgnorePath, starterGitIgnore, { flag: "wx" });
    return { created: true };
  } catch (error) {
    if (error?.code === "EEXIST") return { created: false };
    throw error;
  }
}

async function initGitRepository(root) {
  try {
    await runGit(root, ["init", "-b", "main"]);
  } catch (error) {
    const errorText = `${error?.stderr ?? ""}\n${error?.message ?? ""}`.toLowerCase();
    if (!errorText.includes("unknown switch") && !errorText.includes("unknown option")) throw error;
    await runGit(root, ["init"]);
  }
}

function normalizeView(view) {
  if (!view || typeof view !== "object") return { mode: "all" };
  if (view.mode === "branch" && typeof view.ref === "string" && view.ref) return { mode: "branch", ref: view.ref };
  if (view.mode === "current" || view.mode === "all") return { mode: view.mode };
  if (view.mode === "auto") return { mode: "all" };
  return { mode: "all" };
}

function logArgsForView(view) {
  const normalized = normalizeView(view);
  const commitLimit = normalizeCommitLogLimit();
  const args = [
    "log",
    "--topo-order",
    `--max-count=${commitLimit}`,
    "--pretty=format:%x1e%H%x1f%h%x1f%P%x1f%an%x1f%ar%x1f%aI%x1f%s%x1f%D%x1f%B%x1d%n",
    "--numstat",
  ];

  if (normalized.mode === "all") args.push("--all");
  if (normalized.mode === "branch" && normalized.ref) args.push(normalized.ref);
  return { args, view: normalized };
}

function logArgsForViewWithWorktrees(view, worktrees) {
  const request = logArgsForView(view);
  if (request.view.mode !== "all") return request;

  const detachedHeads = [
    ...new Set(
      worktrees
        .filter((worktree) => worktree.head && worktree.detached && !worktree.bare)
        .map((worktree) => worktree.head),
    ),
  ];

  return { ...request, args: [...request.args, ...detachedHeads] };
}

function parseBranches(output, currentBranchName) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name = "", fullName = "", upstream = "", head = ""] = line.split("\0");
      const type = fullName.startsWith("refs/remotes/") ? "remote" : fullName.startsWith("refs/tags/") ? "tag" : "local";
      return {
        name,
        fullName,
        type,
        current: head === "*" || name === currentBranchName,
        upstream,
      };
    })
    .filter((branch) => branch.name && !branch.name.endsWith("/HEAD"));
}

function parseContainedBranchTips(output) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name = "", fullName = "", , , hash = ""] = line.split("\0");
      return { name, fullName, hash };
    })
    .filter((branch) => branch.name && branch.hash && branch.fullName.startsWith("refs/heads/"));
}

function parseWorktrees(output, currentRoot) {
  return output
    .split(/\n\s*\n/)
    .map((block) => {
      const worktree = {
        path: "",
        branch: "",
        head: "",
        headShortHash: "",
        headTitle: "",
        headRelativeTime: "",
        detached: false,
        bare: false,
        current: false,
        counts: { modified: 0, staged: 0, untracked: 0 },
      };

      for (const line of block.split("\n").filter(Boolean)) {
        const [key, ...valueParts] = line.split(" ");
        const value = valueParts.join(" ");
        if (key === "worktree") worktree.path = value;
        if (key === "HEAD") worktree.head = value;
        if (key === "branch") worktree.branch = value.replace(/^refs\/heads\//, "");
        if (key === "detached") worktree.detached = true;
        if (key === "bare") worktree.bare = true;
      }

      worktree.current = path.resolve(worktree.path) === path.resolve(currentRoot);
      return worktree;
    })
    .filter((worktree) => worktree.path);
}

async function gitPathExists(root, gitPath) {
  const resolvedGitPath = await runGit(root, ["rev-parse", "--git-path", gitPath]).catch(() => "");
  if (!resolvedGitPath) return false;
  const absoluteGitPath = path.isAbsolute(resolvedGitPath) ? resolvedGitPath : path.join(root, resolvedGitPath);

  try {
    await fs.stat(absoluteGitPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function repositoryOperationLabel(operation) {
  if (operation === "merge") return "Merge";
  if (operation === "rebase") return "Rebase";
  if (operation === "cherry-pick") return "Cherry-pick";
  if (operation === "revert") return "Revert";
  if (operation === "bisect") return "Bisect";
  return "Ready";
}

function conflictedFilesFromStatus(status) {
  return status.files.filter((file) => isConflictedStatus(file.status)).map((file) => file.path);
}

async function repositoryStateForGit(root, status) {
  const [merge, rebaseMerge, rebaseApply, cherryPick, revert, bisect] = await Promise.all([
    gitPathExists(root, "MERGE_HEAD"),
    gitPathExists(root, "rebase-merge"),
    gitPathExists(root, "rebase-apply"),
    gitPathExists(root, "CHERRY_PICK_HEAD"),
    gitPathExists(root, "REVERT_HEAD"),
    gitPathExists(root, "BISECT_LOG"),
  ]);
  const operation = merge
    ? "merge"
    : rebaseMerge || rebaseApply
      ? "rebase"
      : cherryPick
        ? "cherry-pick"
        : revert
          ? "revert"
          : bisect
            ? "bisect"
            : "none";
  const conflictedFiles = conflictedFilesFromStatus(status);

  return {
    operation,
    operationLabel: repositoryOperationLabel(operation),
    hasConflicts: conflictedFiles.length > 0,
    conflictedFiles,
  };
}

async function enrichWorktree(worktree) {
  if (worktree.bare || !worktree.path) return worktree;

  const [headRaw, statusRaw] = await Promise.all([
    worktree.head
      ? runGit(worktree.path, ["show", "-s", "--date=relative", "--format=%h%x1f%s%x1f%cr", worktree.head]).catch(() => "")
      : Promise.resolve(""),
    runGit(worktree.path, ["status", "--porcelain=v1", "-b"]).catch(() => ""),
  ]);
  const [headShortHash = "", headTitle = "", headRelativeTime = ""] = headRaw.split("\x1f");
  const status = statusRaw ? parseStatus(statusRaw) : null;

  return {
    ...worktree,
    headShortHash: headShortHash || worktree.head.slice(0, 7),
    headTitle: headTitle || "Unknown HEAD",
    headRelativeTime,
    counts: status?.counts ?? worktree.counts,
  };
}

function annotateCommitsWithWorktrees(commits, worktrees) {
  const worktreesByHead = new Map();

  for (const worktree of worktrees) {
    if (!worktree.head || worktree.bare) continue;
    const headWorktrees = worktreesByHead.get(worktree.head) ?? [];
    headWorktrees.push(worktree);
    worktreesByHead.set(worktree.head, headWorktrees);
  }

  return commits.map((commit) => ({
    ...commit,
    checkedOutWorktrees: (worktreesByHead.get(commit.fullHash) ?? []).slice().sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      return left.path.localeCompare(right.path);
    }),
  }));
}

function graphContextForWorktrees(worktrees, status, branches = []) {
  const currentWorktree = worktrees.find((worktree) => worktree.current && !worktree.bare);
  const externalWorktrees = worktrees.filter((worktree) => !worktree.current && !worktree.bare);
  const externalBranches = [
    ...new Set(externalWorktrees.filter((worktree) => !worktree.detached).map((worktree) => worktree.branch)),
  ];
  const externalBranchSet = new Set(externalBranches);
  const localBranches = branches
    .filter((branch) => branch.type === "local" && !externalBranchSet.has(branch.name))
    .map((branch) => branch.name);

  return {
    currentHead: currentWorktree?.head ?? "",
    currentBranch: currentWorktree?.branch || (status.branch.detached ? "" : status.branch.name),
    localBranches,
    externalHeads: externalWorktrees.map((worktree) => worktree.head),
    externalBranches,
  };
}

async function readGitSnapshot(repoPath, view = { mode: "all" }) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const shortStatus = await runGit(root, ["status", "--porcelain=v1", "-b"]);
  const status = parseStatus(shortStatus);
  const repositoryState = await repositoryStateForGit(root, status);

  const [repositoryKey, unstagedStats, stagedStats, branchesRaw, worktreesRaw] = await Promise.all([
    gitCommonDirKey(root),
    runGit(root, ["diff", "--numstat"]).catch(() => ""),
    runGit(root, ["diff", "--cached", "--numstat"]).catch(() => ""),
    runGit(root, [
      "for-each-ref",
      "--format=%(refname:short)%00%(refname)%00%(upstream:short)%00%(HEAD)%00%(objectname)",
      "refs/heads",
      "refs/remotes",
      "refs/tags",
    ]).catch(() => ""),
    runGit(root, ["worktree", "list", "--porcelain"]).catch(() => ""),
  ]);
  const worktrees = await Promise.all(parseWorktrees(worktreesRaw, root).map(enrichWorktree));
  const branches = parseBranches(branchesRaw, status.branch.name);
  const graphContext = {
    ...graphContextForWorktrees(worktrees, status, branches),
    containedBranchTips: parseContainedBranchTips(branchesRaw),
  };
  const logRequest = logArgsForViewWithWorktrees(view, worktrees);
  const logRaw = await runGit(root, logRequest.args, { maxBuffer: 1024 * 1024 * 64 }).catch(() => "");

  applyNumstat(status.files, unstagedStats);
  applyNumstat(status.files, stagedStats);

  const rootName = path.basename(root);

  return {
    repoPath: root,
    repoName: rootName,
    repositoryKey,
    branch: status.branch,
    branches,
    worktrees,
    view: logRequest.view,
    counts: status.counts,
    commits: annotateCommitsWithWorktrees(parseLog(logRaw, graphContext), worktrees),
    changedFiles: status.files,
    repositoryState,
    lastFetchedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    isSample: false,
  };
}

async function assertBranchName(root, branchName) {
  await runGit(root, ["check-ref-format", "--branch", branchName]);
}

async function assertLocalBranch(root, branchName) {
  if (typeof branchName !== "string" || !branchName.trim()) throw new Error("Choose a target branch.");
  await assertBranchName(root, branchName);
  await runGit(root, ["show-ref", "--verify", `refs/heads/${branchName}`]);
}

async function createBranch(repoPath, branchName, startPoint, view) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  await assertBranchName(root, branchName);
  await runGit(root, ["branch", branchName, startPoint]);
  return readGitSnapshot(root, { mode: "branch", ref: branchName || view?.ref });
}

async function checkout(repoPath, ref, view) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  await runGit(root, ["checkout", ref]);
  return readGitSnapshot(root, view);
}

function normalizeMergeOptions(options) {
  return {
    createMergeCommit: options?.createMergeCommit !== false,
  };
}

function mergeArgs(ref, options) {
  const normalizedOptions = normalizeMergeOptions(options);
  if (!normalizedOptions.createMergeCommit) return ["merge", "--no-edit", ref];
  return ["merge", "--no-ff", "--no-edit", ref];
}

async function merge(repoPath, ref, targetBranch, view, options) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  await assertLocalBranch(root, targetBranch);
  await runGit(root, ["checkout", targetBranch]);
  await runGit(root, mergeArgs(ref, options));
  return readGitSnapshot(root, view);
}

async function openWorktree(repoPath, worktreePath, view) {
  if (typeof worktreePath !== "string" || !worktreePath.trim()) {
    throw new Error("Worktree path is required.");
  }

  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const worktreesRaw = await runGit(root, ["worktree", "list", "--porcelain"]);
  const requestedPath = await realPathForCompare(worktreePath);
  let worktree = null;

  for (const candidate of parseWorktrees(worktreesRaw, root)) {
    if ((await realPathForCompare(candidate.path)) === requestedPath) {
      worktree = candidate;
      break;
    }
  }

  if (!worktree) {
    throw new Error("Worktree is not part of the current repository.");
  }

  return readGitSnapshot(worktree.path, view);
}

async function initializeRepository(folderPath, view) {
  const folder = await readFolderWithoutGit(folderPath);
  await initGitRepository(folder.path);
  const gitIgnore = await writeStarterGitIgnore(folder.path);
  const snapshot = await readGitSnapshot(folder.path, view);

  return {
    snapshot,
    gitIgnoreCreated: gitIgnore.created,
  };
}

module.exports = {
  checkout,
  createBranch,
  defaultCommitLogLimit,
  graphContextForWorktrees,
  initializeRepository,
  isNotGitRepositoryError,
  logArgsForView,
  merge,
  mergeArgs,
  normalizeCommitLogLimit,
  normalizeView,
  openWorktree,
  readFolderWithoutGit,
  readGitSnapshot,
  repositoryStateForGit,
  runGit,
};
