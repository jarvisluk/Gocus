import { joinClass } from "../lib/classNames";
import type { BranchColor, CommitGraph, GraphBridge, GraphLaneSegment, GraphLineVariant } from "../types";

const LANE_GAP = 12;
const LANE_START_X = 9;
const MIN_GRAPH_WIDTH = 42;
const BRIDGE_CONTROL_OFFSET = 26;
const BRIDGE_DROP = 12;
const BRIDGE_HEIGHT = BRIDGE_CONTROL_OFFSET + BRIDGE_DROP;

export type GitTreePathSegment = "top" | "bridge" | "tail";

export interface GitTreePath {
  id: string;
  className: string;
  d: string;
  color: BranchColor;
  segment: GitTreePathSegment;
}

export interface GitTreeNode {
  x: number;
  leftPercent: number;
  color: BranchColor;
  className: string;
  isMerge: boolean;
  showCore: boolean;
}

export interface GitTreeRenderModel {
  width: number;
  bridgeHeight: number;
  paths: GitTreePath[];
  node: GitTreeNode;
}

export interface GitTreeRenderOptions {
  laneCount?: number;
}

function lineClass(extraClass?: string, variant: GraphLineVariant = "solid") {
  return joinClass("graph-line", variant === "dashed" && "is-dashed", extraClass);
}

function laneX(column: number) {
  return LANE_START_X + column * LANE_GAP;
}

function bridgePath(bridge: GraphBridge) {
  const fromX = laneX(bridge.fromColumn);
  const toX = laneX(bridge.toColumn);
  return `M ${fromX} 0 C ${fromX} ${BRIDGE_CONTROL_OFFSET}, ${toX} ${BRIDGE_CONTROL_OFFSET}, ${toX} ${BRIDGE_HEIGHT}`;
}

function verticalPath(column: number, segment: GitTreePathSegment) {
  const x = laneX(column);
  return segment === "bridge" ? `M ${x} 0 L ${x} ${BRIDGE_HEIGHT}` : `M ${x} 0 L ${x} 1`;
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

function laneSegmentPaths(segment: GraphLaneSegment, index: number, prefix: string): GitTreePath[] {
  const paths: GitTreePath[] = [];

  if (segment.from !== "node") {
    paths.push({
      id: `${prefix}-top-${index}-${segment.column}-${segment.color}`,
      className: lineClass(undefined, segment.variant),
      d: verticalPath(segment.column, "top"),
      color: segment.color,
      segment: "top",
    });
  }

  if (segment.to !== "node") {
    paths.push(
      {
        id: `${prefix}-bridge-${index}-${segment.column}-${segment.color}`,
        className: lineClass(undefined, segment.variant),
        d: verticalPath(segment.column, "bridge"),
        color: segment.color,
        segment: "bridge",
      },
      {
        id: `${prefix}-tail-${index}-${segment.column}-${segment.color}`,
        className: lineClass(undefined, segment.variant),
        d: verticalPath(segment.column, "tail"),
        color: segment.color,
        segment: "tail",
      },
    );
  }

  return paths;
}

export function buildGitTreeRenderModel(graph: CommitGraph, options: GitTreeRenderOptions = {}): GitTreeRenderModel {
  const laneCount = Math.max(getGitTreeRequiredLaneCount(graph), options.laneCount ?? 1);
  const width = getGitTreeRailWidth(laneCount);
  const nodeX = laneX(graph.column);
  const paths: GitTreePath[] = [
    ...graph.passThrough.flatMap((lane, index) => laneSegmentPaths(lane, index, "through")),
    ...(graph.currentContinues
      ? [
          {
            id: `current-${graph.column}-${graph.currentColor}`,
            className: lineClass(undefined, graph.currentVariant),
            d: verticalPath(graph.column, "top"),
            color: graph.currentColor,
            segment: "top" as const,
          },
        ]
      : []),
    ...graph.parentStems.flatMap((lane, index) => laneSegmentPaths({ ...lane, from: "node" }, index, "stem")),
    ...graph.bridges
      .filter((bridge) => bridge.fromColumn !== bridge.toColumn)
      .flatMap((bridge, index) => {
        const bridgePaths: GitTreePath[] = [
          {
            id: `bridge-${index}-${bridge.fromColumn}-${bridge.toColumn}-${bridge.color}-${bridge.to ?? "bottom"}`,
            className: lineClass("graph-bridge", bridge.variant),
            d: bridgePath(bridge),
            color: bridge.color,
            segment: "bridge",
          },
        ];

        if (bridge.to !== "lane") {
          bridgePaths.push({
            id: `bridge-tail-${index}-${bridge.toColumn}-${bridge.color}`,
            className: lineClass(undefined, bridge.variant),
            d: verticalPath(bridge.toColumn, "tail"),
            color: bridge.color,
            segment: "tail",
          });
        }

        return bridgePaths;
      }),
  ];

  return {
    width,
    bridgeHeight: BRIDGE_HEIGHT,
    paths,
    node: {
      x: nodeX,
      leftPercent: (nodeX / width) * 100,
      color: graph.currentColor,
      className: joinClass("graph-node", graph.isMerge && "is-merge", graph.currentVariant === "dashed" && "is-dashed"),
      isMerge: graph.isMerge,
      showCore: graph.isMerge,
    },
  };
}
