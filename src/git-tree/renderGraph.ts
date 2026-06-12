import { joinClass } from "../lib/classNames";
import type { BranchColor, CommitGraph, CommitItem } from "../types";

const LANE_GAP = 12;
const LANE_START_X = 9;
const MIN_GRAPH_WIDTH = 42;

export interface GitTreeNode {
  x: number;
  leftPercent: number;
  color: BranchColor;
  className: string;
  isCurrentHead: boolean;
  showCore: boolean;
}

export interface GitTreeRenderModel {
  width: number;
  node: GitTreeNode;
}

export interface GitTreeRenderOptions {
  laneCount?: number;
}

export function gitTreeLaneX(column: number) {
  return LANE_START_X + column * LANE_GAP;
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

export function getGitTreeLaneCountForCommits(commits: readonly Pick<CommitItem, "graph">[]) {
  return commits.reduce((laneCount, commit) => Math.max(laneCount, getGitTreeRequiredLaneCount(commit.graph)), 1);
}

export function getGitTreeRailWidth(laneCount: number) {
  return Math.max(MIN_GRAPH_WIDTH, LANE_START_X * 2 + Math.max(1, laneCount) * LANE_GAP);
}

export function buildGitTreeRenderModel(graph: CommitGraph, options: GitTreeRenderOptions = {}): GitTreeRenderModel {
  const laneCount = Math.max(getGitTreeRequiredLaneCount(graph), options.laneCount ?? 1);
  const width = getGitTreeRailWidth(laneCount);
  const nodeX = gitTreeLaneX(graph.column);

  return {
    width,
    node: {
      x: nodeX,
      leftPercent: (nodeX / width) * 100,
      color: graph.currentColor,
      className: joinClass("graph-node", graph.isCurrentHead && "is-current-head", graph.currentVariant === "dashed" && "is-dashed"),
      isCurrentHead: graph.isCurrentHead,
      showCore: graph.isCurrentHead,
    },
  };
}
