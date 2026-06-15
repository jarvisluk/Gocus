import {
  commitVirtualRowOffset,
  commitVirtualTotalHeight,
  selectedCommitVirtualRowHeight,
} from "../lib/commitListView";
import type { BranchColor, CommitItem, GraphLineVariant } from "../types";
import { buildGitTreeRenderModel, getGitTreeRailWidth, gitTreeLaneX } from "./renderGraph";

export const gitTreeNodeY = 22;
const NODE_RADIUS = 7.5;
const NODE_LINE_CLEARANCE = 2;
const NODE_LINE_ENDPOINT_OFFSET = NODE_RADIUS + NODE_LINE_CLEARANCE;

export type GitTreeCanvasLine =
  | {
      kind: "vertical";
      x: number;
      fromY: number;
      toY: number;
      color: BranchColor;
      variant: GraphLineVariant;
    }
  | {
      kind: "bridge";
      fromX: number;
      startX: number;
      toX: number;
      fromY: number;
      joinY: number;
      toY: number;
      controlFromX: number;
      controlFromY: number;
      controlToX: number;
      controlToY: number;
      color: BranchColor;
      variant: GraphLineVariant;
    };

export interface GitTreeCanvasNode {
  id: string;
  x: number;
  y: number;
  color: BranchColor;
  className: string;
  showCore: boolean;
}

export interface GitTreeCanvasModel {
  top: number;
  width: number;
  height: number;
  lines: GitTreeCanvasLine[];
  nodes: GitTreeCanvasNode[];
}

export interface GitTreeCanvasRowLayout {
  id: string;
  top: number;
  bottom: number;
}

export interface GitTreeCanvasLayout {
  top: number;
  rows: readonly GitTreeCanvasRowLayout[];
}

export interface GitTreeCanvasModelOptions {
  commits: readonly CommitItem[];
  startIndex: number;
  itemCount: number;
  selectedIndex: number;
  laneCount: number;
  nodeY?: number;
  rowLayout?: GitTreeCanvasLayout | null;
}

function selectedIndexForOffsets(selectedIndex: number, itemCount: number) {
  return selectedIndex >= 0 && selectedIndex < itemCount ? selectedIndex : -1;
}

function lineVariant(variant: GraphLineVariant | undefined) {
  return variant ?? "solid";
}

function snapGraphPixel(value: number) {
  return Math.round(value * 2) / 2;
}

function orderedVerticalLine(fromY: number, toY: number) {
  const orderedFromY = Math.min(fromY, toY);
  const orderedToY = Math.max(fromY, toY);

  return {
    fromY: snapGraphPixel(orderedFromY),
    toY: snapGraphPixel(orderedToY),
  };
}

function bridgeJoinY(
  fromY: number,
  rowBottomY: number,
  fromX: number,
  toX: number,
  connectsToExistingLane: boolean,
) {
  const laneDistance = Math.abs(toX - fromX);
  const availableDrop = Math.max(0, rowBottomY - fromY);
  const preferredDrop = connectsToExistingLane
    ? Math.max(28, Math.min(38, 30 + laneDistance * 0.32))
    : Math.max(32, Math.min(46, 32 + laneDistance * 0.28));

  return fromY + Math.min(availableDrop, preferredDrop);
}

function bridgeControlDrop(drop: number) {
  return Math.min(drop * 0.48, Math.max(6, drop * 0.34));
}

function nodeLineTopY(rowTopY: number, nodeY: number) {
  return Math.max(rowTopY, nodeY - NODE_LINE_ENDPOINT_OFFSET);
}

function nodeLineBottomY(rowBottomY: number, nodeY: number) {
  return Math.min(rowBottomY, nodeY + NODE_LINE_ENDPOINT_OFFSET);
}

function nodeBridgeStartY(rowBottomY: number, nodeY: number) {
  return Math.min(rowBottomY, nodeY + NODE_LINE_ENDPOINT_OFFSET);
}

function addVerticalLine(
  lines: GitTreeCanvasLine[],
  column: number,
  fromY: number,
  toY: number,
  color: BranchColor,
  variant: GraphLineVariant | undefined,
) {
  const orderedLine = orderedVerticalLine(fromY, toY);
  if (Math.abs(orderedLine.toY - orderedLine.fromY) < 0.5) return;

  lines.push({
    kind: "vertical",
    x: snapGraphPixel(gitTreeLaneX(column)),
    color,
    variant: lineVariant(variant),
    ...orderedLine,
  });
}

