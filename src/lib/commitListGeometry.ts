export const commitVirtualRowHeight = 68;
export const selectedCommitVirtualRowHeight = 116;
export const commitVirtualOverscanRows = 8;
export const commitVirtualizationThreshold = 120;

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

export type CommitScrollSelectionAlignment = "nearest" | "center";

export interface CommitScrollSelectionOptions {
  itemCount: number;
  selectedIndex: number;
  scrollTop: number;
  viewportHeight: number;
  alignment?: CommitScrollSelectionAlignment;
  listViewportTop?: number;
  maxScrollTop?: number;
}

export interface CommitMeasuredCenterScrollOptions {
  selectedTop: number;
  selectedHeight: number;
  viewportTop: number;
  viewportHeight: number;
  scrollTop: number;
  maxScrollTop: number;
  tolerance?: number;
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

export function commitScrollTopForSelection({
  itemCount,
  selectedIndex,
  scrollTop,
  viewportHeight,
  alignment = "nearest",
  listViewportTop,
  maxScrollTop,
}: CommitScrollSelectionOptions) {
  const safeItemCount = Math.max(0, itemCount);
  const selected = normalizedSelectedIndex(selectedIndex, safeItemCount);
  if (selected === -1) return null;

  const selectedTop = commitVirtualRowOffset(selected, safeItemCount, selected);
  const selectedBottom = commitVirtualRowOffset(selected + 1, safeItemCount, selected);
  const safeViewportHeight = Math.max(0, viewportHeight);
  const safeScrollTop = Math.max(0, scrollTop);
  const safeListViewportTop = listViewportTop ?? safeScrollTop;
  const scrollBottom = safeListViewportTop + safeViewportHeight;

  if (alignment === "nearest" && selectedTop >= safeListViewportTop && selectedBottom <= scrollBottom) return null;

  const totalHeight = commitVirtualTotalHeight(safeItemCount, selected);
  const safeMaxScrollTop = Math.max(0, maxScrollTop ?? totalHeight - safeViewportHeight);
  const nextListViewportTop =
    alignment === "center"
      ? selectedTop + (selectedBottom - selectedTop) / 2 - safeViewportHeight / 2
      : selectedTop < safeListViewportTop
        ? selectedTop
        : selectedBottom - safeViewportHeight;
  const nextScrollTop = safeScrollTop + nextListViewportTop - safeListViewportTop;

  const clampedScrollTop = clampNumber(nextScrollTop, 0, safeMaxScrollTop);
  return clampedScrollTop === safeScrollTop ? null : clampedScrollTop;
}

export function commitScrollTopForMeasuredCenter({
  selectedTop,
  selectedHeight,
  viewportTop,
  viewportHeight,
  scrollTop,
  maxScrollTop,
  tolerance = 1,
}: CommitMeasuredCenterScrollOptions) {
  const selectedCenter = selectedTop + Math.max(0, selectedHeight) / 2;
  const viewportCenter = viewportTop + Math.max(0, viewportHeight) / 2;
  const centerDelta = selectedCenter - viewportCenter;
  if (Math.abs(centerDelta) < tolerance) return null;

  const safeScrollTop = Math.max(0, scrollTop);
  const safeMaxScrollTop = Math.max(0, maxScrollTop);
  const centeredScrollTop = clampNumber(safeScrollTop + centerDelta, 0, safeMaxScrollTop);
  return centeredScrollTop === safeScrollTop ? null : centeredScrollTop;
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
