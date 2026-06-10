import type { ChangedFile, FileFilter, TemporaryInfoPayload } from "../types";
import { changedFileKey } from "./changedFileIdentity";
import { filteredChangedFiles } from "./changedFilesView";
import { joinClass } from "./classNames";
import { politeStatusView } from "./statusView";

type ChangedFilesTemporaryInfoPayload = NonNullable<TemporaryInfoPayload>;

export function selectedChangedFile(files: readonly ChangedFile[], selectedFileKey: string, filter: FileFilter = "all") {
  if (!selectedFileKey) return null;
  return filteredChangedFiles(files, filter).find((file) => changedFileKey(file) === selectedFileKey) ?? null;
}

export function changedFilesSelectedFileKey(payload: TemporaryInfoPayload, currentSelectedFileKey: string) {
  if (payload?.kind !== "changed-files") return "";
  if (selectedChangedFile(payload.files, payload.selectedFileKey, payload.filter)) return payload.selectedFileKey;
  if (selectedChangedFile(payload.files, currentSelectedFileKey, payload.filter)) return currentSelectedFileKey;
  return "";
}

export function temporaryInfoWindowView(payload: TemporaryInfoPayload, selectedFileKey: string) {
  const selectedFile =
    payload?.kind === "changed-files" ? selectedChangedFile(payload.files, selectedFileKey, payload.filter) : null;
  const chrome = {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: joinClass("peek-panel", "temporary-info-panel", selectedFile && "has-detail"),
      ariaLabel: "Changed files window",
    },
    emptyState: politeStatusView({
      className: "temporary-info-empty",
      ariaLabel: "Temporary information",
      message: "No file selected.",
    }),
  };

  if (payload?.kind !== "changed-files") {
    return {
      ...chrome,
      changedFilesPayload: null,
      selectedFile: null,
      showChangedFiles: false,
      showSelectedFile: false,
    };
  }

  return {
    ...chrome,
    changedFilesPayload: payload as ChangedFilesTemporaryInfoPayload,
    selectedFile,
    showChangedFiles: true,
    showSelectedFile: Boolean(selectedFile),
  };
}
