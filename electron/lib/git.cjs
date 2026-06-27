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
  "# Gocus starter .gitignore",
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
const dirtyWorkspaceMergeNotice = "Workspace has uncommitted changes. Commit them before merging.";
const cleanupFallbackBaseBranchCandidates = ["main", "master", "develop", "trunk"];

function normalizeCommitLogLimit(value = process.env.GOCUS_COMMIT_LOG_LIMIT) {
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
    .filter((branch) => branch.name && !branch.name.endsWith("/HEAD") && !branch.fullName.endsWith("/HEAD"));
}

function localBranchNameForRemoteRef(ref) {
  const cleanRef = `${ref ?? ""}`.trim();
  if (!cleanRef || cleanRef.endsWith("/HEAD")) return "";
  const parts = cleanRef.split("/");
  if (parts.length < 2) return "";
  return parts.slice(1).join("/");
}

async function gitRefExists(root, refName) {
  if (!refName) return false;
  return runGit(root, ["show-ref", "--verify", "--quiet", refName]).then(() => true, () => false);
}

async function checkoutArgsForRef(root, ref) {
  const cleanRef = `${ref ?? ""}`.trim();
  const remoteRefName = `refs/remotes/${cleanRef}`;
  const localBranchName = localBranchNameForRemoteRef(cleanRef);
  const remoteBranchExists = await gitRefExists(root, remoteRefName);

  if (!remoteBranchExists || !localBranchName) return ["checkout", cleanRef];

  const localBranchExists = await gitRefExists(root, `refs/heads/${localBranchName}`);
  if (localBranchExists) return ["checkout", localBranchName];
  return ["checkout", "--track", "-b", localBranchName, cleanRef];
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

function defaultWorktreeCleanup(overrides = {}) {
  return {
    status: "unknown",
    safeToRemove: false,
    action: "none",
    reason: "Audit unavailable.",
    detail: "Refresh Git status before cleaning up this worktree.",
    baseBranch: "",
    uniquePatchCount: null,
    containedBranches: [],
    prunableReason: "",
    ...overrides,
  };
}

function parseWorktrees(output) {
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
        cleanup: defaultWorktreeCleanup(),
      };

      for (const line of block.split("\n").filter(Boolean)) {
        const [key, ...valueParts] = line.split(" ");
        const value = valueParts.join(" ");
        if (key === "worktree") worktree.path = value;
        if (key === "HEAD") worktree.head = value;
        if (key === "branch") worktree.branch = value.replace(/^refs\/heads\//, "");
        if (key === "detached") worktree.detached = true;
        if (key === "bare") worktree.bare = true;
        if (key === "prunable") {
          worktree.cleanup = defaultWorktreeCleanup({
            status: "prunable",
            safeToRemove: true,
            action: "prune",
            reason: "Stale metadata.",
            detail: value || "Git reports this worktree metadata can be pruned.",
            prunableReason: value,
          });
        }
      }

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

function hasWorktreeChanges(counts = {}) {
  return Boolean(counts.modified || counts.staged || counts.untracked);
}

function cleanupBaseBranchCandidateRefNames(branchName) {
  if (!branchName) return [];
  if (branchName.startsWith("refs/")) return [branchName];

  return [`refs/heads/${branchName}`, `refs/remotes/${branchName}`];
}

function appendCleanupBaseBranchCandidate(candidates, branchName) {
  const cleanBranchName = `${branchName ?? ""}`.trim();
  if (!cleanBranchName || cleanBranchName === "HEAD" || cleanBranchName.endsWith("/HEAD")) return;
  if (candidates.includes(cleanBranchName)) return;
  candidates.push(cleanBranchName);
}

async function cleanupBaseBranch(root) {
  const candidates = [];
  const currentBranch = await runGit(root, ["branch", "--show-current"]).catch(() => "");
  const upstreamBranch = await runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).catch(() => "");
  const originHead = await runGit(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).catch(() => "");

  appendCleanupBaseBranchCandidate(candidates, currentBranch);
  appendCleanupBaseBranchCandidate(candidates, upstreamBranch);
  appendCleanupBaseBranchCandidate(candidates, originHead);
  for (const branchName of cleanupFallbackBaseBranchCandidates) {
    appendCleanupBaseBranchCandidate(candidates, branchName);
  }

  for (const branchName of candidates) {
    for (const refName of cleanupBaseBranchCandidateRefNames(branchName)) {
      const exists = await runGit(root, ["show-ref", "--verify", refName]).then(() => true, () => false);
      if (exists) return branchName;
    }
  }

  return "";
}

function parseContainedBranches(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => !name.startsWith("("));
}

async function containedBranchesForHead(root, head) {
  if (!head) return [];
  const output = await runGit(root, ["branch", "--format=%(refname:short)", "--contains", head]).catch(() => "");
  return parseContainedBranches(output);
}

