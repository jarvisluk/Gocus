import type { CSSProperties } from "react";
import type { CommitGraph } from "../types";
import { gitTreeCellView } from "./gitTreeCellView";
import { buildGitTreeRenderModel } from "./renderGraph";

export function GitTreeCell({ graph, laneCount }: { graph: CommitGraph; laneCount?: number }) {
  const model = buildGitTreeRenderModel(graph, { laneCount });
  const view = gitTreeCellView(model);

  return (
    <div className={view.container.className} aria-hidden={view.container.ariaHidden}>
      {view.svgSegments.map((svg) => (
        <svg className={svg.className} viewBox={svg.viewBox} preserveAspectRatio={svg.preserveAspectRatio} key={svg.key}>
          {view.paths.map((path) => (
            <path
              className={path.className}
              d={path.d}
              key={path.id}
              style={path.style as CSSProperties}
              vectorEffect={path.vectorEffect}
            />
          ))}
        </svg>
      ))}
      <span className={view.node.className} style={view.node.style as CSSProperties}>
        {view.node.showCore ? <span className={view.node.coreClassName} /> : null}
      </span>
    </div>
  );
}