function addBridgeLine(
  lines: GitTreeCanvasLine[],
  fromColumn: number,
  toColumn: number,
  fromY: number,
  rowBottomY: number,
  color: BranchColor,
  variant: GraphLineVariant | undefined,
  connectsToExistingLane = false,
  startsAtNode = false,
) {
  if (fromColumn === toColumn) return;

  const fromX = gitTreeLaneX(fromColumn);
  const toX = gitTreeLaneX(toColumn);
  const startX = fromX;
  const startY = startsAtNode ? nodeBridgeStartY(rowBottomY, fromY) : fromY;
  const joinY = bridgeJoinY(startY, rowBottomY, fromX, toX, connectsToExistingLane);
  const drop = joinY - startY;
  const controlDrop = bridgeControlDrop(drop);
  const controlFromX = startX;
  const controlFromY = startY + controlDrop;
  const controlToX = toX;
  const controlToY = joinY - controlDrop;
  const toY = connectsToExistingLane ? joinY : rowBottomY;

  lines.push({
    kind: "bridge",
    fromX: snapGraphPixel(fromX),
    startX: snapGraphPixel(startX),
    toX: snapGraphPixel(toX),
    fromY: snapGraphPixel(startY),
    joinY: snapGraphPixel(joinY),
    toY: snapGraphPixel(toY),
    controlFromX: snapGraphPixel(controlFromX),
    controlFromY: snapGraphPixel(controlFromY),
    controlToX: snapGraphPixel(controlToX),
    controlToY: snapGraphPixel(controlToY),
    color,
    variant: lineVariant(variant),
  });
}

function validRowLayout(commits: readonly CommitItem[], rowLayout: GitTreeCanvasLayout | null | undefined) {
  if (!rowLayout || rowLayout.rows.length !== commits.length) return null;
  return rowLayout.rows.every((row, index) => row.id === commits[index]?.id && row.bottom >= row.top) ? rowLayout : null;
}

export function buildGitTreeCanvasModel({
  commits,
  startIndex,
  itemCount,
  selectedIndex,
  laneCount,
  nodeY = gitTreeNodeY,
  rowLayout,
}: GitTreeCanvasModelOptions): GitTreeCanvasModel {
  const safeItemCount = Math.max(0, itemCount);
  const safeStartIndex = Math.min(Math.max(0, startIndex), safeItemCount);
  const safeEndIndex = Math.min(safeStartIndex + commits.length, safeItemCount);
  const offsetSelectedIndex = selectedIndexForOffsets(selectedIndex, safeItemCount);
  const measuredLayout = validRowLayout(commits, rowLayout);
  const top = measuredLayout?.top ?? commitVirtualRowOffset(safeStartIndex, safeItemCount, offsetSelectedIndex);
  const bottom = measuredLayout
    ? Math.max(top, top + Math.max(0, ...measuredLayout.rows.map((row) => row.bottom)))
    : commits.length
      ? commitVirtualRowOffset(safeEndIndex, safeItemCount, offsetSelectedIndex)
      : top;
  const height = Math.max(0, bottom - top);
  const width = getGitTreeRailWidth(laneCount);
  const rowNodeY = Math.max(0, nodeY);
  const lines: GitTreeCanvasLine[] = [];
  const nodes: GitTreeCanvasNode[] = [];

  commits.forEach((commit, visibleIndex) => {
    const commitIndex = safeStartIndex + visibleIndex;
    const measuredRow = measuredLayout?.rows[visibleIndex];
    const rowTopY = measuredRow?.top ?? commitVirtualRowOffset(commitIndex, safeItemCount, offsetSelectedIndex) - top;
    const rowBottomY = measuredRow?.bottom ?? commitVirtualRowOffset(commitIndex + 1, safeItemCount, offsetSelectedIndex) - top;
    const nodeY = rowTopY + rowNodeY;
    const graph = commit.graph;

    graph.passThrough.forEach((lane) => {
      if (lane.from !== "node") addVerticalLine(lines, lane.column, rowTopY, nodeY, lane.color, lane.variant);
      if (lane.to !== "node") addVerticalLine(lines, lane.column, nodeY, rowBottomY, lane.color, lane.variant);
    });

    if (graph.currentContinues) {
      addVerticalLine(lines, graph.column, rowTopY, nodeLineTopY(rowTopY, nodeY), graph.incomingColor, graph.incomingVariant);
    }

    graph.parentStems.forEach((lane) => {
      addVerticalLine(lines, lane.column, nodeLineBottomY(rowBottomY, nodeY), rowBottomY, lane.color, lane.variant);
    });

    graph.bridges.forEach((bridge) => {
      addBridgeLine(
        lines,
        bridge.fromColumn,
        bridge.toColumn,
        nodeY,
        rowBottomY,
        bridge.color,
        bridge.variant,
        bridge.to === "lane",
        bridge.fromColumn === graph.column,
      );
    });

    const renderModel = buildGitTreeRenderModel(graph, { laneCount });
    nodes.push({
      id: commit.id,
      x: snapGraphPixel(renderModel.node.x),
      y: snapGraphPixel(nodeY),
      color: renderModel.node.color,
      className: renderModel.node.className,
      showCore: renderModel.node.showCore,
    });
  });

  return {
    top,
    width,
    height,
    lines,
    nodes,
  };
}

export function gitTreeCanvasTotalHeight(itemCount: number, selectedIndex: number) {
  return commitVirtualTotalHeight(itemCount, selectedIndexForOffsets(selectedIndex, itemCount));
}

export function gitTreeSelectedRowHeight() {
  return selectedCommitVirtualRowHeight;
}
