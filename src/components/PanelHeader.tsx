import { ChevronLeft, GitBranch, Pin, PinOff, RefreshCw, Route, Settings } from "lucide-react";
import { IconButton } from "./IconButton";
import type { GitSnapshot } from "../types";

export function PanelHeader({
  snapshot,
  pinned,
  refreshing,
  settingsOpen,
  onOpen,
  onRefresh,
  onTogglePinned,
  onToggleSettings,
  onCollapse,
}: {
  snapshot: GitSnapshot | null;
  pinned: boolean;
  refreshing: boolean;
  settingsOpen: boolean;
  onOpen: () => void;
  onRefresh: () => void;
  onTogglePinned: () => void;
  onToggleSettings: () => void;
  onCollapse: () => void;
}) {
  return (
    <header className="peek-header">
      <button className="repo-mark" type="button" aria-label="Open repository" title="Open repository" onClick={onOpen}>
        <Route aria-hidden="true" />
      </button>
      <div className="repo-title">
        <strong>{snapshot?.repoName ?? "Git Peek"}</strong>
        <span>{snapshot?.repoPath ?? "No working folder"}</span>
      </div>
      {snapshot ? (
        <span className="branch-pill" title={snapshot.branch.upstream || snapshot.branch.name}>
          <GitBranch aria-hidden="true" />
          {snapshot.branch.name}
        </span>
      ) : null}
      <div className="header-actions">
        <IconButton label="Settings" active={settingsOpen} onClick={onToggleSettings}>
          <Settings aria-hidden="true" />
        </IconButton>
        <IconButton label={pinned ? "Unpin floating panel" : "Pin floating panel"} active={pinned} onClick={onTogglePinned}>
          {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
        </IconButton>
        <IconButton label="Refresh Git status" onClick={onRefresh} disabled={!snapshot}>
          <RefreshCw className={refreshing ? "is-spinning" : ""} aria-hidden="true" />
        </IconButton>
        <IconButton label="Collapse side peek" onClick={onCollapse}>
          <ChevronLeft aria-hidden="true" />
        </IconButton>
      </div>
    </header>
  );
}
