import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  buildGitTreeCanvasModel,
  type GitTreeCanvasLayout,
  type GitTreeCanvasLine,
  type GitTreeCanvasModel,
} from "../git-tree/graphCanvas";
import type { CommitItem, UiPreferences } from "../types";

type CommitGraphLayerStyle = CSSProperties & {
  "--commit-graph-layer-top": string;
  "--commit-graph-layer-width": string;
  "--commit-graph-layer-height": string;
};

function commitGraphLayerStyle(model: GitTreeCanvasModel): CommitGraphLayerStyle {
  return {
    "--commit-graph-layer-top": `${model.top}px`,
    "--commit-graph-layer-width": `${model.width}px`,
    "--commit-graph-layer-height": `${model.height}px`,
  } as CommitGraphLayerStyle;
}

function commitGraphNodeStyle(node: GitTreeCanvasModel["nodes"][number]) {
  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    "--git-tree-color": node.color,
  } satisfies CSSProperties & { "--git-tree-color": string };
}

function commitGraphLayoutsMatch(current: GitTreeCanvasLayout | null, next: GitTreeCanvasLayout) {
  if (!current || current.rows.length !== next.rows.length) return false;
  if (Math.abs(current.top - next.top) > 0.25) return false;

  return current.rows.every((row, index) => {
    const nextRow = next.rows[index];
    return row.id === nextRow.id && Math.abs(row.top - nextRow.top) <= 0.25 && Math.abs(row.bottom - nextRow.bottom) <= 0.25;
  });
}

function applyGraphStroke(
  context: CanvasRenderingContext2D,
  line: GitTreeCanvasLine,
  graphStyle: UiPreferences["graphStyle"],
) {
  const soft = graphStyle === "soft";
  const dashed = line.variant === "dashed";

  context.strokeStyle = line.color;
  context.lineWidth = line.kind === "bridge" ? (soft ? 1.8 : 2.4) : soft ? 1.8 : 2.5;
  context.lineJoin = "round";
  context.lineCap = line.kind === "bridge" || dashed ? "round" : "butt";
  context.globalAlpha = dashed ? (soft ? 0.42 : 0.78) : soft ? 0.5 : 1;
  context.setLineDash(dashed ? [4, 5] : []);
}

function drawGraphLine(
  context: CanvasRenderingContext2D,
  line: GitTreeCanvasLine,
  graphStyle: UiPreferences["graphStyle"],
) {
  context.save();
  applyGraphStroke(context, line, graphStyle);
  context.beginPath();

  if (line.kind === "vertical") {
    context.moveTo(line.x, line.fromY);
    context.lineTo(line.x, line.toY);
  } else {
    context.moveTo(line.fromX, line.fromY);
    context.bezierCurveTo(line.fromX, line.controlFromY, line.toX, line.controlToY, line.toX, line.joinY);
    if (line.toY > line.joinY) context.lineTo(line.toX, line.toY);
  }

  context.stroke();
  context.restore();
}

function paintGraphCanvas(
  canvas: HTMLCanvasElement,
  model: GitTreeCanvasModel,
  graphStyle: UiPreferences["graphStyle"],
) {
  const scale = Math.max(1, window.devicePixelRatio || 1);
  const canvasWidth = Math.max(1, Math.ceil(model.width * scale));
  const canvasHeight = Math.max(1, Math.ceil(model.height * scale));

  if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, model.width, model.height);
  model.lines.forEach((line) => drawGraphLine(context, line, graphStyle));
}

export function CommitGraphLayer({
  commits,
  startIndex,
  itemCount,
  selectedIndex,
  laneCount,
  graphStyle,
  nodeY,
}: {
  commits: readonly CommitItem[];
  startIndex: number;
  itemCount: number;
  selectedIndex: number;
  laneCount: number;
  graphStyle: UiPreferences["graphStyle"];
  nodeY: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rowLayout, setRowLayout] = useState<GitTreeCanvasLayout | null>(null);
  const model = useMemo(
    () => buildGitTreeCanvasModel({ commits, startIndex, itemCount, selectedIndex, laneCount, nodeY, rowLayout }),
    [commits, itemCount, laneCount, nodeY, rowLayout, selectedIndex, startIndex],
  );

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const list = layer?.parentElement;
    if (!list || !commits.length) return undefined;

    let frame = 0;
    const measureRows = () => {
      frame = 0;
      const rowElements = Array.from(list.querySelectorAll<HTMLElement>(".commit-row")).slice(0, commits.length);
      if (rowElements.length !== commits.length) return;

      const listRect = list.getBoundingClientRect();
      const listPaddingTop = Number.parseFloat(window.getComputedStyle(list).paddingTop) || 0;
      const measuredRows = rowElements.map((row, index) => {
        const rowRect = row.getBoundingClientRect();
        return {
          id: commits[index].id,
          top: rowRect.top - listRect.top,
          bottom: rowRect.bottom - listRect.top,
        };
      });
      const firstRowTop = Math.min(...measuredRows.map((row) => row.top));
      const nextLayout = {
        top: Math.max(0, firstRowTop - listPaddingTop),
        rows: measuredRows.map((row) => ({
          id: row.id,
          top: row.top - firstRowTop,
          bottom: row.bottom - firstRowTop,
        })),
      };

      setRowLayout((current) => (commitGraphLayoutsMatch(current, nextLayout) ? current : nextLayout));
    };
    const scheduleMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measureRows);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);

    measureRows();
    resizeObserver?.observe(list);
    Array.from(list.querySelectorAll<HTMLElement>(".commit-row")).forEach((row) => resizeObserver?.observe(row));

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [commits, nodeY, selectedIndex, startIndex]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintGraphCanvas(canvas, model, graphStyle);
  }, [graphStyle, model]);

  if (!commits.length || model.height <= 0) return null;

  return (
    <div className="commit-graph-layer" style={commitGraphLayerStyle(model)} ref={layerRef} aria-hidden="true">
      <canvas className="graph-canvas" ref={canvasRef} />
      <div className="graph-node-layer">
        {model.nodes.map((node) => (
          <span className={node.className} data-commit-id={node.id} style={commitGraphNodeStyle(node)} key={node.id}>
            {node.showCore ? <span className="graph-node-core" /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
