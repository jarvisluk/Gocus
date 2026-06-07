import type { BranchColor, CommitGraph, GraphBridge, GraphLaneSegment, GraphLineVariant } from "../types";

const LANE_GAP = 12;
const LANE_START_X = 9;
const MIN_GRAPH_WIDTH = 42;
const NODE_Y = 32;
const GRAPH_HEIGHT = 100;
const BRIDGE_CONTROL_OFFSET = 26;
const BRIDGE_DROP = 12;

export interface GitTreePath {
  id: string;
  className: string;
  d: string;
  color: BranchColor;
}

export interface GitTreeNode {
  x: number;
  y: number;
  leftPercent: number;
  topPercent: number;
  color: BranchColor;
  isMerge: boolean;
}

export interface GitTreeRenderModel {
  width: number;
  height: number;
  viewBox: string;
  paths: GitTreePath[];
  node: GitTreeNode;
}

export interface GitTreeRenderOptions {
  laneCount?: number;
}

function lineClass(extraClass?: string, variant: GraphLineVariant = "solid") {
  return ["graph-line", variant === "dashed" && "is-dashed", extraClass].filter(Boolean).join(" ");
}

function laneX(column: number) {
  return LANE_START_X + column * LANE_GAP;
}

function bridgePath(bridge: GraphBridge) {
  const fromX = laneX(bridge.fromColumn);
  const toX = laneX(bridge.toColumn);
  const curveY = NODE_Y + BRIDGE_CONTROL_OFFSET;
  const joinY = curveY + BRIDGE_DROP;
  const curve = `M ${fromX} ${NODE_Y} C ${fromX} ${curveY}, ${toX} ${curveY}, ${toX} ${joinY}`;

  return bridge.to === "lane" ? curve : `${curve} L ${toX} ${GRAPH_HEIGHT}`;
}

function highestColumn(graph: CommitGraph) {
  const columns = [
    graph.column,
    ...graph.passThrough.map((lane) => lane.column),
    ...graph.parentStems.map((lane) => lane.column),
    ...graph.bridges.flatMap((bridge) => [bridge.fromColumn, bridge.toColumn]),
  ];

  return Math.max(0, ...columns);
}

export function getGitTreeRequiredLaneCount(graph: CommitGraph) {
  return Math.max(1, graph.laneCount, highestColumn(graph) + 1);
}

export function getGitTreeRailWidth(laneCount: number) {
  return Math.max(MIN_GRAPH_WIDTH, LANE_START_X * 2 + Math.max(1, laneCount) * LANE_GAP);
}

function segmentPath(segment: GraphLaneSegment, yStart: number, yEnd: number) {
  const x = laneX(segment.column);
  const start = segment.from === "node" ? NODE_Y : yStart;
  const end = segment.to === "node" ? NODE_Y : yEnd;
  return `M ${x} ${start} L ${x} ${end}`;
}

export function buildGitTreeRenderModel(graph: CommitGraph, options: GitTreeRenderOptions = {}): GitTreeRenderModel {
  const laneCount = Math.max(getGitTreeRequiredLaneCount(graph), options.laneCount ?? 1);
  const width = getGitTreeRailWidth(laneCount);
  const nodeX = laneX(graph.column);
  const paths: GitTreePath[] = [
    ...graph.passThrough.map((lane, index) => ({
      id: `through-${index}-${lane.column}-${lane.color}-${lane.from ?? "top"}-${lane.to ?? "bottom"}`,
      className: lineClass(undefined, lane.variant),
      d: segmentPath(lane, 0, GRAPH_HEIGHT),
      color: lane.color,
    })),
    ...(graph.currentContinues
      ? [
          {
            id: `current-${graph.column}-${graph.currentColor}`,
            className: lineClass(undefined, graph.currentVariant),
            d: `M ${nodeX} 0 L ${nodeX} ${NODE_Y}`,
            color: graph.currentColor,
          },
        ]
      : []),
    ...graph.parentStems.map((lane, index) => ({
      id: `stem-${index}-${lane.column}-${lane.color}`,
      className: lineClass(undefined, lane.variant),
      d: segmentPath(lane, NODE_Y, GRAPH_HEIGHT),
      color: lane.color,
    })),
    ...graph.bridges
      .filter((bridge) => bridge.fromColumn !== bridge.toColumn)
      .map((bridge, index) => ({
        id: `bridge-${index}-${bridge.fromColumn}-${bridge.toColumn}-${bridge.color}-${bridge.to ?? "bottom"}`,
        className: lineClass("graph-bridge", bridge.variant),
        d: bridgePath(bridge),
        color: bridge.color,
      })),
  ];

  return {
    width,
    height: GRAPH_HEIGHT,
    viewBox: `0 0 ${width} ${GRAPH_HEIGHT}`,
    paths,
    node: {
      x: nodeX,
      y: NODE_Y,
      leftPercent: (nodeX / width) * 100,
      topPercent: NODE_Y,
      color: graph.currentColor,
      isMerge: graph.isMerge,
    },
  };
}
