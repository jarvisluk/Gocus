import { Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from "react";
import { CommitRow } from "./CommitRow";
import { CommitGraphLayer } from "./CommitGraphLayer";
import {
  getGitTreeLaneCountForCommits,
  getGitTreeRailWidth,
} from "../git-tree/renderGraph";
import {
  commitListView,
  commitSearchInputKeyAction,
  commitSelectionVisible,
  firstCommitId,
} from "../lib/commitListView";
import {
  commitScrollTopForMeasuredCenter,
  commitScrollTopForSelection,
  commitVirtualWindow,
} from "../lib/commitListGeometry";
import type { CommitRowAction } from "../lib/commitRowView";
import { useCommitInfoPreviewPanel } from "../lib/useCommitInfoPreviewPanel";
import { useCommitSearch } from "../lib/useCommitSearch";
import type { CommitItem, CommitSearchResponse, UiPreferences } from "../types";

function commitScrollContainer(listNode: HTMLElement) {
  return listNode.closest<HTMLElement>(".scroll-region") ?? listNode;
}

function commitListSpacerStyle(height: number) {
  return { height: `${height}px` } satisfies CSSProperties;
}

export function RecentCommits({
  commits,
  selectedId,
  centerSelectedSignal = 0,
  expandSelectedMessage = false,
  onSelect,
  onSelectSearchCommit,
  onAction,
  onSearchCommits,
  graphStyle = "solid",
  graphNodeY = 22,
}: {
  commits: CommitItem[];
  selectedId: string;
  centerSelectedSignal?: number;
  expandSelectedMessage?: boolean;
  onSelect: (id: string) => void;
  onSelectSearchCommit?: (commit: CommitItem) => void;
  onAction: (action: CommitRowAction, commit: CommitItem) => void;
  onSearchCommits?: (query: string) => Promise<CommitSearchResponse>;
  graphStyle?: UiPreferences["graphStyle"];
  graphNodeY?: number;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const previousSearchTermCountRef = useRef(0);
  const pendingCenterSelectedIdRef = useRef("");
  const pendingCenterAttemptsRef = useRef(0);
  const [scrollFrame, setScrollFrame] = useState({ scrollTop: 0, viewportHeight: 0 });
  const [remoteSearch, setRemoteSearch] = useState<{
    query: string;
    commits: CommitItem[];
    totalMatches: number;
    scannedCommits: number;
    loading: boolean;
  } | null>(null);
  const {
    closeCommitPreview,
    previewCommit,
    scheduleCommitPreviewCloseAfterBlur,
  } = useCommitInfoPreviewPanel({ selectedId });
  const commitSearch = useCommitSearch(commits);
  const remoteSearchActive = Boolean(
    remoteSearch &&
      remoteSearch.query === commitSearch.searchQuery.trim() &&
      commitSearch.searchTerms.length > 0 &&
      !remoteSearch.loading,
  );
  const remoteSearchView = useMemo(
    () =>
      remoteSearchActive && remoteSearch
        ? commitListView(remoteSearch.commits, commitSearch.searchQuery, commitSearch.searchOpen)
        : null,
    [commitSearch.searchOpen, commitSearch.searchQuery, remoteSearch, remoteSearchActive],
  );
  const count = remoteSearchView?.count ?? commitSearch.count;
  const emptyState = remoteSearchView?.emptyState ?? commitSearch.emptyState;
  const filteredCommits = remoteSearchView?.filteredCommits ?? commitSearch.filteredCommits;
  const heading = commitSearch.heading;
  const headingToolsClassName = remoteSearchView?.headingToolsClassName ?? commitSearch.headingToolsClassName;
  const list = commitSearch.list;
  const searchClearButton = commitSearch.searchClearButton;
  const searchForm = commitSearch.searchForm;
  const searchInput = commitSearch.searchInput;
  const searchTerms = commitSearch.searchTerms;
  const searchToggle = commitSearch.searchToggle;
  const section = commitSearch.section;
  const showCommits = remoteSearchView?.showCommits ?? commitSearch.showCommits;
  const showEmptyState = remoteSearchView?.showEmptyState ?? commitSearch.showEmptyState;
  const showSearchForm = commitSearch.showSearchForm;
  const searchInputRef = commitSearch.searchInputRef;
  const searchQuery = commitSearch.searchQuery;
  const searchToggleRef = commitSearch.searchToggleRef;
  const setSearchQuery = commitSearch.setSearchQuery;
  const closeSearch = commitSearch.closeSearch;
  const toggleSearch = commitSearch.toggleSearch;
  const title = commitSearch.title;
  const titleId = commitSearch.titleId;
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
    const query = searchQuery.trim();
    if (!onSearchCommits || !query) {
      setRemoteSearch(null);
      return undefined;
    }

    let canceled = false;
    const timer = window.setTimeout(() => {
      setRemoteSearch((current) =>
        current?.query === query
          ? { ...current, loading: true }
          : { query, commits: [], totalMatches: 0, scannedCommits: 0, loading: true },
      );

      onSearchCommits(query)
        .then((response) => {
          if (canceled) return;
          if (!response.ok || response.query.trim() !== query) {
            setRemoteSearch({ query, commits: [], totalMatches: 0, scannedCommits: 0, loading: false });
            return;
          }

          setRemoteSearch({
            query,
            commits: response.commits,
            totalMatches: response.totalMatches,
            scannedCommits: response.scannedCommits,
            loading: false,
          });
        })
        .catch(() => {
          if (!canceled) setRemoteSearch({ query, commits: [], totalMatches: 0, scannedCommits: 0, loading: false });
        });
    }, 250);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [onSearchCommits, searchQuery]);

  function handleSelectCommit(commit: CommitItem) {
    if (remoteSearchActive && !commits.some((loadedCommit) => loadedCommit.id === commit.id) && onSelectSearchCommit) {
      closeSearch();
      setSearchQuery("");
      setRemoteSearch(null);
      onSelectSearchCommit(commit);
      return;
    }

    onSelect(commit.id);
  }

  useEffect(() => {
    if (!centerSelectedSignal || !selectedId) return;

    const listNode = listRef.current;
    if (!listNode) return;

    const scrollNode = commitScrollContainer(listNode);
    const scrollRect = scrollNode.getBoundingClientRect();
    const listRect = listNode.getBoundingClientRect();
    const selectedIndex = filteredCommits.findIndex((commit) => commit.id === selectedId);
    pendingCenterSelectedIdRef.current = selectedId;
    pendingCenterAttemptsRef.current = 0;
    const maxScrollTop = Math.max(0, scrollNode.scrollHeight - scrollNode.clientHeight);
    const nextScrollTop = commitScrollTopForSelection({
      itemCount: filteredCommits.length,
      selectedIndex,
      scrollTop: scrollNode.scrollTop,
      viewportHeight: scrollNode.clientHeight,
      alignment: "center",
      listViewportTop: scrollRect.top - listRect.top,
      maxScrollTop,
    });

    if (nextScrollTop !== null) {
      scrollNode.scrollTo({ top: nextScrollTop, behavior: "auto" });
      setScrollFrame({ scrollTop: nextScrollTop, viewportHeight: scrollNode.clientHeight });
    }
  }, [centerSelectedSignal, filteredCommits, selectedId]);

  useEffect(() => {
    const previousSearchTermCount = previousSearchTermCountRef.current;
    previousSearchTermCountRef.current = searchTerms.length;
    if (previousSearchTermCount === 0 || searchTerms.length > 0 || !selectedId) return;

    const listNode = listRef.current;
    if (!listNode) return;

    const scrollNode = commitScrollContainer(listNode);
    const scrollRect = scrollNode.getBoundingClientRect();
    const listRect = listNode.getBoundingClientRect();
    const selectedIndex = filteredCommits.findIndex((commit) => commit.id === selectedId);
    pendingCenterSelectedIdRef.current = selectedId;
    pendingCenterAttemptsRef.current = 0;
    const maxScrollTop = Math.max(0, scrollNode.scrollHeight - scrollNode.clientHeight);
    const nextScrollTop = commitScrollTopForSelection({
      itemCount: filteredCommits.length,
      selectedIndex,
      scrollTop: scrollNode.scrollTop,
      viewportHeight: scrollNode.clientHeight,
      alignment: "center",
      listViewportTop: scrollRect.top - listRect.top,
      maxScrollTop,
    });

    if (nextScrollTop !== null) {
      scrollNode.scrollTo({ top: nextScrollTop, behavior: "auto" });
      setScrollFrame({ scrollTop: nextScrollTop, viewportHeight: scrollNode.clientHeight });
    }
  }, [filteredCommits, searchTerms.length, selectedId]);

  useLayoutEffect(() => {
    const pendingSelectedId = pendingCenterSelectedIdRef.current;
    if (!pendingSelectedId) return;
    if (pendingSelectedId !== selectedId) {
      pendingCenterSelectedIdRef.current = "";
      pendingCenterAttemptsRef.current = 0;
      return;
    }

    const listNode = listRef.current;
    if (!listNode) return;

    const scrollNode = commitScrollContainer(listNode);
    const selectedRow = listNode.querySelector<HTMLElement>(".commit-row.is-selected");
    if (!selectedRow) return;

    pendingCenterAttemptsRef.current += 1;
    const selectedRect = selectedRow.getBoundingClientRect();
    const scrollRect = scrollNode.getBoundingClientRect();
    const maxScrollTop = Math.max(0, scrollNode.scrollHeight - scrollNode.clientHeight);
    const centeredScrollTop = commitScrollTopForMeasuredCenter({
      selectedTop: selectedRect.top,
      selectedHeight: selectedRect.height,
      viewportTop: scrollRect.top,
      viewportHeight: scrollRect.height,
      scrollTop: scrollNode.scrollTop,
      maxScrollTop,
    });
    if (centeredScrollTop === null || pendingCenterAttemptsRef.current >= 6) {
      pendingCenterSelectedIdRef.current = "";
      pendingCenterAttemptsRef.current = 0;
      return;
    }

    scrollNode.scrollTo({ top: centeredScrollTop, behavior: "auto" });
    setScrollFrame({ scrollTop: centeredScrollTop, viewportHeight: scrollNode.clientHeight });
  }, [
    scrollFrame.scrollTop,
    scrollFrame.viewportHeight,
    selectedId,
    virtualWindow.endIndex,
    virtualWindow.startIndex,
  ]);

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
    if (selectedId && !commitSelectionVisible(filteredCommits, selectedId)) onSelect("");
  }, [filteredCommits, onSelect, selectedId]);

  function handleCommitListBlur(event: FocusEvent<HTMLDivElement>) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    scheduleCommitPreviewCloseAfterBlur();
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
                const commit = filteredCommits.find((item) => item.id === commitId);
                if (commit) handleSelectCommit(commit);
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
                    const commit = filteredCommits.find((item) => item.id === commitId);
                    if (commit) handleSelectCommit(commit);
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
        onBlur={handleCommitListBlur}
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
              onSelect={() => handleSelectCommit(commit)}
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
