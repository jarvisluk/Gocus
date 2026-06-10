import type { ChangedFile, FileFilter } from "../types";
import { fileKind } from "./fileStatus";
import { politeStatusView } from "./statusView";

export function filteredChangedFiles(files: readonly ChangedFile[], filter: FileFilter) {
  if (filter === "all") return [...files];
  return files.filter((file) => fileKind(file) === filter);
}

export function visibleChangedFiles(files: readonly ChangedFile[]) {
  return [...files];
}

export function changedFilesHiddenCountLabel(_hiddenCount: number) {
  return "";
}

export function changedFilesView(files: readonly ChangedFile[], filter: FileFilter) {
  const filteredFiles = filteredChangedFiles(files, filter);

  return {
    filteredFiles,
    filteredCount: filteredFiles.length,
    visibleFiles: visibleChangedFiles(filteredFiles),
    hiddenCount: 0,
    hiddenCountLabel: "",
    showFiles: filteredFiles.length > 0,
    showHiddenCount: false,
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
