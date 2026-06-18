import { useState } from "react";
import { ArrowRightLeft, Check, ChevronDown, GitBranch, GitFork } from "lucide-react";
import { DropdownMenuHost } from "./DropdownMenuHost";
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
} from "../lib/repositoryControlsView";
import type { CommitViewSelection, GitSnapshot } from "../types";

function repositoryControlIcon(icon: RepositoryControlIcon) {
  if (icon === "check") return <Check aria-hidden="true" />;
  if (icon === "switch") return <ArrowRightLeft aria-hidden="true" />;
  if (icon === "worktree") return <GitFork aria-hidden="true" />;
  return <GitBranch aria-hidden="true" />;
}

export function RepositoryControls({
  snapshot,
  view,
  onChangeView,
  onSwitchBranch,
}: {
  snapshot: GitSnapshot;
  view: CommitViewSelection;
  onChangeView: (view: CommitViewSelection) => void;
  onSwitchBranch: (branchName: string) => void;
}) {
  const [menuState, setMenuState] = useState(closedRepositoryControlsMenus);
  const { branchMenuOpen } = menuState;
  const branchMenu = repositoryBranchMenuView({
    branches: snapshot.branches,
    currentBranchName: snapshot.branch.name,
    view,
    worktrees: snapshot.worktrees,
  });
  const selectedBranchSummary = branchMenu.selectedBranchSummary;
  const controlsChrome = repositoryControlsChromeView();
  const allViewChip = repositoryViewChipView(view, "all");
  const currentViewChip = repositoryViewChipView(view, "current");
  const branchTrigger = repositoryBranchTriggerView(view, branchMenuOpen);
  const branchMenuChrome = repositoryBranchMenuChromeView();
  const retainedBranchItem = repositoryRetainedBranchMenuItemView(branchMenu.retainedSelectedBranch);

  function changeView(mode: Exclude<CommitViewSelection["mode"], "branch">) {
    setMenuState(closedRepositoryControlsMenus);
    onChangeView({ mode });
  }

  function selectBranch(ref: string) {
    setMenuState((current) => repositoryControlsMenuState(current, "closeBranch"));
    onChangeView({ mode: "branch", ref });
  }

  function switchBranch(branchName: string) {
    setMenuState((current) => repositoryControlsMenuState(current, "closeBranch"));
    onSwitchBranch(branchName);
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
        <DropdownMenuHost
          active={branchMenuOpen}
          className={controlsChrome.branchControl.className}
          onDismiss={() => setMenuState(closedRepositoryControlsMenus)}
        >
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
              {branchMenu.branchItems.map(({ active, branch, switchAction }) => {
                const itemView = repositoryBranchMenuItemView(active, branch, switchAction);

                return (
                  <div className={itemView.rowClassName} role="none" key={itemView.key}>
                    <button
                      className={itemView.className}
                      type="button"
                      role={itemView.role}
                      aria-current={itemView.ariaCurrent}
                      title={itemView.title}
                      onClick={() => selectBranch(branch.name)}
                    >
                      {repositoryControlIcon(itemView.icon)}
                      <span>{itemView.label}</span>
                    </button>
                    {itemView.switchAction.show ? (
                      <span className={itemView.switchAction.tooltipClassName} title={itemView.switchAction.title}>
                        <button
                          className={itemView.switchAction.className}
                          type="button"
                          role="menuitem"
                          aria-label={itemView.switchAction.ariaLabel}
                          title={itemView.switchAction.title}
                          disabled={itemView.switchAction.disabled}
                          onClick={() => switchBranch(itemView.switchAction.branchName)}
                        >
                          {repositoryControlIcon(itemView.switchAction.icon)}
                        </button>
                        {itemView.switchAction.disabled ? (
                          <span className="branch-switch-tooltip-bubble" role="tooltip" aria-hidden="true">
                            <strong>Checked out elsewhere</strong>
                            <span>Open that worktree before switching.</span>
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </DropdownMenuHost>
      </div>
      {selectedBranchSummary.show ? (
        <div className={selectedBranchSummary.className} title={selectedBranchSummary.title} aria-label={selectedBranchSummary.ariaLabel}>
          {repositoryControlIcon(selectedBranchSummary.icon)}
          <span>{selectedBranchSummary.label}</span>
          <strong>{selectedBranchSummary.branchName}</strong>
        </div>
      ) : null}
    </section>
  );
}
