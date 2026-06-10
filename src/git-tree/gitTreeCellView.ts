import type { GitTreeRenderModel, GitTreePath } from "./renderGraph";

type GitTreeStyle = {
  "--git-tree-color": string;
  left?: string;
  top?: string;
};

export function gitTreeSvgSegments(model: GitTreeRenderModel) {
  const topHeight = model.node.y;
  const bottomHeight = model.height - model.node.y;

  return [
    {
      key: "top",
      className: "graph-svg graph-svg-top",
      viewBox: `0 0 ${model.width} ${topHeight}`,
      preserveAspectRatio: "none",
    },
    {
      key: "bottom",
      className: "graph-svg graph-svg-bottom",
      viewBox: `0 ${model.node.y} ${model.width} ${bottomHeight}`,
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
    top: `var(--git-tree-node-y, ${model.node.topPercent}%)`,
    "--git-tree-color": model.node.color,
  } satisfies GitTreeStyle;
}

export function gitTreeCellView(model: GitTreeRenderModel) {
  return {
    container: {
      className: "timeline-cell",
      ariaHidden: true,
    },
    svgSegments: gitTreeSvgSegments(model),
    paths: model.paths.map((path) => ({
      ...path,
      style: gitTreePathStyle(path),
      vectorEffect: "non-scaling-stroke" as const,
    })),
    node: {
      className: model.node.className,
      style: gitTreeNodeStyle(model),
      showCore: model.node.showCore,
      coreClassName: "graph-node-core",
    },
  };
}