async function headIsAncestorOfBranch(root, head, branchName) {
  if (!head || !branchName) return false;
  return runGit(root, ["merge-base", "--is-ancestor", head, branchName]).then(() => true, () => false);
}

async function uniquePatchCountFromBranch(root, branchName, head) {
  if (!branchName || !head) return null;
  const output = await runGit(root, ["rev-list", "--right-only", "--cherry-pick", "--count", `${branchName}...${head}`]).catch(
    () => "",
  );
  const parsed = Number.parseInt(output.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function comparableWorktreePath(value) {
  const resolvedPath = path.resolve(value);
  const suffix = [];
  let currentPath = resolvedPath;

  while (true) {
    try {
      return path.join(await fs.realpath(currentPath), ...suffix.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") return resolvedPath;
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) return resolvedPath;
      suffix.push(path.basename(currentPath));
      currentPath = parentPath;
    }
  }
}

async function markCurrentWorktrees(worktrees, currentRoot) {
  const currentPath = await comparableWorktreePath(currentRoot);

  return Promise.all(
    worktrees.map(async (worktree) => ({
      ...worktree,
      current: (await comparableWorktreePath(worktree.path)) === currentPath,
    })),
  );
}

async function auditWorktreeCleanup(root, worktree) {
  if (worktree.cleanup?.status === "prunable") return worktree;

  if (worktree.bare) {
    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        reason: "Bare repository.",
        detail: "Bare repositories are not cleanup candidates.",
      }),
    };
  }

  if (worktree.current) {
    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        status: "current",
        reason: "Current worktree.",
        detail: "Open another worktree before removing this one.",
      }),
    };
  }

  if (hasWorktreeChanges(worktree.counts)) {
    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        status: "dirty",
        reason: "Uncommitted changes.",
        detail: "Commit, stash, or discard local changes before removing this worktree.",
      }),
    };
  }

  if (!worktree.detached) {
    const branchName = worktree.branch || "this branch";
    const baseBranch = await cleanupBaseBranch(root);
    const branchIsBase = worktree.branch === baseBranch;
    const [headContainedByBase, uniquePatchCount] = await Promise.all([
      headIsAncestorOfBranch(root, worktree.head, baseBranch),
      uniquePatchCountFromBranch(root, baseBranch, worktree.head),
    ]);

    if (!branchIsBase && headContainedByBase) {
      return {
        ...worktree,
        cleanup: defaultWorktreeCleanup({
          status: "merged",
          safeToRemove: true,
          action: "remove",
          reason: `Merged into ${baseBranch}.`,
          detail: `This clean branch worktree has already been merged into ${baseBranch}.`,
          baseBranch,
          uniquePatchCount,
          containedBranches: worktree.branch ? [worktree.branch] : [],
        }),
      };
    }

    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        status: "branch-preserved",
        safeToRemove: true,
        action: "remove",
        reason: "Branch preserved.",
        detail: `This clean worktree can be removed because ${branchName} preserves its HEAD.`,
        containedBranches: worktree.branch ? [worktree.branch] : [],
      }),
    };
  }

  const [baseBranch, containedBranches] = await Promise.all([cleanupBaseBranch(root), containedBranchesForHead(root, worktree.head)]);
  const [headContainedByBase, uniquePatchCount] = await Promise.all([
    headIsAncestorOfBranch(root, worktree.head, baseBranch),
    uniquePatchCountFromBranch(root, baseBranch, worktree.head),
  ]);

  if (headContainedByBase) {
    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        status: "merged",
        safeToRemove: true,
        action: "remove",
        reason: `Contained by ${baseBranch}.`,
        detail: "This clean detached worktree points to history already reachable from the base branch.",
        baseBranch,
        uniquePatchCount,
        containedBranches,
      }),
    };
  }

  if (containedBranches.length) {
    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        status: "branch-preserved",
        safeToRemove: true,
        action: "remove",
        reason: "HEAD has a branch.",
        detail: `The detached shell can be removed because ${containedBranches[0]} still preserves this HEAD.`,
        baseBranch,
        uniquePatchCount,
        containedBranches,
      }),
    };
  }

  if (uniquePatchCount === 0) {
    return {
      ...worktree,
      cleanup: defaultWorktreeCleanup({
        status: "patch-equivalent",
        safeToRemove: true,
        action: "remove",
        reason: `No unique patch vs ${baseBranch}.`,
        detail: "Git's cherry-pick comparison found no patch content that only exists in this detached worktree.",
        baseBranch,
        uniquePatchCount,
        containedBranches,
      }),
    };
  }

  return {
    ...worktree,
    cleanup: defaultWorktreeCleanup({
      status: "review",
      reason: "Needs review.",
      detail: "This clean detached worktree still has unique patch content and no branch preserving its HEAD.",
      baseBranch,
      uniquePatchCount,
      containedBranches,
    }),
  };
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

