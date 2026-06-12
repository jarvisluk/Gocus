import { FileCode2, GitBranch, GitFork, GitMerge, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CommitGraphLayer } from "./CommitGraphLayer";
import {
  getGitTreeLaneCountForCommits,
  getGitTreeRailWidth,
  getGitTreeRequiredLaneCount,
} from "../git-tree/renderGraph";
import {
  commitListView,
  commitScrollTopForSelection,
  commitSearchInputKeyAction,
  commitSearchStateApplication,
  commitSearchStateAfterAvailability,
  commitSearchStateAfterClose,
  commitSearchStateAfterToggle,
  commitSelectionVisible,
  commitVirtualWindow,
  firstCommitId,
  type CommitSearchStateTransition,
} from "../lib/commitListView";
import { runCommitInfoPanelBridgeSideEffect } from "../lib/commitInfoPanelBridge";
import { commitRowView, type CommitRowAction, type CommitRowActionIcon } from "../lib/commitRowView";
import type { CommitInfoAnchorBounds, CommitItem, UiPreferences } from "../types";

function commitActionIcon(icon: CommitRowActionIcon) {
  if (icon === "branch") return <GitFork aria-hidden="true" />;
  if (icon === "merge") return <GitMerge aria-hidden="true" />;
  return <GitBranch aria-hidden="true" />;
}

function commitScrollContainer(listNode: HTMLElement) {
  return listNode.closest<HTMLElement>(".scroll-region") ?? listNode;
}

function commitListSpacerStyle(height: number) {
  return { height: `${height}px` } satisfies CSSProperties;
}

