export const gitActionBridgeRequiredNotice = "Electron mode is required for Git actions.";
export const initializeRepositoryBridgeRequiredNotice = "Electron mode is required to initialize a Git repository.";
export const missingFolderWithoutGitNotice = "Choose a folder without Git first.";
export const missingWorkingFolderNotice = "Choose a working folder first.";
export const chooseLocalWorkingFolderInElectronNotice = "Run the Electron app to choose a local working folder.";
export const previewRefreshDelayMs = 400;
export const previewRefreshNotice = "Preview refreshed.";

export type LocalFolderBridgeAction = "open" | "switch";
export type RefreshSnapshotAvailability =
  | { kind: "blocked"; notice: string }
  | { kind: "preview" }
  | { kind: "bridge" };

const localFolderBridgeRequiredNotices: Record<LocalFolderBridgeAction, string> = {
  open: "Electron mode is required to open a local folder.",
  switch: "Electron mode is required to switch local folders.",
};

export function gitActionBridgeNotice(bridgeAvailable: boolean): string | null {
  return bridgeAvailable ? null : gitActionBridgeRequiredNotice;
}

export function localFolderBridgeNotice(action: LocalFolderBridgeAction, bridgeAvailable: boolean): string | null {
  return bridgeAvailable ? null : localFolderBridgeRequiredNotices[action];
}

export function initializeRepositoryAvailabilityNotice(options: {
  bridgeAvailable: boolean;
  hasFolderWithoutGit: boolean;
}): string | null {
  if (!options.hasFolderWithoutGit) return missingFolderWithoutGitNotice;
  return options.bridgeAvailable ? null : initializeRepositoryBridgeRequiredNotice;
}

export function refreshSnapshotAvailability(options: {
  bridgeAvailable: boolean;
  hasSnapshot: boolean;
}): RefreshSnapshotAvailability {
  if (options.bridgeAvailable) return { kind: "bridge" };
  if (options.hasSnapshot) return { kind: "preview" };
  return { kind: "blocked", notice: chooseLocalWorkingFolderInElectronNotice };
}

export function previewRefreshCompletion() {
  return {
    delayMs: previewRefreshDelayMs,
    notice: previewRefreshNotice,
  };
}

export function workspaceActionAvailabilityNotice(options: {
  bridgeAvailable: boolean;
  hasSnapshot: boolean;
}): string | null {
  return options.bridgeAvailable && options.hasSnapshot ? null : missingWorkingFolderNotice;
}
