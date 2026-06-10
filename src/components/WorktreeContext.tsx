import { Check, ChevronDown, GitFork } from "lucide-react";
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
  onOpenWorktree,
}: {
  worktrees: GitWorktree[];
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
              <code>{worktreeContext.path}</code>
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
                  <button
                    className={itemView.className}
                    type="button"
                    role={itemView.role}
                    aria-current={itemView.ariaCurrent}
                    title={itemView.title}
                    key={itemView.key}
                    onClick={() => openWorktree(worktree.path)}
                  >
                    {worktreeMenuIcon(active)}
                    <span>{itemView.label}</span>
                  </button>
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
            <code>{worktreeContext.path}</code>
          </span>
          <span className={worktreeContext.badgeClassName}>{worktreeContext.countLabel}</span>
        </div>
      )}
    </div>
  );
}
