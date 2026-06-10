import type { FolderWithoutGit, SnapshotResponse } from "../types";
import { commitSelectionVisible } from "./commitListView";
import { repositoryStateNotice } from "./repositoryStateView";

export const defaultSnapshotFailureNotice = "Choose a working folder to start.";

export type FolderWithoutGitDecision = FolderWithoutGit | null | undefined;

export function snapshotResponseNotice(
  response: SnapshotResponse,
  successNotice: string | null | undefined = "Live Git data connected.",
) {
  if (response.ok) return successNotice === null ? null : repositoryStateNotice(response.snapshot.repositoryState) || successNotice || null;
  if (response.canceled) return null;
  if (response.reason === "not_git_repository") {
    return response.error ?? `${response.folder.name} does not have Git initialized yet.`;
  }

  return response.error ?? defaultSnapshotFailureNotice;
}

export function selectedCommitIdAfterSnapshotResponse(
  response: SnapshotResponse,
  currentSelectedCommitId: string,
) {
  if (response.ok) {
    return commitSelectionVisible(response.snapshot.commits, currentSelectedCommitId) ? currentSelectedCommitId : "";
  }

  return response.canceled ? currentSelectedCommitId : "";
}

export function folderWithoutGitAfterSnapshotResponse(response: SnapshotResponse): FolderWithoutGitDecision {
  if (response.ok) return null;
  if (response.canceled) return undefined;
  if (response.reason === "not_git_repository") return response.folder;
  return null;
}
