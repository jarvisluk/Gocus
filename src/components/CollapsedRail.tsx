import { FolderOpen, GitBranch, PanelRightClose } from "lucide-react";
import type { GitSnapshot } from "../types";

export function CollapsedRail({
  snapshot,
  onExpand,
  onDock,
}: {
  snapshot: GitSnapshot | null;
  onExpand: () => void;
  onDock: () => void;
}) {
  const dirtyCount = snapshot ? snapshot.counts.modified + snapshot.counts.staged + snapshot.counts.untracked : 0;

  return (
    <aside className="collapsed-rail" aria-label="Collapsed Git Peek" title="Drag to move. Double-click to dock to the screen edge." onDoubleClick={onDock}>
      <button className="ui-icon-button rail-expand" type="button" aria-label="Expand Git Peek" onClick={onExpand}>
        <PanelRightClose aria-hidden="true" />
      </button>
      <div className="rail-branch">
        {snapshot ? <GitBranch aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
        <span>{snapshot?.branch.name ?? "Open"}</span>
      </div>
      {snapshot ? (
        <div className="rail-count" aria-label={`${dirtyCount} working tree changes`}>
          {dirtyCount}
        </div>
      ) : null}
    </aside>
  );
}
