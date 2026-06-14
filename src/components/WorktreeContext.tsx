import { Check, ChevronDown, GitFork, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  repositoryControlsMenuState,
  repositoryWorktreeContextMenuChromeView,
  repositoryWorktreeContextTriggerView,
  repositoryWorktreeContextView,
  repositoryWorktreeMenuItemView,
  repositoryWorktreeSelection,
} from "../lib/repositoryControlsView";
import { useDismissableLayer } from "../lib/useDismissableLayer";
import type { GitWorktree } from "../types";

function worktreeMenuIcon(active: boolean) {
  if (active) return <Check aria-hidden="true" />;
  return <GitFork aria-hidden="true" />;
}

export function WorktreeContext({
  worktrees,
  onCleanupWorktree,
  onOpenWorktree,
}: {
  worktrees: GitWorktree[];
  onCleanupWorktree: (worktreePath: string) => void;
  onOpenWorktree: (worktreePath: string) => void;
}) {
  const [worktreeMenuOpen, setWorktreeMenuOpen] = useState(false);
  const worktreeControlRef = useRef<HTMLDivElement>(null);
  const worktreeContext = useMemo(() => repositoryWorktreeContextView(worktrees), [worktrees]);
  const worktreeTrigger = repositoryWorktreeContextTriggerView(worktreeMenuOpen, worktreeContext.currentWorktree);
  const worktreeMenuChrome = repositoryWorktreeContextMenuChromeView();

  useDismissableLayer({
    active: worktreeMenuOpen,
    refs: [worktreeControlRef],
    onDismiss: () => setWorktreeMenuOpen(false),
  });

  function openWorktree(worktreePath: string) {
    const selection = repositoryWorktreeSelection(worktreePath, worktreeContext.currentWorktree);
    const nextMenuState = repositoryControlsMenuState({ branchMenuOpen: false, worktreeMenuOpen }, selection.menuAction);
    setWorktreeMenuOpen(nextMenuState.worktreeMenuOpen);
    if (selection.openWorktreePath) onOpenWorktree(selection.openWorktreePath);
  }

  function cleanupWorktree(worktreePath: string, label: string) {
    const confirmed = window.confirm(`Clean up ${label}?\n\n${worktreePath}`);
    if (!confirmed) return;

    setWorktreeMenuOpen(false);
    onCleanupWorktree(worktreePath);
  }

  if (!worktreeContext.show) return null;

  return (
    <div className={worktreeContext.className} ref={worktreeControlRef}>
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
                        onClick={() => cleanupWorktree(worktree.path, itemView.label)}
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
    </div>
  );
}
