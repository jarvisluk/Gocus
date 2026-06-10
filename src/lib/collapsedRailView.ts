import type { GitSnapshot, WorkingTreeCounts } from "../types";

export type CollapsedRailRepositoryIcon = "branch" | "folder";

export function workingTreeChangeCount(counts: WorkingTreeCounts) {
  return counts.modified + counts.staged + counts.untracked;
}

export function collapsedRailView(snapshot: GitSnapshot | null, changedNowOpen = false) {
  const dirtyCount = snapshot ? workingTreeChangeCount(snapshot.counts) : 0;
  const repositoryIcon: CollapsedRailRepositoryIcon = snapshot ? "branch" : "folder";
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
      label: snapshot?.branch.name ?? "Open",
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
