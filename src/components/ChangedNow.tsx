import { ChevronsRight, FolderOpen } from "lucide-react";
import { joinClass } from "../lib/classNames";
import { fileKind, formatPath, statusCopy, statusLetter } from "../lib/fileStatus";
import type { ChangedFile, FileFilter } from "../types";

export function ChangedNow({
  files,
  filter,
  onClearFilter,
}: {
  files: ChangedFile[];
  filter: FileFilter;
  onClearFilter: () => void;
}) {
  const filteredFiles = filter === "all" ? files : files.filter((file) => fileKind(file) === filter);

  return (
    <section className="changed-section" aria-label="Changed now">
      <div className="section-heading compact">
        <h2>Changed now</h2>
        <div className="heading-tools">
          <span>{statusCopy[filter]}</span>
          {filter !== "all" ? (
            <button type="button" aria-label="Clear file filter" onClick={onClearFilter}>
              <ChevronsRight aria-hidden="true" />
            </button>
          ) : (
            <FolderOpen aria-hidden="true" />
          )}
        </div>
      </div>
      <div className="file-list">
        {filteredFiles.length ? (
          filteredFiles.slice(0, 8).map((file) => (
            <div className="file-row" key={`${file.status}-${file.path}`}>
              <span className={joinClass("file-badge", fileKind(file))}>{statusLetter(file)}</span>
              <span className="file-copy">
                <span className="file-path" title={file.path}>
                  {formatPath(file.path)}
                </span>
                <span className="file-detail">
                  {file.statusLabel}
                  {file.originalPath ? ` from ${formatPath(file.originalPath)}` : ""}
                </span>
              </span>
              <span className="file-delta">
                {file.additions ? <span className="additions">+{file.additions}</span> : null}
                {file.deletions ? <span className="deletions">-{file.deletions}</span> : null}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">No files in this view.</div>
        )}
      </div>
    </section>
  );
}
