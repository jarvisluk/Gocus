import { X } from "lucide-react";
import { joinClass } from "../lib/classNames";
import { fileKind, formatPath, statusLetter } from "../lib/fileStatus";
import type { ChangedFile, FileFilter } from "../types";

export function changedFileKey(file: ChangedFile) {
  return `${file.status}-${file.path}-${file.originalPath ?? ""}`;
}

function deltaContent(file: ChangedFile) {
  if (!file.additions && !file.deletions) return <span>0</span>;

  return (
    <>
      {file.additions ? <span className="additions">+{file.additions}</span> : null}
      {file.deletions ? <span className="deletions">-{file.deletions}</span> : null}
    </>
  );
}

export function ChangedFileInfoPanel({ file, onClose }: { file: ChangedFile; onClose: () => void }) {
  return (
    <aside className="changed-side-panel" aria-label="Changed file details">
      <header className="changed-side-header">
        <span className={joinClass("file-badge", fileKind(file))}>{statusLetter(file)}</span>
        <div>
          <h2 title={file.path}>{formatPath(file.path)}</h2>
          <span>{file.statusLabel}</span>
        </div>
        <button className="ui-icon-button" type="button" aria-label="Close changed file details" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <dl className="changed-side-facts">
        <div>
          <dt>Kind</dt>
          <dd>{fileKind(file)}</dd>
        </div>
        <div>
          <dt>Git</dt>
          <dd>{file.status.trim() || "?"}</dd>
        </div>
        <div>
          <dt>Changes</dt>
          <dd className="changed-side-delta">{deltaContent(file)}</dd>
        </div>
        <div className="is-wide">
          <dt>Path</dt>
          <dd title={file.path}>{file.path}</dd>
        </div>
        {file.originalPath ? (
          <div className="is-wide">
            <dt>From</dt>
            <dd title={file.originalPath}>{file.originalPath}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

export function ChangedNow({
  files,
  filter,
  selectedFileKey,
  externalized = false,
  onActivateExternal,
  onClose,
  onSelectFile,
}: {
  files: ChangedFile[];
  filter: FileFilter;
  selectedFileKey: string;
  externalized?: boolean;
  onActivateExternal?: () => void;
  onClose?: () => void;
  onSelectFile: (fileKey: string) => void;
}) {
  const filteredFiles = filter === "all" ? files : files.filter((file) => fileKind(file) === filter);

  return (
    <section className={joinClass("changed-section", externalized && "is-externalized")} aria-label="Changed now">
      <div className="section-heading compact">
        {externalized && onActivateExternal ? (
          <button className="changed-heading-trigger" type="button" onClick={onActivateExternal}>
            <h2>Changed now</h2>
          </button>
        ) : (
          <h2>Changed now</h2>
        )}
        <div className="heading-tools">
          <span>{filteredFiles.length}</span>
          {onClose ? (
            <button type="button" aria-label="Close changed files window" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {!externalized ? (
        <div className="file-list" id="changed-now-file-list">
          {filteredFiles.length ? (
            filteredFiles.slice(0, 8).map((file) => {
              const fileKey = changedFileKey(file);

              return (
                <button
                  className={joinClass("file-row", selectedFileKey === fileKey && "is-selected")}
                  type="button"
                  key={fileKey}
                  onClick={() => onSelectFile(fileKey)}
                  aria-pressed={selectedFileKey === fileKey}
                  title={file.path}
                >
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
                </button>
              );
            })
          ) : (
            <div className="empty-state">No files in this view.</div>
          )}
        </div>
      ) : null}
    </section>
  );
}
