import type { GitSnapshot } from "../types";

export const dirtyWorkspaceMergeNotice = "Workspace has uncommitted changes. Commit them before merging.";

export function snapshotHasUncommittedChanges(snapshot: GitSnapshot | null) {
  if (!snapshot) return false;
  return Boolean(
    snapshot.changedFiles.length ||
      snapshot.counts.modified ||
      snapshot.counts.staged ||
      snapshot.counts.untracked,
  );
}
