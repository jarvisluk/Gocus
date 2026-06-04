const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const preferredBranchColors = new Map([
  ["main", "#f0a400"],
  ["master", "#f0a400"],
  ["develop", "#2f86d8"],
  ["dev", "#2f86d8"],
  ["stash", "#b276ff"],
]);

const branchColorSeeds = [
  "#f0a400",
  "#2f86d8",
  "#25b7ba",
  "#48ad62",
  "#9b66e8",
  "#d96a9f",
  "#f06d35",
  "#6f9bff",
  "#47c782",
  "#c77dff",
  "#e17b9f",
  "#36a7d8",
];

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

function parseBranchLine(line) {
  const clean = line.replace(/^##\s*/, "");
  const result = {
    name: clean,
    upstream: "",
    ahead: 0,
    behind: 0,
    detached: false,
  };

  if (clean.startsWith("HEAD ")) {
    result.name = "detached";
    result.detached = true;
    return result;
  }

  const [branchPart, metaPart = ""] = clean.split("...");
  result.name = branchPart || "main";

  if (metaPart) {
    const upstream = metaPart.replace(/\s*\[.*\]\s*$/, "");
    result.upstream = upstream;

    const aheadMatch = metaPart.match(/ahead\s+(\d+)/);
    const behindMatch = metaPart.match(/behind\s+(\d+)/);
    result.ahead = aheadMatch ? safeInteger(aheadMatch[1]) : 0;
    result.behind = behindMatch ? safeInteger(behindMatch[1]) : 0;
  }

  return result;
}

function splitStatusPath(pathText) {
  const renameMarker = " -> ";
  if (!pathText.includes(renameMarker)) return { path: pathText };
  const [originalPath, nextPath] = pathText.split(renameMarker);
  return { originalPath, path: nextPath };
}

function statusLabel(code) {
  if (code === "??") return "Untracked";
  if (code.includes("R")) return "Renamed";
  if (code.includes("C")) return "Copied";
  if (code.includes("A")) return "Added";
  if (code.includes("D")) return "Deleted";
  if (code[0] !== " " && code[1] !== " ") return "Staged and modified";
  if (code[0] !== " ") return "Staged";
  return "Modified";
}

function parseStatus(shortStatus) {
  const lines = shortStatus.split("\n").filter(Boolean);
  const branchLine = lines[0]?.startsWith("##") ? lines[0] : "## main";
  const fileLines = lines[0]?.startsWith("##") ? lines.slice(1) : lines;
  const counts = { modified: 0, staged: 0, untracked: 0 };
  const files = [];

  for (const line of fileLines) {
    const code = line.slice(0, 2);
    const pathParts = splitStatusPath(line.slice(3));
    const x = code[0];
    const y = code[1];

    if (code === "??") {
      counts.untracked += 1;
    } else {
      if (x && x !== " ") counts.staged += 1;
      if (y && y !== " ") counts.modified += 1;
    }

    files.push({
      ...pathParts,
      status: code.trim() || "M",
      indexStatus: x,
      workingTreeStatus: y,
      statusLabel: statusLabel(code),
      additions: 0,
      deletions: 0,
    });
  }

  return {
    branch: parseBranchLine(branchLine),
    counts,
    files,
  };
}

function applyNumstat(files, output) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const line of output.split("\n").filter(Boolean)) {
    const [insertions, deletions, filePath] = line.split("\t");
    if (!filePath) continue;
    const normalizedPath = filePath.replace(/^.* => /, "");
    const file = byPath.get(normalizedPath) ?? byPath.get(filePath);
    if (!file) continue;
    file.additions += insertions === "-" ? 0 : safeInteger(insertions);
    file.deletions += deletions === "-" ? 0 : safeInteger(deletions);
  }
}

function branchKindFromRefs(refs, index) {
  const lowerRefs = refs.toLowerCase();
  if (lowerRefs.includes("stash")) return "stash";
  if (lowerRefs.includes("release")) return "release";
  if (lowerRefs.includes("develop") || lowerRefs.includes("dev")) return "develop";
  if (lowerRefs.includes("fix") || lowerRefs.includes("hotfix")) return "fix";
  if (lowerRefs.includes("main") || lowerRefs.includes("master")) return "main";
  if (lowerRefs.includes("feature") || lowerRefs.includes("feat")) return "feature";
  if (refs.trim()) return "topic";
  return branchKindForIndex(index);
}

function branchKindForIndex(index) {
  return ["main", "develop", "feature", "fix", "release", "topic", "remote"][index % 7];
}

