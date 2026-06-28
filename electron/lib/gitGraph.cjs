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
  const parsedRefs = parseRefs(refs);
  const lowerRefs = refs.toLowerCase();
  if (parsedRefs.some(refLooksLikeStashRef)) return "stash";
  if (lowerRefs.includes("release")) return "release";
  if (lowerRefs.includes("develop") || lowerRefs.includes("dev")) return "develop";
  if (lowerRefs.includes("fix") || lowerRefs.includes("hotfix")) return "fix";
  if (lowerRefs.includes("main") || lowerRefs.includes("master")) return "main";
  if (lowerRefs.includes("feature") || lowerRefs.includes("feat")) return "feature";
  if (refs.trim()) return "topic";
  return branchKindForIndex(index);
}

function refLooksLikeStashRef(ref) {
  const normalized = ref.trim().toLowerCase();
  return normalized === "refs/stash" || normalized.startsWith("stash@{") || normalized.startsWith("refs/stash@{");
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
  const branchList = Array.isArray(branches) ? branches : branches instanceof Set ? [...branches] : [];
  return new Set(branchList.filter(Boolean).map(normalizeBranchColorKey));
}

function normalizeHashSet(hashes = []) {
  const hashList = Array.isArray(hashes) ? hashes : hashes instanceof Set ? [...hashes] : [];
  return new Set(hashList.filter(Boolean));
}

