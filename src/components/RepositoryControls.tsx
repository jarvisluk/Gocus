import { useRef, useState } from "react";
import { Check, ChevronDown, GitBranch, GitFork } from "lucide-react";
import {
  closedRepositoryControlsMenus,
  repositoryBranchMenuItemView,
  repositoryBranchMenuView,
  repositoryBranchMenuChromeView,
  repositoryBranchTriggerView,
  repositoryControlsChromeView,
  repositoryControlsMenuState,
  repositoryRetainedBranchMenuItemView,
  type RepositoryControlIcon,
  repositoryViewChipView,
  repositoryWorktreeMenuChromeView,
  repositoryWorktreeMenuItemView,
  repositoryWorktreeMenuView,
  repositoryWorktreeSelection,
  repositoryWorktreeTriggerView,
} from "../lib/repositoryControlsView";
import { useDismissableLayer } from "../lib/useDismissableLayer";
import type { CommitViewSelection, GitSnapshot } from "../types";

function repositoryControlIcon(icon: RepositoryControlIcon) {
  if (icon === "check") return <Check aria-hidden="true" />;
  if (icon === "worktree") return <GitFork aria-hidden="true" />;
  return <GitBranch aria-hidden="true" />;
}

export function RepositoryControls({
  snapshot,
  view,
  onChangeView,
  onOpenWorktree,
}: {
  snapshot: GitSnapshot;
  view: CommitViewSelection;
  onChangeView: (view: CommitViewSelection) => void;
  onOpenWorktree: (worktreePath: string) => void;
}) {
  const [menuState, setMenuState] = useState(closedRepositoryControlsMenus);
  const branchControlRef = useRef<HTMLDivElement>(null);
  const worktreeControlRef = useRef<HTMLDivElement>(null);
  const { branchMenuOpen, worktreeMenuOpen } = menuState;
  const branchMenu = repositoryBranchMenuView({
    branches: snapshot.branches,
    currentBranchName: snapshot.branch.name,
    view,
  });
  const selectedBranchSummary = branchMenu.selectedBranchSummary;
  const controlsChrome = repositoryControlsChromeView();
  const allViewChip = repositoryViewChipView(view, "all");
  const currentViewChip = repositoryViewChipView(view, "current");
  const branchTrigger = repositoryBranchTriggerView(view, branchMenuOpen);
  const branchMenuChrome = repositoryBranchMenuChromeView();
  const retainedBranchItem = repositoryRetainedBranchMenuItemView(branchMenu.retainedSelectedBranch);
  const worktreeMenu = repositoryWorktreeMenuView(snapshot.worktrees);
  const worktreeTrigger = repositoryWorktreeTriggerView(worktreeMenuOpen, worktreeMenu.currentWorktree);
  const worktreeMenuChrome = repositoryWorktreeMenuChromeView();

  useDismissableLayer({
    active: branchMenuOpen || worktreeMenuOpen,
    refs: [branchControlRef, worktreeControlRef],
    onDismiss: () => setMenuState(closedRepositoryControlsMenus),
  });

  function changeView(mode: Exclude<CommitViewSelection["mode"], "branch">) {
    setMenuState(closedRepositoryControlsMenus);
    onChangeView({ mode });
  }

  function selectBranch(ref: string) {
    setMenuState((current) => repositoryControlsMenuState(current, "closeBranch"));
    onChangeView({ mode: "branch", ref });
  }

  function openWorktree(worktreePath: string) {
    const selection = repositoryWorktreeSelection(worktreePath, worktreeMenu.currentWorktree);
    setMenuState((current) => repositoryControlsMenuState(current, selection.menuAction));
    if (selection.openWorktreePath) onOpenWorktree(selection.openWorktreePath);
  }

  return (
    <section className={controlsChrome.section.className} aria-label={controlsChrome.section.ariaLabel}>
      <div
        className={controlsChrome.commitViewStrip.className}
        role={controlsChrome.commitViewStrip.role}
        aria-label={controlsChrome.commitViewStrip.ariaLabel}
      >
        <button
          className={allViewChip.className}
          type="button"
          aria-pressed={allViewChip.ariaPressed}
          onClick={() => changeView("all")}
        >
          {allViewChip.label}
        </button>
        <button
          className={currentViewChip.className}
          type="button"
          aria-pressed={currentViewChip.ariaPressed}
          onClick={() => changeView("current")}
        >
          {currentViewChip.label}
        </button>
        <div className={controlsChrome.branchControl.className} ref={branchControlRef}>
          <button
            id={branchTrigger.id}
            className={branchTrigger.className}
            type="button"
            aria-label={branchTrigger.ariaLabel}
            aria-pressed={branchTrigger.ariaPressed}
            aria-haspopup={branchTrigger.ariaHasPopup}
            aria-expanded={branchTrigger.ariaExpanded}
            aria-controls={branchTrigger.ariaControls}
            title={branchMenu.triggerTitle}
            onClick={() => setMenuState((current) => repositoryControlsMenuState(current, "toggleBranch"))}
            disabled={branchMenu.triggerDisabled}
          >
            {repositoryControlIcon(branchTrigger.icon)}
            <span>{branchTrigger.label}</span>
            <ChevronDown aria-hidden="true" />
          </button>
          {branchMenuOpen ? (
            <div
              className={branchMenuChrome.className}
              id={branchMenuChrome.id}
              role={branchMenuChrome.role}
              aria-labelledby={branchMenuChrome.ariaLabelledBy}
            >
              {branchMenu.retainedSelectedBranch ? (
                <button
                  className={retainedBranchItem.className}
                  type="button"
                  role={retainedBranchItem.role}
                  aria-current={retainedBranchItem.ariaCurrent}
                  onClick={() => selectBranch(branchMenu.retainedSelectedBranch)}
                >
                  {repositoryControlIcon(retainedBranchItem.icon)}
                  <span>{retainedBranchItem.label}</span>
                </button>
              ) : null}
              {branchMenu.branchItems.map(({ active, branch }) => {
                const itemView = repositoryBranchMenuItemView(active, branch);

                return (
                  <button
                    className={itemView.className}
                    type="button"
                    role={itemView.role}
                    aria-current={itemView.ariaCurrent}
                    title={itemView.title}
                    key={itemView.key}
                    onClick={() => selectBranch(branch.name)}
                  >
                    {repositoryControlIcon(itemView.icon)}
                    <span>{itemView.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {selectedBranchSummary.show ? (
        <div className={selectedBranchSummary.className} title={selectedBranchSummary.title} aria-label={selectedBranchSummary.ariaLabel}>
          {repositoryControlIcon(selectedBranchSummary.icon)}
          <span>{selectedBranchSummary.label}</span>
          <strong>{selectedBranchSummary.branchName}</strong>
        </div>
      ) : null}
      {worktreeMenu.showWorktreeControl ? (
        <div className={worktreeMenu.controlClassName} ref={worktreeControlRef}>
          <button
            id={worktreeTrigger.id}
            className={worktreeTrigger.className}
            type="button"
            aria-label={worktreeTrigger.ariaLabel}
            aria-haspopup={worktreeTrigger.ariaHasPopup}
            aria-expanded={worktreeTrigger.ariaExpanded}
            aria-controls={worktreeTrigger.ariaControls}
            title={worktreeTrigger.title}
            onClick={() => setMenuState((current) => repositoryControlsMenuState(current, "toggleWorktree"))}
          >
            {repositoryControlIcon(worktreeTrigger.icon)}
            <span>{worktreeTrigger.label}</span>
            <strong>{worktreeMenu.switchableWorktreeCount}</strong>
            <ChevronDown aria-hidden="true" />
          </button>
          {worktreeMenuOpen ? (
            <div
              className={worktreeMenuChrome.className}
              id={worktreeMenuChrome.id}
              role={worktreeMenuChrome.role}
              aria-labelledby={worktreeMenuChrome.ariaLabelledBy}
            >
              {worktreeMenu.worktreeItems.map(({ active, worktree }) => {
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
                    {repositoryControlIcon(itemView.icon)}
                    <span>{itemView.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
