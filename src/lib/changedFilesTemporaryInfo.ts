import type { GitSnapshot, TemporaryInfoPayload, WorkspaceOpenTarget } from "../types";

interface ChangedFilesTemporaryInfoOptions {
  snapshot: Pick<GitSnapshot, "changedFiles"> | null;
  changedNowWindowOpen: boolean;
  collapsed: boolean;
  collapsedRailChangedNowOpen: boolean;
  settingsOpen: boolean;
  workspaceOpenTarget: WorkspaceOpenTarget | "";
}

export function changedFilesTemporaryInfoPayload({
  snapshot,
  changedNowWindowOpen,
  collapsed,
  collapsedRailChangedNowOpen,
  settingsOpen,
  workspaceOpenTarget,
}: ChangedFilesTemporaryInfoOptions): TemporaryInfoPayload {
  if (!snapshot || !changedNowWindowOpen || settingsOpen) return null;
  if (collapsed && !collapsedRailChangedNowOpen) return null;

  return {
    kind: "changed-files",
    files: snapshot.changedFiles,
    filter: "all",
    selectedFileKey: "",
    workspaceOpenTarget,
  };
}
