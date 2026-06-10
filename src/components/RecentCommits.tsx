import { FileCode2, GitBranch, GitFork, GitMerge, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GitTreeCell } from "../git-tree/GitTreeCell";
import { getGitTreeRailWidth, getGitTreeRequiredLaneCount } from "../git-tree/renderGraph";
import {
  commitListView,
  commitSearchInputKeyAction,
  commitSearchStateApplication,
  commitSearchStateAfterAvailability,
  commitSearchStateAfterClose,
  commitSearchStateAfterToggle,
  commitSelectionVisible,
  firstCommitId,
  type CommitSearchStateTransition,
} from "../lib/commitListView";
import { commitRowView, type CommitRowAction, type CommitRowActionIcon } from "../lib/commitRowView";
import type { CommitItem } from "../types";

function commitActionIcon(icon: CommitRowActionIcon) {
  if (icon === "branch") return <GitFork aria-hidden="true" />;
  return <GitBranch aria-hidden="true" />;
}

function CommitRow({
  commit,
  selected,
  expandSelectedMessage,
  onSelect,
  onAction,
}: {
  commit: CommitItem;
  selected: boolean;
  expandSelectedMessage?: boolean;
  onSelect: () => void;
  onAction: (action: CommitRowAction, commit: CommitItem) => void;
}) {
  const graphLaneCount = getGitTreeRequiredLaneCount(commit.graph);
  const rowStyle: CSSProperties & { "--git-tree-rail-width": string } = {
    "--git-tree-rail-width": `${getGitTreeRailWidth(graphLaneCount)}px`,
  };
  const view = commitRowView(commit, selected, expandSelectedMessage);
  const refStyle = {
    "--branch-color": view.refColor,
  } as CSSProperties;

  return (
    <article className={view.className} style={rowStyle} title={view.message}>
      <GitTreeCell graph={commit.graph} laneCount={graphLaneCount} />
      <div className={view.contentClassName}>
        <button className={view.selectButton.className} type="button" aria-pressed={view.selectButton.ariaPressed} onClick={onSelect}>
          <span className={view.titleLineClassName}>
            <span className={view.titleTextClassName}>{view.displayMessage}</span>
            {view.showRef ? (
              <span className={view.refPillClassName} style={refStyle}>
                {view.ref}
              </span>
            ) : null}
          </span>
          <span className={view.metaClassName}>
            <code>{commit.hash}</code>
            <span>{commit.relativeTime}</span>
            {view.showAuthor ? <span>{commit.author}</span> : null}
            {view.isMerge ? (
              <span className={view.mergeIndicator.className} title={view.mergeIndicator.title}>
                <GitMerge aria-hidden="true" />
                merge
              </span>
            ) : null}
          </span>
          <span className={view.stats.className}>
            <span className={view.stats.additionsClassName}>+{commit.additions}</span>
            <span className={view.stats.deletionsClassName}>-{commit.deletions}</span>
            <span className={view.stats.filesClassName}>
              <FileCode2 aria-hidden="true" />
              {commit.filesChanged}
            </span>
          </span>
        </button>
        <div className={view.messagePopover.className} role={view.messagePopover.role}>
          {view.messagePopover.message}
        </div>
        {view.showActions ? (
          <div className={view.actionsClassName}>
            <button
              type="button"
              onClick={() => onAction(view.branchAction.action, commit)}
              disabled={view.branchAction.disabled}
              title={view.branchAction.title}
            >
              {commitActionIcon(view.branchAction.icon)}
              {view.branchAction.label}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!view.checkoutAction.disabled) onAction(view.checkoutAction.action, commit);
              }}
              disabled={view.checkoutAction.disabled}
              title={view.checkoutAction.title}
            >
              {commitActionIcon(view.checkoutAction.icon)}
              {view.checkoutAction.label}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function RecentCommits({
  commits,
  selectedId,
  expandSelectedMessage = false,
  onSelect,
  onAction,
}: {
  commits: CommitItem[];
  selectedId: string;
  expandSelectedMessage?: boolean;
  onSelect: (id: string) => void;
  onAction: (action: CommitRowAction, commit: CommitItem) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const {
    canSearch,
    count,
    emptyState,
    filteredCommits,
    heading,
    headingToolsClassName,
    list,
    searchClearButton,
    searchForm,
    searchInput,
    searchToggle,
    section,
    showCommits,
    showEmptyState,
    showSearchForm,
    title,
    titleId,
  } = useMemo(() => commitListView(commits, searchQuery, searchOpen), [commits, searchOpen, searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchOpen]);

  useEffect(() => {
    applySearchState(commitSearchStateAfterAvailability({ searchOpen, searchQuery }, canSearch));
  }, [canSearch, searchOpen, searchQuery]);

  useEffect(() => {
    if (selectedId && !commitSelectionVisible(filteredCommits, selectedId)) onSelect("");
  }, [filteredCommits, onSelect, selectedId]);

  function applySearchState(nextState: CommitSearchStateTransition) {
    const application = commitSearchStateApplication(nextState);
    if (application.updateState) {
      setSearchQuery(application.searchQuery);
      setSearchOpen(application.searchOpen);
    }
    if (application.restoreToggleFocus) searchToggleRef.current?.focus();
  }

  function closeSearch({ restoreFocus = false }: { restoreFocus?: boolean } = {}) {
    applySearchState(commitSearchStateAfterClose({ searchOpen, searchQuery }, { restoreFocus }));
  }

  function toggleSearch() {
    applySearchState(commitSearchStateAfterToggle({ searchOpen, searchQuery }, searchToggle));
  }

  return (
    <section className={section.className} aria-labelledby={section.ariaLabelledBy}>
      <div className={heading.className}>
        <h2 id={titleId}>{title}</h2>
        <div className={headingToolsClassName}>
          <span className={count.className} role={count.role} aria-live={count.ariaLive}>
            {count.label}
          </span>
          {showSearchForm ? (
            <form
              className={searchForm.className}
              id={searchForm.id}
              role={searchForm.role}
              onSubmit={(event) => {
                event.preventDefault();
                const commitId = firstCommitId(filteredCommits);
                if (commitId) onSelect(commitId);
              }}
            >
              <Search aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                type="search"
                aria-label={searchInput.ariaLabel}
                placeholder={searchInput.placeholder}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  const keyAction = commitSearchInputKeyAction(event.key);
                  if (keyAction === "ignore") return;

                  event.preventDefault();
                  if (keyAction === "selectFirst") {
                    const commitId = firstCommitId(filteredCommits);
                    if (commitId) onSelect(commitId);
                    return;
                  }

                  if (keyAction === "close") {
                    event.stopPropagation();
                    closeSearch({ restoreFocus: true });
                  }
                }}
              />
              {searchClearButton.show ? (
                <button
                  className={searchClearButton.className}
                  type="button"
                  aria-label={searchClearButton.ariaLabel}
                  onClick={() => setSearchQuery("")}
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
            </form>
          ) : null}
          <button
            ref={searchToggleRef}
            className={searchToggle.className}
            type="button"
            aria-controls={searchToggle.ariaControls}
            aria-expanded={searchToggle.ariaExpanded}
            aria-label={searchToggle.ariaLabel}
            aria-pressed={searchToggle.ariaPressed}
            disabled={searchToggle.disabled}
            title={searchToggle.title}
            data-tooltip={searchToggle.tooltip}
            onClick={toggleSearch}
          >
            <Search aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={list.className}>
        {showCommits ? (
          filteredCommits.map((commit) => (
            <CommitRow
              key={commit.id}
              commit={commit}
              selected={commit.id === selectedId}
              expandSelectedMessage={expandSelectedMessage}
              onSelect={() => onSelect(commit.id)}
              onAction={onAction}
            />
          ))
        ) : null}
        {showEmptyState ? (
          <div className={emptyState.className} role={emptyState.role} aria-live={emptyState.ariaLive}>
            {emptyState.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
