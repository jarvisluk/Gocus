import { ChevronDown, ChevronUp } from "lucide-react";
import { joinClass } from "../lib/classNames";
import { fileKind, formatPath, statusLetter } from "../lib/fileStatus";
import type { ChangedFile, FileFilter } from "../types";

export function ChangedNow({
  files,
  filter,
  collapsed,
  onToggleCollapsed,
}: {
  files: ChangedFile[];
  filter: FileFilter;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const filteredFiles = filter === "all" ? files : files.filter((file) => fileKind(file) === filter);

  return (
    <section className={joinClass("changed-section", collapsed && "is-collapsed")} aria-label="Changed now">
      <div className="section-heading compact">
        <h2>Changed now</h2>
        <div className="heading-tools">
          <button
            type="button"
            aria-label={collapsed ? "Show changed files" : "Hide changed files"}
            aria-expanded={!collapsed}
            aria-controls="changed-now-file-list"
            onClick={onToggleCollapsed}
            title={collapsed ? "Show changed files" : "Hide changed files"}
          >
            {collapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          </button>
        </div>
      </div>
      {!collapsed ? (
        <div className="file-list" id="changed-now-file-list">
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
      ) : null}
    </section>
  );
}
