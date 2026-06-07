import { GitFork } from "lucide-react";
import { type CSSProperties } from "react";
import type { CommitGraph, GitWorktree } from "../types";
import { buildGitTreeRenderModel } from "./renderGraph";

function joinClass(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function shortHash(hash: string) {
  return hash.slice(0, 7);
}

function pathName(pathValue: string) {
  const trimmed = pathValue.replace(/[\\/]+$/, "");
  return trimmed.split(/[\\/]/).pop() || pathValue;
}

function worktreeMarkerLabel(worktree: GitWorktree) {
  const location = pathName(worktree.path);
  const checkout = worktree.detached ? `detached ${shortHash(worktree.head)}` : worktree.branch || "worktree";
  return `${worktree.current ? "Current worktree" : "Worktree"}: ${checkout} - ${location}`;
}

export function GitTreeCell({
  graph,
  laneCount,
  checkedOutWorktrees = [],
}: {
  graph: CommitGraph;
  laneCount?: number;
  checkedOutWorktrees?: GitWorktree[];
}) {
  const model = buildGitTreeRenderModel(graph, { laneCount });
  const hasCheckedOutWorktree = checkedOutWorktrees.length > 0;
  const hasCurrentWorktree = checkedOutWorktrees.some((worktree) => worktree.current);
  const hasExternalWorktree = checkedOutWorktrees.some((worktree) => !worktree.current);
  const worktreeTitle = checkedOutWorktrees.map(worktreeMarkerLabel).join("\n");
  const nodeStyle = {
    left: `${model.node.leftPercent}%`,
    top: `${model.node.topPercent}%`,
    "--git-tree-color": model.node.color,
  } as CSSProperties;

  return (
    <div className="timeline-cell" aria-hidden={hasCheckedOutWorktree ? undefined : "true"} aria-label={hasCheckedOutWorktree ? worktreeTitle : undefined}>
      <svg className="graph-svg" viewBox={model.viewBox} preserveAspectRatio="none">
        {model.paths.map((path) => (
          <path
            className={path.className}
            d={path.d}
            key={path.id}
            style={{ "--git-tree-color": path.color } as CSSProperties}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <span className={joinClass("graph-node", model.node.isMerge && "is-merge", hasCheckedOutWorktree && "has-worktree", graph.currentVariant === "dashed" && "is-dashed")} style={nodeStyle}>
        {model.node.isMerge ? <span className="graph-node-core" /> : null}
      </span>
      {hasCheckedOutWorktree ? (
        <span className={joinClass("graph-worktree-marker", hasCurrentWorktree && "is-current", !hasCurrentWorktree && hasExternalWorktree && "is-external")} style={nodeStyle} title={worktreeTitle}>
          <GitFork aria-hidden="true" />
          {checkedOutWorktrees.length > 1 ? <span className="graph-worktree-count">{checkedOutWorktrees.length}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
