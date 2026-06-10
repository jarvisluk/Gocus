import type { GitRepositoryState } from "../types";
import { politeStatusView } from "./statusView";

export function repositoryStateActive(state: GitRepositoryState | null | undefined) {
  return Boolean(state && (state.operation !== "none" || state.hasConflicts));
}

function conflictedFilesLabel(count: number) {
  if (count === 1) return "1 conflicted file";
  return `${count} conflicted files`;
}

export function repositoryStateNotice(state: GitRepositoryState | null | undefined) {
  if (!repositoryStateActive(state) || !state) return "";
  if (state.operation === "none") return `Conflicts detected: ${conflictedFilesLabel(state.conflictedFiles.length)}.`;
  if (state.hasConflicts) return `${state.operationLabel} in progress: ${conflictedFilesLabel(state.conflictedFiles.length)}.`;
  return `${state.operationLabel} in progress.`;
}

export function repositoryStateBannerView(state: GitRepositoryState | null | undefined) {
  if (!repositoryStateActive(state) || !state) return null;
  const conflictedCount = state.conflictedFiles.length;

  return {
    ...politeStatusView({
      className: "repository-state-banner",
    }),
    title: state.operation === "none" ? "Conflicts detected" : `${state.operationLabel} in progress`,
    detail: state.hasConflicts ? conflictedFilesLabel(conflictedCount) : "No conflicted files",
  };
}
