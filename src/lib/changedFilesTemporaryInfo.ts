import type { GitSnapshot, TemporaryInfoPayload } from "../types";

interface ChangedFilesTemporaryInfoOptions {
  snapshot: Pick<GitSnapshot, "changedFiles"> | null;
  changedNowWindowOpen: boolean;
  collapsed: boolean;
  collapsedRailChangedNowOpen: boolean;
  settingsOpen: boolean;
  zenActive: boolean;
}

export function changedFilesTemporaryInfoPayload({
  snapshot,
  changedNowWindowOpen,
  collapsed,
  collapsedRailChangedNowOpen,
  settingsOpen,
  zenActive,
}: ChangedFilesTemporaryInfoOptions): TemporaryInfoPayload {
  if (!snapshot || !changedNowWindowOpen || settingsOpen || zenActive) return null;
  if (collapsed && !collapsedRailChangedNowOpen) return null;

  return {
    kind: "changed-files",
    files: snapshot.changedFiles,
    filter: "all",
    selectedFileKey: "",
  };
}
