import type { GitTreePath, GitTreePathSegment, GitTreeRenderModel } from "./renderGraph";

type GitTreeStyle = {
  "--git-tree-color": string;
  left?: string;
  top?: string;
};

export function gitTreeSvgSegments(model: GitTreeRenderModel) {
  return [
    {
      key: "top",
      segment: "top" as const,
      className: "graph-svg graph-svg-top",
      viewBox: `0 0 ${model.width} 1`,
      preserveAspectRatio: "none",
    },
    {
      key: "bridge",
      segment: "bridge" as const,
      className: "graph-svg graph-svg-bridge",
      viewBox: `0 0 ${model.width} ${model.bridgeHeight}`,
      preserveAspectRatio: "none",
    },
    {
      key: "tail",
      segment: "tail" as const,
      className: "graph-svg graph-svg-tail",
      viewBox: `0 0 ${model.width} 1`,
      preserveAspectRatio: "none",
    },
  ];
}

export function gitTreePathStyle(path: Pick<GitTreePath, "color">) {
  return {
    "--git-tree-color": path.color,
  } satisfies GitTreeStyle;
}

export function gitTreeNodeStyle(model: GitTreeRenderModel) {
  return {
    left: `${model.node.leftPercent}%`,
    top: "var(--git-tree-node-y, 22px)",
    "--git-tree-color": model.node.color,
  } satisfies GitTreeStyle;
}

function gitTreePathsForSegment(paths: GitTreePath[], segment: GitTreePathSegment) {
  return paths
    .filter((path) => path.segment === segment)
    .map((path) => ({
      ...path,
      style: gitTreePathStyle(path),
      vectorEffect: "non-scaling-stroke" as const,
    }));
}

export function gitTreeCellView(model: GitTreeRenderModel) {
  const svgSegments = gitTreeSvgSegments(model);

  return {
    container: {
      className: "timeline-cell",
      ariaHidden: true,
    },
    svgSegments: svgSegments.map((svg) => ({
      ...svg,
      paths: gitTreePathsForSegment(model.paths, svg.segment),
    })),
    node: {
      className: model.node.className,
      style: gitTreeNodeStyle(model),
      showCore: model.node.showCore,
      coreClassName: "graph-node-core",
    },
  };
}