function normalizeBranchColorKey(ref) {
  return ref
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\//, "")
    .replace(/^origin\//, "")
    .toLowerCase();
}

function generatedBranchColor(index) {
  if (index < branchColorSeeds.length) return branchColorSeeds[index];

  const hue = (index * 137.508 + 24) % 360;
  const saturation = 68 + (index % 4) * 4;
  const lightness = 50 + (index % 3) * 5;
  return `hsl(${hue.toFixed(2)}deg ${saturation}% ${lightness}%)`;
}

function assignBranchColors(commits) {
  const colorsByBranchKey = new Map();
  const usedColors = new Set();
  let generatedIndex = 0;
  const nextUnusedGeneratedColor = () => {
    let color = generatedBranchColor(generatedIndex);
    generatedIndex += 1;
    while (usedColors.has(color)) {
      color = generatedBranchColor(generatedIndex);
      generatedIndex += 1;
    }
    return color;
  };
  const allocateColorForRef = (ref) => {
    const branchKey = normalizeBranchColorKey(ref);
    if (colorsByBranchKey.has(branchKey)) return colorsByBranchKey.get(branchKey);

    const preferredColor = preferredBranchColors.get(branchKey);
    const color = preferredColor && !usedColors.has(preferredColor) ? preferredColor : nextUnusedGeneratedColor();
    colorsByBranchKey.set(branchKey, color);
    usedColors.add(color);
    return color;
  };
  const branchRefs = [];
  const seenBranchKeys = new Set();

  for (const commit of commits) {
    for (const ref of commit.refs) {
      const branchKey = normalizeBranchColorKey(ref);
      if (seenBranchKeys.has(branchKey)) continue;
      seenBranchKeys.add(branchKey);
      branchRefs.push({ ref, branchKey });
    }
  }

  branchRefs
    .filter(({ branchKey }) => preferredBranchColors.has(branchKey))
    .forEach(({ ref }) => allocateColorForRef(ref));
  branchRefs
    .filter(({ branchKey }) => !preferredBranchColors.has(branchKey))
    .forEach(({ ref }) => allocateColorForRef(ref));

  return commits.map((commit, index) => {
    const refColors = commit.refs.map(allocateColorForRef);
    const branchColor = refColors[0] ?? generatedBranchColor(index);

    return {
      ...commit,
      branchColor,
      refColors,
    };
  });
}

function parseRefs(refs) {
  return refs
    .split(",")
    .map((ref) => ref.trim().replace(/^HEAD -> /, "").replace(/^tag:\s*/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function buildCommitGraph(commits) {
  const commitsByHash = new Map(commits.map((commit) => [commit.fullHash, commit]));
  let activeLanes = [];
  const laneSnapshots = (lanes) =>
    lanes.flatMap((lane, laneIndex) =>
      lane
        ? [
            {
              column: laneIndex,
              hash: lane.hash,
              color: lane.color,
            },
          ]
        : [],
    );
  const findLaneByHash = (lanes, hash, exceptColumn = -1) => lanes.findIndex((lane, laneIndex) => laneIndex !== exceptColumn && lane?.hash === hash);
  const findOpenColumn = (lanes, startColumn = 0) => {
    for (let columnIndex = Math.max(0, startColumn); columnIndex < lanes.length; columnIndex += 1) {
      if (!lanes[columnIndex]) return columnIndex;
    }
    return lanes.length;
  };
  const trimTrailingEmptyLanes = (lanes) => {
    let lastOccupiedColumn = lanes.length - 1;
    while (lastOccupiedColumn >= 0 && !lanes[lastOccupiedColumn]) {
      lastOccupiedColumn -= 1;
    }
    return lanes.slice(0, lastOccupiedColumn + 1);
  };

  return commits.map((commit, index) => {
    let column = findLaneByHash(activeLanes, commit.fullHash);
    const currentContinues = column !== -1;
    if (column === -1) {
      column = findOpenColumn(activeLanes);
      activeLanes[column] = { hash: commit.fullHash, color: commit.branchColor };
    }

    const before = laneSnapshots(activeLanes);
    const currentColor = activeLanes[column]?.color ?? commit.branchColor;
    const parents = commit.parents.filter(Boolean);
    const parentEntries = [];
    const bridges = [];
    const passThroughLimits = new Map();
    let after = activeLanes.slice();
    let secondaryParentStartColumn = column + 1;
    const colorForParent = (parentHash, fallbackColor) => {
      const parentCommit = commitsByHash.get(parentHash);
      return parentCommit?.refs.length ? parentCommit.branchColor : fallbackColor;
    };

    if (parents.length === 0) {
      after[column] = null;
    } else {
      const firstParent = parents[0];
      const existingFirstParent = findLaneByHash(after, firstParent, column);

      if (existingFirstParent > column) {
        const color = after[existingFirstParent].color;
        parentEntries.push({ column, color });
        passThroughLimits.set(existingFirstParent, { to: "node" });
        bridges.push({ fromColumn: existingFirstParent, toColumn: column, color, to: "lane" });
        after[column] = { hash: firstParent, color };
        after[existingFirstParent] = null;
      } else if (existingFirstParent >= 0) {
        const color = after[existingFirstParent].color;
        parentEntries.push({ column: existingFirstParent, color });
        bridges.push({ fromColumn: column, toColumn: existingFirstParent, color, to: "lane" });
        after[column] = null;
        secondaryParentStartColumn = column;
      } else {
        const color = colorForParent(firstParent, currentColor);
        after[column] = { hash: firstParent, color };
        parentEntries.push({ column, color });
      }

      parents.slice(1).forEach((parentHash, parentIndex) => {
        let parentColumn = findLaneByHash(after, parentHash);
        const parentAlreadyActive = parentColumn !== -1;

        if (parentColumn === -1) {
          const fallbackColor = commit.lane === "stash" ? currentColor : generatedBranchColor(index + parentIndex + 1);
          const color = colorForParent(parentHash, fallbackColor);
          parentColumn = findOpenColumn(after, secondaryParentStartColumn);
          after[parentColumn] = { hash: parentHash, color };
        }

        const color = after[parentColumn].color;
        parentEntries.push({ column: parentColumn, color });
        bridges.push({ fromColumn: column, toColumn: parentColumn, color, ...(parentAlreadyActive ? { to: "lane" } : {}) });
      });
    }

    after = trimTrailingEmptyLanes(after);
    const parentColumns = parentEntries.map((parent) => parent.column);
    const maxParentColumn = parentColumns.length ? Math.max(...parentColumns) + 1 : 1;
    const laneCount = Math.max(1, activeLanes.length, after.length, column + 1, maxParentColumn);
    const parentStems = parentEntries.filter((parent, parentIndex, entries) => {
      return parent.column === column && entries.findIndex((entry) => entry.column === parent.column) === parentIndex;
    });

    activeLanes = after;

    return {
      ...commit,
      graph: {
        column,
        laneCount,
        currentColor,
        currentContinues,
        passThrough: before
          .filter((lane) => lane.column !== column)
          .map((lane) => ({ column: lane.column, color: lane.color, ...(passThroughLimits.get(lane.column) ?? {}) })),
        parentStems,
        bridges,
        isMerge: parents.length > 1,
      },
    };
  });
}

function parseLog(rawLog) {
  const commits = rawLog
    .split("\x1e")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const hasMetadataDelimiter = block.includes("\x1d");
      const [metadataBlock, statBlock] = hasMetadataDelimiter
        ? block.split("\x1d")
        : (() => {
            const [legacyHeader = "", ...legacyStatLines] = block.split("\n");
            return [legacyHeader, legacyStatLines.join("\n")];
          })();
      const [fullHash, hash, parentsText = "", author, relativeTime, subject, refs = "", ...messageParts] = metadataBlock.split("\x1f");
      const message = messageParts.join("\x1f").trim() || subject || "Untitled commit";
      let additions = 0;
      let deletions = 0;
      let filesChanged = 0;

      for (const line of statBlock.split("\n")) {
        const [insertions, removed] = line.split("\t");
        if (!insertions || !removed) continue;
        additions += insertions === "-" ? 0 : safeInteger(insertions);
        deletions += removed === "-" ? 0 : safeInteger(removed);
        filesChanged += 1;
      }

      return {
        id: fullHash,
        fullHash,
        hash,
        title: subject || "Untitled commit",
        message,
        author: author || "Unknown",
        relativeTime: relativeTime || "",
        additions,
        deletions,
        filesChanged,
        parents: parentsText.split(" ").filter(Boolean),
        refs: parseRefs(refs),
        lane: branchKindFromRefs(refs, index),
      };
    });

  return buildCommitGraph(assignBranchColors(commits));
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
  const args = [
    "log",
    "--topo-order",
    "--date=relative",
    "--pretty=format:%x1e%H%x1f%h%x1f%P%x1f%an%x1f%ar%x1f%s%x1f%D%x1f%B%x1d%n",
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

function parseWorktrees(output, currentRoot) {
  return output
    .split(/\n\s*\n/)
    .map((block) => {
      const worktree = {
        path: "",
        branch: "",
        head: "",
        detached: false,
        bare: false,
        current: false,
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

async function readGitSnapshot(repoPath, view = { mode: "all" }) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const shortStatus = await runGit(root, ["status", "--porcelain=v1", "-b"]);
  const status = parseStatus(shortStatus);

  const [repositoryKey, unstagedStats, stagedStats, branchesRaw, worktreesRaw] = await Promise.all([
    gitCommonDirKey(root),
    runGit(root, ["diff", "--numstat"]).catch(() => ""),
    runGit(root, ["diff", "--cached", "--numstat"]).catch(() => ""),
    runGit(root, ["for-each-ref", "--format=%(refname:short)%00%(refname)%00%(upstream:short)%00%(HEAD)", "refs/heads", "refs/remotes", "refs/tags"]).catch(() => ""),
    runGit(root, ["worktree", "list", "--porcelain"]).catch(() => ""),
  ]);
  const worktrees = parseWorktrees(worktreesRaw, root);
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
    branches: parseBranches(branchesRaw, status.branch.name),
    worktrees,
    view: logRequest.view,
    counts: status.counts,
    commits: annotateCommitsWithWorktrees(parseLog(logRaw), worktrees),
    changedFiles: status.files.slice(0, 24),
    lastFetchedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    isSample: false,
  };
}

async function assertBranchName(root, branchName) {
  await runGit(root, ["check-ref-format", "--branch", branchName]);
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

module.exports = {
  checkout,
  createBranch,
  normalizeView,
  openWorktree,
  readGitSnapshot,
  runGit,
};
