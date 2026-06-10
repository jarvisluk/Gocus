import type { ChangedFile } from "../types";
import { changedFileKey } from "./changedFileIdentity";
import { joinClass } from "./classNames";
import { fileKind, formatPath, statusLetter } from "./fileStatus";
import type { WorkspaceOpenOption } from "./workspaceOpenOptions";

export interface ChangedFileDeltaView {
  additionsLabel: string;
  deletionsLabel: string;
  emptyLabel: string;
}

export interface ChangedFileDeltaItem {
  key: "additions" | "deletions" | "empty";
  label: string;
  className?: "additions" | "deletions";
}

export interface ChangedFileView {
  key: string;
  kind: string;
  statusLetter: string;
  gitStatus: string;
  pathLabel: string;
  originalPathLabel: string;
  statusDetail: string;
  delta: ChangedFileDeltaView;
}

export interface ChangedFileRowView {
  file: ChangedFileView;
  selected: boolean;
  className: string;
  ariaPressed: boolean;
  title: string;
  badgeClassName: string;
  copyClassName: string;
  pathClassName: string;
  detailClassName: string;
  deltaClassName: string;
}

export interface ChangedFileInfoPanelView {
  panel: {
    className: string;
    ariaLabelledBy: string;
  };
  titleId: string;
  header: {
    className: string;
  };
  file: ChangedFileView;
  badgeClassName: string;
  statusLabel: string;
  closeButton: {
    className: string;
    ariaLabel: string;
  };
  facts: {
    kindLabel: string;
    gitLabel: string;
    changesLabel: string;
    pathLabel: string;
    originalPathLabel: string;
  };
  factsListClassName: string;
  deltaClassName: string;
  wideFactClassName: string;
  pathText: string;
  pathTitle: string;
  showOriginalPath: boolean;
  originalPathTitle: string | undefined;
}

export interface ChangedFileInfoOpenButtonView {
  className: string;
  iconClassName: string;
  ariaLabel: string;
  title: string;
}

export const changedFileInfoTitleId = "changed-file-details-title";

export function changedFileDeltaView(file: ChangedFile): ChangedFileDeltaView {
  const additionsLabel = file.additions ? `+${file.additions}` : "";
  const deletionsLabel = file.deletions ? `-${file.deletions}` : "";

  return {
    additionsLabel,
    deletionsLabel,
    emptyLabel: additionsLabel || deletionsLabel ? "" : "0",
  };
}

export function changedFileDeltaItems(delta: ChangedFileDeltaView): ChangedFileDeltaItem[] {
  if (delta.emptyLabel) return [{ key: "empty", label: delta.emptyLabel }];

  const items: ChangedFileDeltaItem[] = [];
  if (delta.additionsLabel) items.push({ key: "additions", label: delta.additionsLabel, className: "additions" });
  if (delta.deletionsLabel) items.push({ key: "deletions", label: delta.deletionsLabel, className: "deletions" });
  return items;
}

export function changedFileView(file: ChangedFile): ChangedFileView {
  const originalPathLabel = file.originalPath ? formatPath(file.originalPath) : "";

  return {
    key: changedFileKey(file),
    kind: fileKind(file),
    statusLetter: statusLetter(file),
    gitStatus: file.status.trim() || "?",
    pathLabel: formatPath(file.path),
    originalPathLabel,
    statusDetail: `${file.statusLabel}${originalPathLabel ? ` from ${originalPathLabel}` : ""}`,
    delta: changedFileDeltaView(file),
  };
}

export function changedFileRowView(file: ChangedFile, selectedFileKey: string): ChangedFileRowView {
  const view = changedFileView(file);
  const selected = selectedFileKey === view.key;

  return {
    file: view,
    selected,
    className: joinClass("file-row", selected && "is-selected"),
    ariaPressed: selected,
    title: file.path,
    badgeClassName: joinClass("file-badge", view.kind),
    copyClassName: "file-copy",
    pathClassName: "file-path",
    detailClassName: "file-detail",
    deltaClassName: "file-delta",
  };
}

export function changedFileInfoPanelView(file: ChangedFile): ChangedFileInfoPanelView {
  const view = changedFileView(file);

  return {
    panel: {
      className: "changed-side-panel",
      ariaLabelledBy: changedFileInfoTitleId,
    },
    titleId: changedFileInfoTitleId,
    header: {
      className: "changed-side-header",
    },
    file: view,
    badgeClassName: joinClass("file-badge", view.kind),
    statusLabel: file.statusLabel,
    closeButton: {
      className: "ui-icon-button",
      ariaLabel: "Close changed file details",
    },
    facts: {
      kindLabel: "Kind",
      gitLabel: "Git",
      changesLabel: "Changes",
      pathLabel: "Path",
      originalPathLabel: "From",
    },
    factsListClassName: "changed-side-facts",
    deltaClassName: "changed-side-delta",
    wideFactClassName: "is-wide",
    pathText: file.path,
    pathTitle: file.path,
    showOriginalPath: Boolean(file.originalPath),
    originalPathTitle: file.originalPath,
  };
}

export function changedFileInfoOpenButtonView(option: WorkspaceOpenOption | null): ChangedFileInfoOpenButtonView | null {
  if (!option) return null;

  const label = `Open file in ${option.label}`;

  return {
    className: "ui-icon-button changed-side-open-button",
    iconClassName: "external-app-icon",
    ariaLabel: label,
    title: label,
  };
}
