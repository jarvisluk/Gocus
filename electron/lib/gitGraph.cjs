const { safeInteger } = require("./gitCore.cjs");

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

const commitMessageMaxLength = 4000;

function normalizeCommitMessage(message, fallback) {
  const cleanMessage = (message || fallback || "Untitled commit").trim();
  if (cleanMessage.length <= commitMessageMaxLength) return cleanMessage;
  return `${cleanMessage.slice(0, commitMessageMaxLength - 3)}...`;
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

function normalizeBranchSet(branches = []) {
  return new Set(branches.filter(Boolean).map(normalizeBranchColorKey));
}

function normalizeGraphContext(context = {}) {
  return {
    currentHead: context.currentHead || "",
    currentBranch: context.currentBranch ? normalizeBranchColorKey(context.currentBranch) : "",
    localBranches: normalizeBranchSet(context.localBranches),
    externalHeads: new Set((context.externalHeads ?? []).filter(Boolean)),
    externalBranches: normalizeBranchSet(context.externalBranches),
    currentReachable: new Set(),
    externalOnlyReachable: new Set(),
  };
}

function commitRefsIncludeBranch(commit, branchName) {
  if (!branchName) return false;
  return commit.refs.some((ref) => normalizeBranchColorKey(ref) === branchName);
}

function commitRefsIncludeAnyBranch(commit, branches) {
  if (!branches.size) return false;
  return commit.refs.some((ref) => branches.has(normalizeBranchColorKey(ref)));
}

function preferredRefIndex(commit) {
  return commit.refs.findIndex((ref) => preferredBranchColors.has(normalizeBranchColorKey(ref)));
}

function reachableHashesFrom(startHashes, commitsByHash) {
  const reachable = new Set();
  const stack = [...startHashes].filter((hash) => hash && commitsByHash.has(hash));

  while (stack.length) {
    const hash = stack.pop();
    if (!hash || reachable.has(hash)) continue;

    reachable.add(hash);
    const commit = commitsByHash.get(hash);
    if (!commit) continue;
    stack.push(...commit.parents);
  }

  return reachable;
}

function graphContextWithReachability(context, commits, commitsByHash) {
  const currentStarts = new Set(context.currentHead ? [context.currentHead] : []);
  const externalStarts = new Set(context.externalHeads);

  for (const commit of commits) {
    if (commitRefsIncludeBranch(commit, context.currentBranch)) currentStarts.add(commit.fullHash);
    if (commitRefsIncludeAnyBranch(commit, context.localBranches)) currentStarts.add(commit.fullHash);
    if (commitRefsIncludeAnyBranch(commit, context.externalBranches)) externalStarts.add(commit.fullHash);
  }

  const currentReachable = reachableHashesFrom(currentStarts, commitsByHash);
  const externalReachable = reachableHashesFrom(externalStarts, commitsByHash);
  const externalOnlyReachable = new Set([...externalReachable].filter((hash) => !currentReachable.has(hash)));

  return {
    ...context,
    currentReachable,
    externalOnlyReachable,
  };
}

function lineVariantForCommit(commit, context, fallback = "solid") {
  if (context.currentHead && commit.fullHash === context.currentHead) return "solid";
  if (commitRefsIncludeBranch(commit, context.currentBranch)) return "solid";
  if (context.currentReachable.has(commit.fullHash)) return "solid";
  if (context.externalOnlyReachable.has(commit.fullHash)) return "dashed";
  return fallback;
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

function buildCommitGraph(commits, graphContext = {}) {
  const commitsByHash = new Map(commits.map((commit) => [commit.fullHash, commit]));
  const context = graphContextWithReachability(normalizeGraphContext(graphContext), commits, commitsByHash);
  let activeLanes = [];
  const laneSnapshots = (lanes) =>
    lanes.flatMap((lane, laneIndex) =>
      lane
        ? [
            {
              column: laneIndex,
              hash: lane.hash,
              color: lane.color,
              variant: lane.variant,
            },
          ]
        : [],
    );
  const findLaneByHash = (lanes, hash, exceptColumn = -1) =>
    lanes.findIndex((lane, laneIndex) => laneIndex !== exceptColumn && lane?.hash === hash);
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
      activeLanes[column] = {
        hash: commit.fullHash,
        color: commit.branchColor,
        label: commit.refs[0] ?? "",
        variant: lineVariantForCommit(commit, context),
      };
    }

    const currentVariant = lineVariantForCommit(commit, context, activeLanes[column]?.variant ?? "solid");
    activeLanes[column] = { ...activeLanes[column], variant: currentVariant };

    const before = laneSnapshots(activeLanes);
    const currentColor = activeLanes[column]?.color ?? commit.branchColor;
    const currentLabel = activeLanes[column]?.label ?? commit.refs[0] ?? "";
    const parents = commit.parents.filter(Boolean);
    const parentEntries = [];
    const bridges = [];
    const passThroughLimits = new Map();
    let after = activeLanes.slice();
    let secondaryParentStartColumn = column + 1;
    const refIdentityForParent = (parentHash, { preferredOnly = false } = {}) => {
      const parentCommit = commitsByHash.get(parentHash);
      if (!parentCommit?.refs.length) return null;

      const refIndex = preferredOnly ? preferredRefIndex(parentCommit) : 0;
      if (refIndex < 0) return null;

      return {
        color: parentCommit.refColors[refIndex] ?? parentCommit.branchColor,
        label: parentCommit.refs[refIndex] ?? "",
      };
    };
    const firstParentIdentity = (parentHash, fallbackColor, fallbackLabel) => {
      const preferredIdentity = refIdentityForParent(parentHash, { preferredOnly: true });
      return preferredIdentity ?? { color: fallbackColor, label: fallbackLabel };
    };
    const branchParentIdentity = (parentHash, fallbackColor, fallbackLabel = "") => {
      const branchIdentity = refIdentityForParent(parentHash);
      return branchIdentity ?? { color: fallbackColor, label: fallbackLabel };
    };
    const variantForParent = (parentHash, fallbackVariant) => {
      const parentCommit = commitsByHash.get(parentHash);
      return parentCommit ? lineVariantForCommit(parentCommit, context, fallbackVariant) : fallbackVariant;
    };

    if (parents.length === 0) {
      after[column] = null;
    } else {
      const firstParent = parents[0];
      const existingFirstParent = findLaneByHash(after, firstParent, column);

      if (existingFirstParent > column) {
        const activeParentColor = after[existingFirstParent].color;
        const activeParentVariant = after[existingFirstParent].variant;
        const { color, label } = firstParentIdentity(firstParent, currentColor, currentLabel);
        const variant = variantForParent(firstParent, currentVariant);
        parentEntries.push({ column, color, variant });
        passThroughLimits.set(existingFirstParent, { to: "node" });
        bridges.push({
          fromColumn: existingFirstParent,
          toColumn: column,
          color: activeParentColor,
          variant: activeParentVariant,
          to: "lane",
        });
        after[column] = { hash: firstParent, color, label, variant };
        after[existingFirstParent] = null;
      } else if (existingFirstParent >= 0) {
        const color = after[existingFirstParent].color;
        const variant = after[existingFirstParent].variant;
        parentEntries.push({ column: existingFirstParent, color, variant });
        bridges.push({ fromColumn: column, toColumn: existingFirstParent, color, variant: currentVariant, to: "lane" });
        after[column] = null;
        secondaryParentStartColumn = column;
      } else {
        const { color, label } = firstParentIdentity(firstParent, currentColor, currentLabel);
        const variant = variantForParent(firstParent, currentVariant);
        after[column] = { hash: firstParent, color, label, variant };
        parentEntries.push({ column, color, variant });
      }

      parents.slice(1).forEach((parentHash, parentIndex) => {
        let parentColumn = findLaneByHash(after, parentHash);
        const parentAlreadyActive = parentColumn !== -1;

        if (parentColumn === -1) {
          const fallbackColor = commit.lane === "stash" ? currentColor : generatedBranchColor(index + parentIndex + 1);
          const { color, label } = branchParentIdentity(parentHash, fallbackColor);
          const variant = variantForParent(parentHash, currentVariant);
          parentColumn = findOpenColumn(after, secondaryParentStartColumn);
          after[parentColumn] = { hash: parentHash, color, label, variant };
        }

        const color = after[parentColumn].color;
        const variant = after[parentColumn].variant;
        parentEntries.push({ column: parentColumn, color, variant });
        bridges.push({
          fromColumn: column,
          toColumn: parentColumn,
          color,
          variant: currentVariant,
          ...(parentAlreadyActive ? { to: "lane" } : {}),
        });
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
        currentLabel,
        currentVariant,
        currentContinues,
        passThrough: before
          .filter((lane) => lane.column !== column)
          .map((lane) => ({
            column: lane.column,
            color: lane.color,
            variant: lane.variant,
            ...(passThroughLimits.get(lane.column) ?? {}),
          })),
        parentStems,
        bridges,
        isMerge: parents.length > 1,
      },
    };
  });
}

function parseLog(rawLog, graphContext = {}) {
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
      const metadata = metadataBlock.split("\x1f");
      const [fullHash, hash, parentsText = "", author, relativeTime] = metadata;
      const hasAuthoredAt = metadata.length >= 9;
      const authoredAt = hasAuthoredAt ? metadata[5] : "";
      const subject = hasAuthoredAt ? metadata[6] : metadata[5];
      const refs = hasAuthoredAt ? metadata[7] ?? "" : metadata[6] ?? "";
      const messageParts = metadata.slice(hasAuthoredAt ? 8 : 7);
      const message = normalizeCommitMessage(messageParts.join("\x1f"), subject);
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
        authoredAt: authoredAt || "",
        additions,
        deletions,
        filesChanged,
        parents: parentsText.split(" ").filter(Boolean),
        refs: parseRefs(refs),
        lane: branchKindFromRefs(refs, index),
      };
    });

  return buildCommitGraph(assignBranchColors(commits), graphContext);
}

module.exports = {
  assignBranchColors,
  branchKindFromRefs,
  buildCommitGraph,
  commitMessageMaxLength,
  generatedBranchColor,
  normalizeCommitMessage,
  normalizeBranchColorKey,
  parseLog,
  parseRefs,
};
