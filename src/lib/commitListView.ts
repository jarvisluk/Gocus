import type { CommitItem, GitSnapshot } from "../types";
import { joinClass } from "./classNames";
import { commitMatchesSearch, commitSearchTerms } from "./commitSearch";
import { politeStatusView } from "./statusView";

export type CommitSearchToggleAction = "open" | "close";
export type CommitSearchInputKeyAction = "selectFirst" | "close" | "ignore";
const commitSearchFormId = "commit-search-form";
export const recentCommitsTitleId = "recent-commits-title";
export const commitVirtualRowHeight = 64;
export const selectedCommitVirtualRowHeight = 112;
export const commitVirtualOverscanRows = 8;
export const commitVirtualizationThreshold = 120;

export interface CommitSearchState {
  searchOpen: boolean;
  searchQuery: string;
}

export interface CommitSearchStateTransition extends CommitSearchState {
  changed: boolean;
  restoreToggleFocus: boolean;
}

export interface CommitSearchStateApplication extends CommitSearchState {
  updateState: boolean;
  restoreToggleFocus: boolean;
}

export interface CommitVirtualWindowOptions {
  itemCount: number;
  selectedIndex: number;
  scrollTop: number;
  viewportHeight: number;
  overscanRows?: number;
  threshold?: number;
}

export interface CommitVirtualWindow {
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
  totalHeight: number;
  virtualized: boolean;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizedSelectedIndex(selectedIndex: number, itemCount: number) {
  return selectedIndex >= 0 && selectedIndex < itemCount ? selectedIndex : -1;
}

export function commitVirtualTotalHeight(itemCount: number, selectedIndex: number) {
  const safeItemCount = Math.max(0, itemCount);
  const selectedExtra = normalizedSelectedIndex(selectedIndex, safeItemCount) === -1
    ? 0
    : selectedCommitVirtualRowHeight - commitVirtualRowHeight;

  return safeItemCount * commitVirtualRowHeight + selectedExtra;
}

export function commitVirtualRowOffset(index: number, itemCount: number, selectedIndex: number) {
  const safeItemCount = Math.max(0, itemCount);
  const safeIndex = clampNumber(index, 0, safeItemCount);
  const selected = normalizedSelectedIndex(selectedIndex, safeItemCount);
  const selectedExtra = selected !== -1 && safeIndex > selected ? selectedCommitVirtualRowHeight - commitVirtualRowHeight : 0;

  return safeIndex * commitVirtualRowHeight + selectedExtra;
}

function commitVirtualIndexAtOffset(offset: number, itemCount: number, selectedIndex: number) {
  if (itemCount <= 0) return 0;

  const selected = normalizedSelectedIndex(selectedIndex, itemCount);
  const safeOffset = Math.max(0, offset);
  if (selected === -1) return clampNumber(Math.floor(safeOffset / commitVirtualRowHeight), 0, itemCount - 1);

  const selectedStart = selected * commitVirtualRowHeight;
  const selectedEnd = selectedStart + selectedCommitVirtualRowHeight;
  if (safeOffset < selectedStart) return clampNumber(Math.floor(safeOffset / commitVirtualRowHeight), 0, itemCount - 1);
  if (safeOffset < selectedEnd) return selected;

  return clampNumber(
    Math.floor((safeOffset - (selectedCommitVirtualRowHeight - commitVirtualRowHeight)) / commitVirtualRowHeight),
    0,
    itemCount - 1,
  );
}

export function commitVirtualWindow({
  itemCount,
  selectedIndex,
  scrollTop,
  viewportHeight,
  overscanRows = commitVirtualOverscanRows,
  threshold = commitVirtualizationThreshold,
}: CommitVirtualWindowOptions): CommitVirtualWindow {
  const safeItemCount = Math.max(0, itemCount);
  const selected = normalizedSelectedIndex(selectedIndex, safeItemCount);
  const totalHeight = commitVirtualTotalHeight(safeItemCount, selected);
  const safeViewportHeight = Math.max(0, viewportHeight);

  if (safeItemCount <= threshold || safeViewportHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: safeItemCount,
      topPadding: 0,
      bottomPadding: 0,
      totalHeight,
      virtualized: false,
    };
  }

  const overscanPixels = Math.max(0, overscanRows) * commitVirtualRowHeight;
  const startOffset = Math.max(0, scrollTop - overscanPixels);
  const endOffset = Math.min(totalHeight, scrollTop + safeViewportHeight + overscanPixels);
  const startIndex = commitVirtualIndexAtOffset(startOffset, safeItemCount, selected);
  const endIndex = clampNumber(commitVirtualIndexAtOffset(endOffset, safeItemCount, selected) + 1, startIndex, safeItemCount);
  const topPadding = commitVirtualRowOffset(startIndex, safeItemCount, selected);
  const bottomPadding = Math.max(0, totalHeight - commitVirtualRowOffset(endIndex, safeItemCount, selected));

  return {
    startIndex,
    endIndex,
    topPadding,
    bottomPadding,
    totalHeight,
    virtualized: true,
  };
}