function CommitRow({
  commit,
  selected,
  expandSelectedMessage,
  onSelect,
  onAction,
  onPreview,
  onDismissPreview,
}: {
  commit: CommitItem;
  selected: boolean;
  expandSelectedMessage?: boolean;
  onSelect: () => void;
  onAction: (action: CommitRowAction, commit: CommitItem) => void;
  onPreview: (commit: CommitItem, anchorBounds: CommitInfoAnchorBounds) => void;
  onDismissPreview: () => void;
}) {
  const rowRef = useRef<HTMLElement>(null);
  const previewFrameRef = useRef<number | null>(null);
  const view = commitRowView(commit, selected, expandSelectedMessage);
  const rowStyle = {
    "--git-tree-rail-width": `${getGitTreeRailWidth(getGitTreeRequiredLaneCount(commit.graph))}px`,
  } as CSSProperties & { "--git-tree-rail-width": string };
  const refStyle = {
    "--branch-color": view.refColor,
  } as CSSProperties;

  function anchorBounds(): CommitInfoAnchorBounds {
    const rect = rowRef.current?.getBoundingClientRect();
    return {
      top: rect?.top ?? 0,
      height: rect?.height ?? 0,
    };
  }

  function cancelScheduledPreview() {
    if (previewFrameRef.current === null) return;
    window.cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = null;
  }

  function schedulePreviewAfterSelection() {
    cancelScheduledPreview();
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onPreview(commit, anchorBounds());
    });
  }

  function previewIfSelected() {
    if (!selected) {
      cancelScheduledPreview();
      onDismissPreview();
      return;
    }

    cancelScheduledPreview();
    onPreview(commit, anchorBounds());
  }

  function selectCommit() {
    onSelect();
    if (selected) {
      cancelScheduledPreview();
      onDismissPreview();
      return;
    }

    schedulePreviewAfterSelection();
  }

  useEffect(() => () => cancelScheduledPreview(), []);

  return (
    <article
      ref={rowRef}
      className={view.className}
      data-commit-id={commit.id}
      style={rowStyle}
      onFocus={previewIfSelected}
      onPointerEnter={previewIfSelected}
    >
      <span className="timeline-cell" aria-hidden="true" />
      <div className={view.contentClassName}>
        <button className={view.selectButton.className} type="button" aria-pressed={view.selectButton.ariaPressed} onClick={selectCommit}>
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
                if (!view.mergeAction.disabled) onAction(view.mergeAction.action, commit);
              }}
              disabled={view.mergeAction.disabled}
              title={view.mergeAction.title}
            >
              {commitActionIcon(view.mergeAction.icon)}
              {view.mergeAction.label}
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
  graphStyle = "solid",
  graphNodeY = 22,
}: {
  commits: CommitItem[];
  selectedId: string;
  expandSelectedMessage?: boolean;
  onSelect: (id: string) => void;
  onAction: (action: CommitRowAction, commit: CommitItem) => void;
  graphStyle?: UiPreferences["graphStyle"];
  graphNodeY?: number;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const commitPreviewOpenRef = useRef(false);
  const commitPreviewCommitIdRef = useRef("");
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const previousSearchTermCountRef = useRef(0);
  const [scrollFrame, setScrollFrame] = useState({ scrollTop: 0, viewportHeight: 0 });
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
    searchTerms,
    searchToggle,
    section,
    showCommits,
    showEmptyState,
    showSearchForm,
    title,
    titleId,
  } = useMemo(() => commitListView(commits, searchQuery, searchOpen), [commits, searchOpen, searchQuery]);
  const selectedFilteredIndex = useMemo(
    () => filteredCommits.findIndex((commit) => commit.id === selectedId),
    [filteredCommits, selectedId],
  );
  const virtualWindow = useMemo(
    () =>
      commitVirtualWindow({
        itemCount: filteredCommits.length,
        selectedIndex: selectedFilteredIndex,
        scrollTop: scrollFrame.scrollTop,
        viewportHeight: scrollFrame.viewportHeight,
      }),
    [filteredCommits.length, scrollFrame.scrollTop, scrollFrame.viewportHeight, selectedFilteredIndex],
  );
  const visibleCommits = useMemo(
    () => filteredCommits.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [filteredCommits, virtualWindow.endIndex, virtualWindow.startIndex],
  );
  const visibleGraphLaneCount = useMemo(() => getGitTreeLaneCountForCommits(visibleCommits), [visibleCommits]);
  const listStyle = useMemo(
    () =>
      ({
        "--git-tree-rail-width": `${getGitTreeRailWidth(visibleGraphLaneCount)}px`,
      }) as CSSProperties & { "--git-tree-rail-width": string },
    [visibleGraphLaneCount],
  );

  useEffect(() => {
    const previousSearchTermCount = previousSearchTermCountRef.current;
    previousSearchTermCountRef.current = searchTerms.length;
    if (previousSearchTermCount === 0 || searchTerms.length > 0 || !selectedId) return;

    const listNode = listRef.current;
    if (!listNode) return;

    const scrollNode = commitScrollContainer(listNode);
    const selectedIndex = filteredCommits.findIndex((commit) => commit.id === selectedId);
    const nextScrollTop = commitScrollTopForSelection({
      itemCount: filteredCommits.length,
      selectedIndex,
      scrollTop: scrollNode.scrollTop,
      viewportHeight: scrollNode.clientHeight,
    });

    if (nextScrollTop === null) return;
    scrollNode.scrollTo({ top: nextScrollTop, behavior: "auto" });
    setScrollFrame({ scrollTop: nextScrollTop, viewportHeight: scrollNode.clientHeight });
  }, [filteredCommits, searchTerms.length, selectedId]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchOpen]);

  useEffect(() => {
    const listNode = listRef.current;
    if (!listNode) return undefined;

    const scrollNode = commitScrollContainer(listNode);
    let frame = 0;
    const readScrollFrame = () => {
      frame = 0;
      const nextFrame = {
        scrollTop: scrollNode.scrollTop,
        viewportHeight: scrollNode.clientHeight,
      };
      setScrollFrame((current) =>
        current.scrollTop === nextFrame.scrollTop && current.viewportHeight === nextFrame.viewportHeight
          ? current
          : nextFrame,
      );
    };
    const scheduleRead = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(readScrollFrame);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleRead);

    readScrollFrame();
    scrollNode.addEventListener("scroll", scheduleRead, { passive: true });
    resizeObserver?.observe(scrollNode);
    resizeObserver?.observe(listNode);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scrollNode.removeEventListener("scroll", scheduleRead);
      resizeObserver?.disconnect();
    };
  }, [filteredCommits.length]);

  useEffect(() => {
    applySearchState(commitSearchStateAfterAvailability({ searchOpen, searchQuery }, canSearch));
  }, [canSearch, searchOpen, searchQuery]);

  useEffect(() => {
    if (selectedId && !commitSelectionVisible(filteredCommits, selectedId)) onSelect("");
  }, [filteredCommits, onSelect, selectedId]);

  useEffect(() => {
    if (!selectedId || (commitPreviewCommitIdRef.current && commitPreviewCommitIdRef.current !== selectedId)) closeCommitPreview();
  }, [selectedId]);

  useEffect(
    () => () => {
      closeCommitPreview();
    },
    [],
  );

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

  function previewCommit(commit: CommitItem, anchorBounds: CommitInfoAnchorBounds) {
    const opened = runCommitInfoPanelBridgeSideEffect(
      "open",
      (payload) => window.gitPeek?.setCommitInfoPanel(payload),
      { kind: "commit", commit, anchorBounds },
    );
    commitPreviewOpenRef.current = opened;
    commitPreviewCommitIdRef.current = opened ? commit.id : "";
  }

  function closeCommitPreview() {
    if (!commitPreviewOpenRef.current) return;
    commitPreviewOpenRef.current = false;
    commitPreviewCommitIdRef.current = "";
    runCommitInfoPanelBridgeSideEffect("close", (payload) => window.gitPeek?.setCommitInfoPanel(payload));
  }

  function handleCommitListPointerLeave(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX <= bounds.left) return;
    closeCommitPreview();
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
      <div
        ref={listRef}
        className={list.className}
        style={listStyle}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closeCommitPreview();
        }}
        onPointerLeave={handleCommitListPointerLeave}
      >
        {showCommits ? (
          <CommitGraphLayer
            commits={visibleCommits}
            startIndex={virtualWindow.startIndex}
            itemCount={filteredCommits.length}
            selectedIndex={selectedFilteredIndex}
            laneCount={visibleGraphLaneCount}
            graphStyle={graphStyle}
            nodeY={graphNodeY}
          />
        ) : null}
        {virtualWindow.topPadding > 0 ? (
          <div className="commit-list-spacer" style={commitListSpacerStyle(virtualWindow.topPadding)} aria-hidden="true" />
        ) : null}
        {showCommits ? (
          visibleCommits.map((commit) => (
            <CommitRow
              key={commit.id}
              commit={commit}
              selected={commit.id === selectedId}
              expandSelectedMessage={expandSelectedMessage}
              onSelect={() => onSelect(commit.id)}
              onAction={onAction}
              onPreview={previewCommit}
              onDismissPreview={closeCommitPreview}
            />
          ))
        ) : null}
        {virtualWindow.bottomPadding > 0 ? (
          <div className="commit-list-spacer" style={commitListSpacerStyle(virtualWindow.bottomPadding)} aria-hidden="true" />
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