async function enrichWorktree(root, worktree) {
  if (worktree.bare || !worktree.path) return worktree;

  const [headRaw, statusRaw] = await Promise.all([
    worktree.head
      ? runGit(root, ["show", "-s", "--date=relative", "--format=%h%x1f%s%x1f%cr", worktree.head]).catch(() => "")
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
  const parsedWorktrees = await markCurrentWorktrees(parseWorktrees(worktreesRaw), root);
  const enrichedWorktrees = await Promise.all(parsedWorktrees.map((worktree) => enrichWorktree(root, worktree)));
  const worktrees = await Promise.all(enrichedWorktrees.map((worktree) => auditWorktreeCleanup(root, worktree)));
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
  await runGit(root, await checkoutArgsForRef(root, ref));
  return readGitSnapshot(root, view);
}

function normalizeMergeOptions(options) {
  return {
    createMergeCommit: options?.createMergeCommit !== false,
  };
}

function cleanMergeMessagePart(value, fallback) {
  const clean = `${value ?? ""}`.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  if (/^[0-9a-f]{12,}$/i.test(clean)) return clean.slice(0, 7);
  return clean;
}

function mergeMessage(ref, targetBranch) {
  const source = cleanMergeMessagePart(ref, "ref");
  const target = cleanMergeMessagePart(targetBranch, "current branch");
  return `chore: merge ${source} into ${target}`;
}

function mergeArgs(ref, targetBranch, options) {
  const normalizedOptions = normalizeMergeOptions(options);
  const args = ["merge", "-m", mergeMessage(ref, targetBranch)];
  if (normalizedOptions.createMergeCommit) args.push("--no-ff");
  args.push(ref);
  return args;
}

function statusHasUncommittedChanges(status) {
  return Boolean(status.files.length || status.counts.modified || status.counts.staged || status.counts.untracked);
}

async function assertCleanWorkspaceForMerge(root) {
  const shortStatus = await runGit(root, ["status", "--porcelain=v1", "-b"]);
  if (statusHasUncommittedChanges(parseStatus(shortStatus))) throw new Error(dirtyWorkspaceMergeNotice);
}

async function merge(repoPath, ref, targetBranch, view, options) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  await assertLocalBranch(root, targetBranch);
  await assertCleanWorkspaceForMerge(root);
  await runGit(root, ["checkout", targetBranch]);
  await runGit(root, mergeArgs(ref, targetBranch, options));
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

  for (const candidate of parseWorktrees(worktreesRaw)) {
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

async function cleanupWorktree(repoPath, worktreePath, view) {
  if (typeof worktreePath !== "string" || !worktreePath.trim()) {
    throw new Error("Worktree path is required.");
  }

  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const worktreesRaw = await runGit(root, ["worktree", "list", "--porcelain"]);
  const parsedWorktrees = await markCurrentWorktrees(parseWorktrees(worktreesRaw), root);
  const enrichedWorktrees = await Promise.all(parsedWorktrees.map((worktree) => enrichWorktree(root, worktree)));
  const worktrees = await Promise.all(enrichedWorktrees.map((worktree) => auditWorktreeCleanup(root, worktree)));
  const targetPath = await comparableWorktreePath(worktreePath);
  let worktree = null;

  for (const candidate of worktrees) {
    if ((await comparableWorktreePath(candidate.path)) === targetPath) {
      worktree = candidate;
      break;
    }
  }

  if (!worktree) {
    throw new Error("Worktree is not part of the current repository.");
  }

  if (!worktree.cleanup?.safeToRemove) {
    throw new Error(worktree.cleanup?.detail || "This worktree is not safe to remove.");
  }

  if (worktree.cleanup.action === "prune") {
    await runGit(root, ["worktree", "prune"]);
    return readGitSnapshot(root, view);
  }

  if (worktree.cleanup.action !== "remove") {
    throw new Error("This worktree does not have a cleanup action.");
  }

  await runGit(root, ["worktree", "remove", worktree.path]);
  return readGitSnapshot(root, view);
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
  checkoutArgsForRef,
  cleanupWorktree,
  createBranch,
  defaultCommitLogLimit,
  dirtyWorkspaceMergeNotice,
  graphContextForWorktrees,
  initializeRepository,
  isNotGitRepositoryError,
  logArgsForView,
  merge,
  mergeArgs,
  mergeMessage,
  normalizeCommitLogLimit,
  normalizeView,
  openWorktree,
  readFolderWithoutGit,
  readGitSnapshot,
  repositoryStateForGit,
  runGit,
};
