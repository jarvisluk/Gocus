import { Check, ChevronDown, GitFork, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DropdownMenuHost } from "./DropdownMenuHost";
import {
  automaticWorktreeCleanupCandidates,
  automaticWorktreeCleanupPaths,
  isAutomaticWorktreeCleanupCandidate,
  repositoryControlsMenuState,
  repositoryWorktreeContextMenuChromeView,
  repositoryWorktreeContextTriggerView,
  repositoryWorktreeContextView,
  repositoryWorktreeMenuItemView,
  repositoryWorktreeSelection,
} from "../lib/repositoryControlsView";
import { useDismissableLayer } from "../lib/useDismissableLayer";
import type { GitWorktree } from "../types";

type WorktreeCleanupDialogState = {
  allCount: number;
  allPaths: string[];
  label: string;
  onePath: string;
  reason: string;
  showAll: boolean;
};

function worktreeMenuIcon(active: boolean) {
  if (active) return <Check aria-hidden="true" />;
  return <GitFork aria-hidden="true" />;
}

export function WorktreeContext({
  worktrees,
  onCleanupWorktrees,
  onOpenWorktree,
}: {
  worktrees: GitWorktree[];
  onCleanupWorktrees: (worktreePaths: string[]) => void;
  onOpenWorktree: (worktreePath: string) => void;
}) {
  const [worktreeMenuOpen, setWorktreeMenuOpen] = useState(false);
  const [cleanupDialog, setCleanupDialog] = useState<WorktreeCleanupDialogState | null>(null);
  const cleanupPanelRef = useRef<HTMLDivElement>(null);
  const worktreeContext = useMemo(() => repositoryWorktreeContextView(worktrees), [worktrees]);
  const worktreeTrigger = repositoryWorktreeContextTriggerView(worktreeMenuOpen, worktreeContext.currentWorktree);
  const worktreeMenuChrome = repositoryWorktreeContextMenuChromeView();

  useDismissableLayer({
    active: Boolean(cleanupDialog),
    dismissTiming: "afterTargetAction",
    refs: [cleanupPanelRef],
    onDismiss: () => setCleanupDialog(null),
  });

  function openWorktree(worktreePath: string) {
    const selection = repositoryWorktreeSelection(worktreePath, worktreeContext.currentWorktree);
    const nextMenuState = repositoryControlsMenuState({ branchMenuOpen: false, worktreeMenuOpen }, selection.menuAction);
    setWorktreeMenuOpen(nextMenuState.worktreeMenuOpen);
    if (selection.openWorktreePath) onOpenWorktree(selection.openWorktreePath);
  }

  function cleanupWorktree(worktree: GitWorktree, label: string) {
    const automaticCandidates = automaticWorktreeCleanupCandidates(worktrees);
    const allPaths = automaticWorktreeCleanupPaths(worktrees);
    const showAll = isAutomaticWorktreeCleanupCandidate(worktree) && automaticCandidates.length > 1;

    setWorktreeMenuOpen(false);
    setCleanupDialog({
      allCount: automaticCandidates.length,
      allPaths,
      label,
      onePath: worktree.path,
      reason: worktree.cleanup?.reason ?? "",
      showAll,
    });
  }

  function confirmCleanup(worktreePaths: string[]) {
    setCleanupDialog(null);
    onCleanupWorktrees(worktreePaths);
  }

  if (!worktreeContext.show) return null;

  return (
    <DropdownMenuHost
      active={worktreeMenuOpen}
      className={worktreeContext.className}
      onDismiss={() => setWorktreeMenuOpen(false)}
    >
      {worktreeContext.canSwitch ? (
        <>
          <button
            id={worktreeTrigger.id}
            className={worktreeTrigger.className}
            type="button"
            aria-label={worktreeTrigger.ariaLabel}
            aria-haspopup={worktreeTrigger.ariaHasPopup}
            aria-expanded={worktreeTrigger.ariaExpanded}
            aria-controls={worktreeTrigger.ariaControls}
            title={worktreeTrigger.title}
            onClick={() => setWorktreeMenuOpen((current) => !current)}
          >
            <GitFork aria-hidden="true" />
            <span className={worktreeContext.copyClassName}>
              <span>{worktreeContext.eyebrow}</span>
              <strong>{worktreeContext.label}</strong>
            </span>
            <span className={worktreeContext.badgeClassName}>{worktreeContext.countLabel}</span>
            <ChevronDown aria-hidden="true" />
          </button>
          {worktreeMenuOpen ? (
            <div
              className={worktreeMenuChrome.className}
              id={worktreeMenuChrome.id}
              role={worktreeMenuChrome.role}
              aria-labelledby={worktreeMenuChrome.ariaLabelledBy}
            >
              {worktreeContext.menu.worktreeItems.map(({ active, worktree }) => {
                const itemView = repositoryWorktreeMenuItemView(active, worktree);

                return (
                  <div className={itemView.rowClassName} role="none" key={itemView.key}>
                    <button
                      className={itemView.className}
                      type="button"
                      role={itemView.role}
                      aria-current={itemView.ariaCurrent}
                      title={itemView.title}
                      onClick={() => openWorktree(worktree.path)}
                    >
                      {worktreeMenuIcon(active)}
                      <span className="worktree-menu-copy">
                        <span>{itemView.label}</span>
                        {itemView.statusLabel ? <small>{itemView.statusLabel}</small> : null}
                      </span>
                    </button>
                    {itemView.cleanupAction.show ? (
                      <button
                        className={itemView.cleanupAction.className}
                        type="button"
                        aria-label={itemView.cleanupAction.ariaLabel}
                        title={itemView.cleanupAction.title}
                        disabled={itemView.cleanupAction.disabled}
                        onClick={() => cleanupWorktree(worktree, itemView.label)}
                      >
                        <Trash2 aria-hidden="true" />
                        <span>{itemView.cleanupAction.label}</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {cleanupDialog ? (
            <div
              className="ui-menu worktree-cleanup-panel"
              role="dialog"
              aria-modal="false"
              aria-labelledby="worktree-cleanup-title"
              ref={cleanupPanelRef}
            >
              <div className="worktree-cleanup-panel-copy">
                <strong className="worktree-cleanup-panel-title" id="worktree-cleanup-title">
                  {cleanupDialog.showAll ? "Clean auto-safe worktrees" : "Clean worktree"}
                </strong>
                <span>
                  {cleanupDialog.showAll
                    ? `Choose this worktree or all ${cleanupDialog.allCount} auto-safe worktrees.`
                    : "Remove this clean worktree."}
                </span>
              </div>
              <div className="worktree-cleanup-panel-target" title={cleanupDialog.onePath}>
                <span>This worktree</span>
                <strong>{cleanupDialog.label}</strong>
                {cleanupDialog.reason ? <span>{cleanupDialog.reason}</span> : null}
              </div>
              <div className={`ui-segmented worktree-cleanup-panel-actions${cleanupDialog.showAll ? "" : " compact"}`}>
                <button type="button" onClick={() => setCleanupDialog(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => confirmCleanup([cleanupDialog.onePath])}
                >
                  Clean this
                </button>
                {cleanupDialog.showAll ? (
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => confirmCleanup(cleanupDialog.allPaths)}
                  >
                    Clean all {cleanupDialog.allCount}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div
          className={worktreeContext.staticClassName}
          title={worktreeContext.title}
          aria-label={worktreeContext.ariaLabel}
        >
          <GitFork aria-hidden="true" />
          <span className={worktreeContext.copyClassName}>
            <span>{worktreeContext.eyebrow}</span>
            <strong>{worktreeContext.label}</strong>
          </span>
          <span className={worktreeContext.badgeClassName}>{worktreeContext.countLabel}</span>
        </div>
      )}
    </DropdownMenuHost>
  );
}