function normalizeGraphContext(context = {}) {
  return {
    currentHead: context.currentHead || "",
    currentBranch: context.currentBranch ? normalizeBranchColorKey(context.currentBranch) : "",
    localBranches: normalizeBranchSet(context.localBranches),
    mergedLocalBranches: normalizeBranchSet(context.mergedLocalBranches),
    externalHeads: normalizeHashSet(context.externalHeads),
    externalBranches: normalizeBranchSet(context.externalBranches),
    containedBranchTips: Array.isArray(context.containedBranchTips) ? context.containedBranchTips : [],
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

function splitMergedLocalRefs(refs, context) {
  const visibleRefs = [];
  const mergedRefs = [];

  for (const ref of refs) {
    const branchKey = normalizeBranchColorKey(ref);
    const isCurrentBranch = branchKey && branchKey === context.currentBranch;
    if (!isCurrentBranch && context.mergedLocalBranches.has(branchKey)) {
      mergedRefs.push(ref);
    } else {
      visibleRefs.push(ref);
    }
  }

  return { refs: visibleRefs, mergedRefs };
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

function containedBranchesForCommits(commits, context) {
  const commitsByHash = new Map(commits.map((commit) => [commit.fullHash, commit]));
  const branchesByHash = new Map(commits.map((commit) => [commit.fullHash, []]));
  const seenBranchKeys = new Set();
  const branchTips = context.containedBranchTips
    .filter((branch) => branch?.name && branch?.hash)
    .filter((branch) => {
      const branchKey = normalizeBranchColorKey(branch.name);
      if (seenBranchKeys.has(branchKey)) return false;
      seenBranchKeys.add(branchKey);
      return true;
    })
    .sort((left, right) => {
      const leftKey = normalizeBranchColorKey(left.name);
      const rightKey = normalizeBranchColorKey(right.name);
      const priority = (key) => (key === "main" || key === "master" ? 0 : key === context.currentBranch ? 1 : 2);
      return priority(leftKey) - priority(rightKey) || left.name.localeCompare(right.name);
    });

  for (const branch of branchTips) {
    for (const hash of reachableHashesFrom([branch.hash], commitsByHash)) {
      branchesByHash.get(hash)?.push(branch.name);
    }
  }

  return commits.map((commit) => ({
    ...commit,
    containedBranches: branchesByHash.get(commit.fullHash) ?? [],
  }));
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

function commitIsStash(commit) {
  return commit?.lane === "stash";
}

function commitLooksLikeStashInternalParent(commit) {
  const title = (commit?.title ?? "").toLowerCase();
  return commit?.refs?.length === 0 && (title.startsWith("index on ") || title.startsWith("untracked files on "));
}

function filterStashInternalParents(commits) {
  const internalParentHashes = new Set();

  for (const commit of commits) {
    if (!commitIsStash(commit)) continue;
    commit.parents.slice(1).filter(Boolean).forEach((parentHash) => internalParentHashes.add(parentHash));
  }

  if (internalParentHashes.size === 0) return commits;
  return commits.filter((commit) => {
    return !internalParentHashes.has(commit.fullHash) || !commitLooksLikeStashInternalParent(commit);
  });
}

function graphParentsForCommit(commit) {
  if (commitIsStash(commit)) return [];
  return commit.parents.filter(Boolean);
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
              color: lane.incomingColor ?? lane.color,
              variant: lane.incomingVariant ?? lane.variant,
            },
          ]
        : [],
    );
  const findLaneColumnsByHash = (lanes, hash, exceptColumn = -1) =>
    lanes
      .map((lane, laneIndex) => (laneIndex !== exceptColumn && lane?.hash === hash ? laneIndex : -1))
      .filter((laneIndex) => laneIndex !== -1);
  const findLaneByHash = (lanes, hash, exceptColumn = -1) => findLaneColumnsByHash(lanes, hash, exceptColumn)[0] ?? -1;
  const findPreferredLaneByHash = (lanes, hash, variant, exceptColumn = -1) => {
    const columns = findLaneColumnsByHash(lanes, hash, exceptColumn);
    return (
      columns.find((laneIndex) => lanes[laneIndex]?.incomingVariant === variant) ??
      columns.find((laneIndex) => lanes[laneIndex]?.variant === variant) ??
      columns[0] ??
      -1
    );
  };
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
    const preferredVariant = lineVariantForCommit(commit, context);
    let column = findPreferredLaneByHash(activeLanes, commit.fullHash, preferredVariant);
    const currentContinues = column !== -1;
    if (column === -1) {
      const initialVariant = lineVariantForCommit(commit, context);
      column = findOpenColumn(activeLanes);
      activeLanes[column] = {
        hash: commit.fullHash,
        color: commit.branchColor,
        label: commit.refs[0] ?? "",
        variant: initialVariant,
        incomingColor: commit.branchColor,
        incomingVariant: initialVariant,
      };
    }

    const incomingColor = activeLanes[column]?.incomingColor ?? activeLanes[column]?.color ?? commit.branchColor;
    const incomingVariant = activeLanes[column]?.incomingVariant ?? activeLanes[column]?.variant ?? "solid";
    const currentVariant = lineVariantForCommit(commit, context, activeLanes[column]?.variant ?? "solid");
    activeLanes[column] = { ...activeLanes[column], variant: currentVariant };

    const before = laneSnapshots(activeLanes);
    const duplicatedCurrentLanes = before.filter((lane) => lane.column !== column && activeLanes[lane.column]?.hash === commit.fullHash);
    const currentColor = activeLanes[column]?.color ?? commit.branchColor;
    const currentLabel = activeLanes[column]?.label ?? commit.refs[0] ?? "";
    const parents = graphParentsForCommit(commit);
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

      if (existingFirstParent >= 0) {
        const { color, label } = firstParentIdentity(firstParent, currentColor, currentLabel);
        const variant = variantForParent(firstParent, currentVariant);
        after[column] = { hash: firstParent, color, label, variant, incomingColor: currentColor, incomingVariant: currentVariant };
        parentEntries.push({ column, color: currentColor, variant: currentVariant });
      } else {
        const { color, label } = firstParentIdentity(firstParent, currentColor, currentLabel);
        const variant = variantForParent(firstParent, currentVariant);
        after[column] = { hash: firstParent, color, label, variant, incomingColor: currentColor, incomingVariant: currentVariant };
        parentEntries.push({ column, color: currentColor, variant: currentVariant });
      }

      parents.slice(1).forEach((parentHash, parentIndex) => {
        let parentColumn = findLaneByHash(after, parentHash);
        const parentAlreadyActive = parentColumn !== -1;

        if (parentColumn === -1) {
          const fallbackColor = commit.lane === "stash" ? currentColor : generatedBranchColor(index + parentIndex + 1);
          const { color, label } = branchParentIdentity(parentHash, fallbackColor);
          const variant = variantForParent(parentHash, currentVariant);
          parentColumn = findOpenColumn(after, secondaryParentStartColumn);
          after[parentColumn] = { hash: parentHash, color, label, variant, incomingColor: color, incomingVariant: variant };
        }

        const parentLineColor = after[parentColumn].color;
        const parentLineVariant = after[parentColumn].variant;
        parentEntries.push({ column: parentColumn, color: parentLineColor, variant: parentLineVariant });
        bridges.push({
          fromColumn: column,
          toColumn: parentColumn,
          color: parentLineColor,
          variant: parentLineVariant,
          ...(parentAlreadyActive ? { to: "lane" } : {}),
        });
      });
    }

    duplicatedCurrentLanes.forEach((lane) => {
      passThroughLimits.set(lane.column, { to: "node" });
      bridges.push({ fromColumn: lane.column, toColumn: column, color: lane.color, variant: lane.variant, to: "lane" });
      if (after[lane.column]?.hash === commit.fullHash) after[lane.column] = null;
    });

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
        incomingColor,
        incomingVariant,
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
        isCurrentHead: Boolean(context.currentHead && commit.fullHash === context.currentHead),
      },
    };
  });
}

function parseLog(rawLog, graphContext = {}) {
  const context = normalizeGraphContext(graphContext);
  const commits = filterStashInternalParents(rawLog
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

      const parsedRefs = parseRefs(refs);
      const splitRefs = splitMergedLocalRefs(parsedRefs, context);

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
        refs: splitRefs.refs,
        mergedRefs: splitRefs.mergedRefs,
        containedBranches: [],
        lane: branchKindFromRefs(refs, index),
      };
    }));

  return buildCommitGraph(containedBranchesForCommits(assignBranchColors(commits), context), graphContext);
}

module.exports = {
  assignBranchColors,
  branchKindFromRefs,
  buildCommitGraph,
  commitMessageMaxLength,
  filterStashInternalParents,
  generatedBranchColor,
  graphParentsForCommit,
  normalizeCommitMessage,
  normalizeBranchColorKey,
  parseLog,
  parseRefs,
};
