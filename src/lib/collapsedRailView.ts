import { branchDisplayName } from "./branchNames";
import type { GitSnapshot, WorkingTreeCounts } from "../types";

export type CollapsedRailRepositoryIcon = "branch" | "folder";

export function workingTreeChangeCount(counts: WorkingTreeCounts) {
  return counts.modified + counts.staged + counts.untracked;
}

function normalizeBranchColorKey(ref: string) {
  return ref
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\//, "")
    .replace(/^origin\//, "")
    .toLowerCase();
}

export function collapsedRailBranchColor(snapshot: GitSnapshot | null) {
  const branchName = snapshot?.branch.name;
  if (!snapshot || !branchName) return undefined;

  const branchKey = normalizeBranchColorKey(branchName);
  for (const commit of snapshot.commits ?? []) {
    const refIndex = commit.refs.findIndex((ref) => normalizeBranchColorKey(ref) === branchKey);
    if (refIndex >= 0) return commit.refColors[refIndex] ?? commit.branchColor;
  }

  return undefined;
}

export function collapsedRailView(snapshot: GitSnapshot | null, changedNowOpen = false) {
  const dirtyCount = snapshot ? workingTreeChangeCount(snapshot.counts) : 0;
  const repositoryIcon: CollapsedRailRepositoryIcon = snapshot ? "branch" : "folder";
  const branchName = snapshot?.branch.name ?? "Open";
  const branchColor = collapsedRailBranchColor(snapshot);
  const changedNowLabel = changedNowOpen ? "Close Changed now" : "Open Changed now";

  return {
    className: "collapsed-rail",
    ariaLabel: "Collapsed Git Peek",
    title: "Drag to move. Double-click to dock to the screen edge.",
    expandButton: {
      className: "ui-icon-button rail-expand",
      ariaLabel: "Expand Git Peek",
    },
    branch: {
      className: "rail-branch",
      label: branchDisplayName(branchName),
      title: branchName,
      ariaLabel: snapshot ? `Current branch ${branchName}` : "Open working folder",
      color: branchColor,
      icon: repositoryIcon,
    },
    dirtyCount,
    showChangedNowButton: Boolean(snapshot),
    changedNowButton: {
      className: "rail-count",
      ariaLabel: `${changedNowLabel}, ${dirtyCount} working tree changes`,
      ariaPressed: changedNowOpen,
      title: changedNowOpen ? "Close Changed now" : "Changed now",
    },
  };
}
