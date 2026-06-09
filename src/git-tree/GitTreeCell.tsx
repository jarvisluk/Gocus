import { type CSSProperties } from "react";
import type { CommitGraph } from "../types";
import { buildGitTreeRenderModel } from "./renderGraph";

function joinClass(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function GitTreeCell({ graph, laneCount }: { graph: CommitGraph; laneCount?: number }) {
  const model = buildGitTreeRenderModel(graph, { laneCount });
  const nodeStyle = {
    left: `${model.node.leftPercent}%`,
    top: `${model.node.topPercent}%`,
    "--git-tree-color": model.node.color,
  } as CSSProperties;

  return (
    <div className="timeline-cell" aria-hidden="true">
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
      <span className={joinClass("graph-node", model.node.isMerge && "is-merge", graph.currentVariant === "dashed" && "is-dashed")} style={nodeStyle}>
        {model.node.isMerge ? <span className="graph-node-core" /> : null}
      </span>
    </div>
  );
}
