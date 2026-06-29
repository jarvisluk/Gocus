import { FileCode2, GitBranch, GitFork, GitMerge } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  getGitTreeRailWidth,
  getGitTreeRequiredLaneCount,
} from "../git-tree/renderGraph";
import { commitRowView, type CommitRowAction, type CommitRowActionIcon } from "../lib/commitRowView";
import type { CommitInfoAnchorBounds, CommitItem } from "../types";

function commitActionIcon(icon: CommitRowActionIcon) {
  if (icon === "branch") return <GitFork aria-hidden="true" />;
  if (icon === "merge") return <GitMerge aria-hidden="true" />;
  return <GitBranch aria-hidden="true" />;
}

export function CommitRow({
  commit,
  selected,
  expandSelectedMessage,
  onSelect,
  onAction,
  onPreview,
  onDismissPreview,
}: {
  commit: CommitItem;
  selected: boolean;
  expandSelectedMessage?: boolean;
  onSelect: () => void;
  onAction: (action: CommitRowAction, commit: CommitItem) => void;
  onPreview: (commit: CommitItem, anchorBounds: CommitInfoAnchorBounds) => void;
  onDismissPreview: () => void;
}) {
  const rowRef = useRef<HTMLElement>(null);
  const previewFrameRef = useRef<number | null>(null);
  const view = commitRowView(commit, selected, expandSelectedMessage);
  const rowStyle = {
    "--git-tree-rail-width": `${getGitTreeRailWidth(getGitTreeRequiredLaneCount(commit.graph))}px`,
  } as CSSProperties & { "--git-tree-rail-width": string };
  const refStyle = {
    "--branch-color": view.refColor,
  } as CSSProperties;

  function anchorBounds(): CommitInfoAnchorBounds {
    const rect = rowRef.current?.getBoundingClientRect();
    return {
      top: rect?.top ?? 0,
      height: rect?.height ?? 0,
    };
  }

  function cancelScheduledPreview() {
    if (previewFrameRef.current === null) return;
    window.cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = null;
  }

  function schedulePreviewAfterSelection() {
    cancelScheduledPreview();
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onPreview(commit, anchorBounds());
    });
  }

  function previewIfSelected() {
    if (!selected) {
      cancelScheduledPreview();
      onDismissPreview();
      return;
    }

    cancelScheduledPreview();
    onPreview(commit, anchorBounds());
  }

  function selectCommit() {
    onSelect();
    if (selected) {
      cancelScheduledPreview();
      onDismissPreview();
      return;
    }

    schedulePreviewAfterSelection();
  }

  useEffect(() => () => cancelScheduledPreview(), []);

  return (
    <article
      ref={rowRef}
      className={view.className}
      data-commit-id={commit.id}
      style={rowStyle}
      onFocus={previewIfSelected}
      onPointerEnter={previewIfSelected}
    >
      <span className="timeline-cell" aria-hidden="true" />
      <div className={view.contentClassName}>
        <button className={view.selectButton.className} type="button" aria-pressed={view.selectButton.ariaPressed} onClick={selectCommit}>
          <span className={view.titleLineClassName}>
            <span className={view.titleTextClassName}>{view.displayMessage}</span>
            {view.showRef ? (
              <span className={view.refPillClassName} style={refStyle}>
                {view.ref}
              </span>
            ) : null}
          </span>
          <span className={view.metaClassName}>
            <code>{commit.hash}</code>
            <span>{commit.relativeTime}</span>
            {view.showAuthor ? <span>{commit.author}</span> : null}
            {view.isMerge ? (
              <span className={view.mergeIndicator.className} title={view.mergeIndicator.title}>
                <GitMerge aria-hidden="true" />
                merge
              </span>
            ) : null}
          </span>
          <span className={view.stats.className}>
            <span className={view.stats.additionsClassName}>+{commit.additions}</span>
            <span className={view.stats.deletionsClassName}>-{commit.deletions}</span>
            <span className={view.stats.filesClassName}>
              <FileCode2 aria-hidden="true" />
              {commit.filesChanged}
            </span>
          </span>
        </button>
        {view.showActions ? (
          <div className={view.actionsClassName}>
            <button
              type="button"
              onClick={() => onAction(view.branchAction.action, commit)}
              disabled={view.branchAction.disabled}
              title={view.branchAction.title}
            >
              {commitActionIcon(view.branchAction.icon)}
              {view.branchAction.label}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!view.mergeAction.disabled) onAction(view.mergeAction.action, commit);
              }}
              disabled={view.mergeAction.disabled}
              title={view.mergeAction.title}
            >
              {commitActionIcon(view.mergeAction.icon)}
              {view.mergeAction.label}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!view.checkoutAction.disabled) onAction(view.checkoutAction.action, commit);
              }}
              disabled={view.checkoutAction.disabled}
              title={view.checkoutAction.title}
            >
              {commitActionIcon(view.checkoutAction.icon)}
              {view.checkoutAction.label}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