function commitSearchStateTransition(
  current: CommitSearchState,
  next: CommitSearchState,
  restoreToggleFocus = false,
): CommitSearchStateTransition {
  return {
    ...next,
    changed: current.searchOpen !== next.searchOpen || current.searchQuery !== next.searchQuery,
    restoreToggleFocus,
  };
}

export function commitSearchStateApplication(transition: CommitSearchStateTransition): CommitSearchStateApplication {
  return {
    searchOpen: transition.searchOpen,
    searchQuery: transition.searchQuery,
    updateState: transition.changed,
    restoreToggleFocus: transition.restoreToggleFocus,
  };
}

export function commitSelectionVisible(commits: readonly CommitItem[], selectedId: string) {
  return Boolean(selectedId && commits.some((commit) => commit.id === selectedId));
}

export function selectedCommitIdAfterToggle(currentSelectedId: string, commitId: string) {
  return currentSelectedId === commitId ? "" : commitId;
}

export function selectedCommitFromSnapshot(snapshot: GitSnapshot | null, selectedId: string) {
  return snapshot?.commits.find((commit) => commit.id === selectedId) ?? null;
}

export function firstCommitId(commits: readonly CommitItem[]) {
  return commits[0]?.id ?? "";
}

export function commitSearchStateAfterClose(
  current: CommitSearchState,
  { restoreFocus = false }: { restoreFocus?: boolean } = {},
) {
  return commitSearchStateTransition(current, { searchOpen: false, searchQuery: "" }, restoreFocus);
}

export function commitSearchStateAfterToggle(
  current: CommitSearchState,
  toggle: { action: CommitSearchToggleAction; disabled: boolean },
) {
  if (toggle.disabled) return commitSearchStateTransition(current, current);
  if (toggle.action === "close") return commitSearchStateAfterClose(current);
  return commitSearchStateTransition(current, { ...current, searchOpen: true });
}

export function commitSearchStateAfterAvailability(current: CommitSearchState, canSearch: boolean) {
  if (canSearch || (!current.searchOpen && !current.searchQuery)) return commitSearchStateTransition(current, current);
  return commitSearchStateAfterClose(current);
}

export function commitSearchToggleView({
  canSearch,
  searchActive,
  searchOpen,
}: {
  canSearch: boolean;
  searchActive: boolean;
  searchOpen: boolean;
}) {
  return {
    action: searchOpen ? ("close" as CommitSearchToggleAction) : ("open" as CommitSearchToggleAction),
    ariaControls: commitSearchFormId,
    ariaExpanded: searchOpen,
    ariaLabel: searchOpen ? "Close commit search" : "Search commits",
    ariaPressed: searchActive,
    className: joinClass("commit-search-toggle", searchActive && "is-active"),
    disabled: !canSearch,
    title: canSearch ? undefined : "No commits to search",
    tooltip: canSearch && !searchOpen ? "Search commits" : undefined,
  };
}

export function commitSearchInputView() {
  return {
    ariaLabel: "Search commits",
    placeholder: "Search",
  };
}

export function commitSearchInputKeyAction(key: string): CommitSearchInputKeyAction {
  if (key === "Enter") return "selectFirst";
  if (key === "Escape") return "close";
  return "ignore";
}

export function commitSearchClearButtonView(searchQuery: string) {
  return {
    show: Boolean(searchQuery),
    className: "commit-search-clear",
    ariaLabel: "Clear commit search",
  };
}

export function commitListView(commits: readonly CommitItem[], searchQuery: string, searchOpen = false) {
  const searchTerms = commitSearchTerms(searchQuery);
  const filteredCommits = commits.filter((commit) => commitMatchesSearch(commit, searchTerms));
  const canSearch = commits.length > 0;
  const searchActive = canSearch && (searchOpen || searchTerms.length > 0);
  const searchClearButton = commitSearchClearButtonView(searchQuery);
  const countLabel = searchTerms.length ? `Showing ${filteredCommits.length}/${commits.length}` : `Showing ${commits.length}`;
  const emptyMessage = commits.length ? `No commits match "${searchQuery.trim()}".` : "No commits yet.";

  return {
    section: {
      className: "commits-section",
      ariaLabelledBy: recentCommitsTitleId,
    },
    heading: {
      className: "section-heading",
    },
    titleId: recentCommitsTitleId,
    title: "Commits",
    searchTerms,
    filteredCommits,
    filteredCount: filteredCommits.length,
    canSearch,
    searchActive,
    headingToolsClassName: joinClass("heading-tools", searchActive && "has-search"),
    count: politeStatusView({
      className: "commit-count",
      label: countLabel,
    }),
    showSearchForm: searchOpen,
    searchForm: {
      className: "commit-search",
      id: commitSearchFormId,
      role: "search" as const,
    },
    showSearchClearButton: searchClearButton.show,
    searchInput: commitSearchInputView(),
    searchClearButton,
    list: {
      className: "commit-list",
    },
    showCommits: filteredCommits.length > 0,
    showEmptyState: filteredCommits.length === 0,
    emptyState: politeStatusView({
      className: "commit-empty-state",
      message: emptyMessage,
    }),
    searchToggle: commitSearchToggleView({ canSearch, searchActive, searchOpen }),
    countLabel,
    emptyMessage,
  };
}
