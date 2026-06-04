import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, GitBranch, Pin, PinOff, RefreshCw, Route } from "lucide-react";
import { IconButton } from "./IconButton";
import { joinClass } from "../lib/classNames";
import { recentRepositoryLabel } from "../lib/pathLabels";
import type { GitSnapshot, RecentRepository } from "../types";

function repositoryDedupeKey(repository: RecentRepository) {
  return repository.repositoryKey || repository.path;
}

function dedupeRecentRepositories(repositories: RecentRepository[]) {
  const seen = new Set<string>();
  return repositories.filter((repository) => {
    const key = repositoryDedupeKey(repository);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function PanelHeader({
  snapshot,
  recentRepositories,
  pinned,
  refreshing,
  onOpen,
  onSwitchRepository,
  onRefresh,
  onTogglePinned,
  onCollapse,
}: {
  snapshot: GitSnapshot | null;
  recentRepositories: RecentRepository[];
  pinned: boolean;
  refreshing: boolean;
  onOpen: () => void;
  onSwitchRepository: (repositoryPath: string) => void;
  onRefresh: () => void;
  onTogglePinned: () => void;
  onCollapse: () => void;
}) {
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const repoSwitcherRef = useRef<HTMLDivElement>(null);
  const recentRepositoryOptions = dedupeRecentRepositories(
    snapshot ? [{ path: snapshot.repoPath, name: snapshot.repoName, repositoryKey: snapshot.repositoryKey }, ...recentRepositories] : recentRepositories,
  );
  const canSwitchRepository = Boolean(snapshot && recentRepositoryOptions.length > 1);

  useEffect(() => {
    if (!repoMenuOpen) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (repoSwitcherRef.current?.contains(event.target as Node)) return;
      setRepoMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setRepoMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [repoMenuOpen]);

  function switchRepository(repositoryPath: string) {
    setRepoMenuOpen(false);
    if (!snapshot || repositoryPath === snapshot.repoPath) return;
    onSwitchRepository(repositoryPath);
  }

  return (
    <header className="peek-header">
      <IconButton label="Open repository" onClick={onOpen}>
        <Route aria-hidden="true" />
      </IconButton>
      <div className="header-repo-switcher" ref={repoSwitcherRef}>
        {canSwitchRepository ? (
          <button
            className={joinClass("repo-title", "repo-title-button", repoMenuOpen && "is-open")}
            type="button"
            aria-label="Switch recent repository"
            aria-haspopup="menu"
            aria-expanded={repoMenuOpen}
            aria-controls="repo-switch-menu"
            title={snapshot?.repoPath}
            onClick={() => setRepoMenuOpen((current) => !current)}
          >
            <span className="repo-title-copy">
              <strong>{snapshot?.repoName ?? "Git Peek"}</strong>
              <span>{snapshot?.repoPath ?? "No working folder"}</span>
            </span>
            <ChevronDown aria-hidden="true" />
          </button>
        ) : (
          <div className="repo-title">
            <strong>{snapshot?.repoName ?? "Git Peek"}</strong>
            <span>{snapshot?.repoPath ?? "No working folder"}</span>
          </div>
        )}
        {repoMenuOpen && snapshot ? (
          <div className="ui-menu repo-switch-menu" id="repo-switch-menu" role="menu">
            {recentRepositoryOptions.map((repository) => {
              const active = repositoryDedupeKey(repository) === snapshot.repositoryKey;

              return (
                <button
                  className={joinClass("ui-menu-item", "repo-menu-item", active && "is-active")}
                  type="button"
                  role="menuitem"
                  aria-current={active ? "true" : undefined}
                  title={repository.path}
                  key={repository.path}
                  onClick={() => switchRepository(repository.path)}
                >
                  <span className="repo-menu-check">{active ? <Check aria-hidden="true" /> : null}</span>
                  <span className="repo-menu-text">
                    <strong>{recentRepositoryLabel(repository)}</strong>
                    <code>{repository.path}</code>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {snapshot ? (
        <span className="branch-pill" title={snapshot.branch.upstream || snapshot.branch.name}>
          <GitBranch aria-hidden="true" />
          {snapshot.branch.name}
        </span>
      ) : null}
      <div className="header-actions">
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
