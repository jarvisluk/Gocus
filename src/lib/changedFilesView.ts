import type { ChangedFile, FileFilter } from "../types";
import { fileKind } from "./fileStatus";
import { politeStatusView } from "./statusView";

export const maxChangedFilesPreview = 8;

export function filteredChangedFiles(files: readonly ChangedFile[], filter: FileFilter) {
  if (filter === "all") return [...files];
  return files.filter((file) => fileKind(file) === filter);
}

export function visibleChangedFiles(files: readonly ChangedFile[], limit = maxChangedFilesPreview) {
  return files.slice(0, limit);
}

export function changedFilesHiddenCountLabel(hiddenCount: number) {
  if (hiddenCount <= 0) return "";
  return hiddenCount === 1 ? "+1 more file" : `+${hiddenCount} more files`;
}

export function changedFilesView(files: readonly ChangedFile[], filter: FileFilter) {
  const filteredFiles = filteredChangedFiles(files, filter);
  const hiddenCount = Math.max(0, filteredFiles.length - maxChangedFilesPreview);

  return {
    filteredFiles,
    filteredCount: filteredFiles.length,
    visibleFiles: visibleChangedFiles(filteredFiles),
    hiddenCount,
    hiddenCountLabel: changedFilesHiddenCountLabel(hiddenCount),
    showFiles: filteredFiles.length > 0,
    showHiddenCount: hiddenCount > 0,
    hiddenCountView: politeStatusView({
      className: "file-list-more",
    }),
    emptyMessage: "No files in this view.",
    emptyState: politeStatusView({
      className: "empty-state",
      message: "No files in this view.",
    }),
  };
}
