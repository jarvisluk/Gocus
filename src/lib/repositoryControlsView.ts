import { joinClass } from "./classNames";
import type { CommitViewSelection, GitBranchRef, GitWorktree } from "../types";
import { branchOptionLabel, worktreeChipLabel, worktreeMenuLabel } from "./repositoryControlLabels";

export type RepositoryControlIcon = "branch" | "check" | "worktree";

export type RepositoryControlsMenuState = {
  branchMenuOpen: boolean;
  worktreeMenuOpen: boolean;
};

export type RepositoryControlsMenuAction = "toggleBranch" | "toggleWorktree" | "closeAll" | "closeBranch" | "closeWorktree";

export interface RepositoryWorktreeSelection {
  menuAction: RepositoryControlsMenuAction;
  openWorktreePath: string;
}

const branchTriggerId = "branch-ref-trigger";
const branchMenuId = "branch-ref-menu";
const worktreeTriggerId = "worktree-trigger";
const worktreeMenuId = "worktree-menu";

export const closedRepositoryControlsMenus: RepositoryControlsMenuState = {
  branchMenuOpen: false,
  worktreeMenuOpen: false,
};

export function repositoryControlsMenuState(
  current: RepositoryControlsMenuState,
  action: RepositoryControlsMenuAction,
): RepositoryControlsMenuState {
  if (action === "toggleBranch") {
    return {
      branchMenuOpen: !current.branchMenuOpen,
      worktreeMenuOpen: false,
    };
  }

  if (action === "toggleWorktree") {
    return {
      branchMenuOpen: false,
      worktreeMenuOpen: !current.worktreeMenuOpen,
    };
  }

  if (action === "closeBranch") {
    return {
      ...current,
      branchMenuOpen: false,
    };
  }

  if (action === "closeWorktree") {
    return {
      ...current,
      worktreeMenuOpen: false,
    };
  }

  return closedRepositoryControlsMenus;
}

export function selectedBranchName(view: CommitViewSelection) {
  return view.mode === "branch" ? view.ref ?? "" : "";
}

export function selectedBranchAvailable(selectedBranch: string, branches: readonly GitBranchRef[]) {
  return selectedBranch ? branches.some((branch) => branch.name === selectedBranch) : true;
}

export function repositoryViewChipView(view: CommitViewSelection, mode: Exclude<CommitViewSelection["mode"], "branch">) {
  const active = view.mode === mode;

  return {
    active,
    ariaPressed: active,
    className: joinClass("view-chip", active && "is-active"),
    label: mode === "all" ? "All" : "Current",
  };
}

export function repositoryControlsChromeView() {
  return {
    section: {
      className: "repo-controls",
      ariaLabel: "Repository view controls",
    },
    commitViewStrip: {
      className: "commit-view-strip",
      role: "group" as const,
      ariaLabel: "Commit view",
    },
    branchControl: {
      className: "branch-menu-control",
    },
  };
}

export function repositoryBranchTriggerView(view: CommitViewSelection, branchMenuOpen: boolean) {
  return {
    id: branchTriggerId,
    className: joinClass("view-chip", "branch-view-trigger", view.mode === "branch" && "is-active", branchMenuOpen && "is-open"),
    icon: "branch" as const,
    label: "Branch",
    ariaPressed: view.mode === "branch",
    ariaLabel: "Choose branch view",
    ariaHasPopup: "menu" as const,
    ariaExpanded: branchMenuOpen,
    ariaControls: branchMenuId,
  };
}

export function repositoryBranchMenuChromeView() {
  return {
    className: "ui-menu branch-ref-menu",
    id: branchMenuId,
    role: "menu" as const,
    ariaLabelledBy: branchTriggerId,
  };
}

export function repositoryRetainedBranchMenuItemView(branchName: string) {
  return {
    className: "ui-menu-item branch-ref-menu-item is-active",
    role: "menuitem" as const,
    ariaCurrent: "true" as const,
    icon: "check" as const,
    label: branchName,
  };
}

export function repositoryBranchMenuItemView(active: boolean, branch: GitBranchRef) {
  return {
    className: joinClass("ui-menu-item", "branch-ref-menu-item", active && "is-active"),
    role: "menuitem" as const,
    ariaCurrent: active ? ("true" as const) : undefined,
    icon: active ? ("check" as const) : ("branch" as const),
    label: branchOptionLabel(branch),
    title: branch.fullName,
    key: `${branch.type}-${branch.name}`,
  };
}

export function repositorySelectedBranchSummaryView(selectedBranch: string) {
  const show = Boolean(selectedBranch);
  const title = show ? `Viewing branch ${selectedBranch}` : "";

  return {
    show,
    className: "selected-branch-view",
    icon: "branch" as const,
    label: "Viewing",
    branchName: selectedBranch,
    title,
    ariaLabel: title || undefined,
  };
}

export function repositoryBranchMenuView({
  branches,
  currentBranchName,
  view,
}: {
  branches: readonly GitBranchRef[];
  currentBranchName: string;
  view: CommitViewSelection;
}) {
  const selectedBranch = selectedBranchName(view);
  const selectedBranchIsAvailable = selectedBranchAvailable(selectedBranch, branches);
  const selectedBranchSummary = repositorySelectedBranchSummaryView(view.mode === "branch" ? selectedBranch : "");

  return {
    selectedBranch,
    selectedBranchIsAvailable,
    triggerDisabled: branches.length === 0 && !selectedBranch,
    triggerTitle: selectedBranch || currentBranchName,
    retainedSelectedBranch: selectedBranch && !selectedBranchIsAvailable ? selectedBranch : "",
    showSelectedBranchSummary: selectedBranchSummary.show,
    selectedBranchSummary,
    branchItems: branches.map((branch) => ({
      branch,
      active: view.mode === "branch" && branch.name === selectedBranch,
    })),
  };
}

export function switchableWorktreeList(worktrees: readonly GitWorktree[]) {
  return worktrees.filter((worktree) => !worktree.bare);
}

export function currentSwitchableWorktree(worktrees: readonly GitWorktree[]) {
  return worktrees.find((worktree) => worktree.current) ?? worktrees[0];
}

export function repositoryWorktreeMenuView(worktrees: readonly GitWorktree[]) {
  const switchableWorktrees = switchableWorktreeList(worktrees);
  const currentWorktree = currentSwitchableWorktree(switchableWorktrees);

  return {
    controlClassName: "worktree-compact",
    switchableWorktrees,
    switchableWorktreeCount: switchableWorktrees.length,
    currentWorktree,
    showWorktreeControl: switchableWorktrees.length > 1,
    worktreeItems: switchableWorktrees.map((worktree) => ({
      worktree,
      active: worktree.path === currentWorktree?.path,
    })),
  };
}

export function repositoryWorktreeTriggerView(worktreeMenuOpen: boolean, currentWorktree: GitWorktree | undefined) {
  return {
    id: worktreeTriggerId,
    className: joinClass("worktree-trigger", worktreeMenuOpen && "is-open"),
    icon: "worktree" as const,
    ariaLabel: "Choose worktree",
    ariaHasPopup: "menu" as const,
    ariaExpanded: worktreeMenuOpen,
    ariaControls: worktreeMenuId,
    label: worktreeChipLabel(currentWorktree),
    title: currentWorktree?.path,
  };
}

export function repositoryWorktreeMenuChromeView() {
  return {
    className: "ui-menu worktree-menu",
    id: worktreeMenuId,
    role: "menu" as const,
    ariaLabelledBy: worktreeTriggerId,
  };
}

export function repositoryWorktreeMenuItemView(active: boolean, worktree: GitWorktree) {
  return {
    className: joinClass("ui-menu-item", "worktree-menu-item", active && "is-active"),
    role: "menuitem" as const,
    ariaCurrent: active ? ("true" as const) : undefined,
    icon: active ? ("check" as const) : ("worktree" as const),
    label: worktreeMenuLabel(worktree),
    title: worktree.path,
    key: worktree.path,
  };
}

export function repositoryWorktreeSelection(worktreePath: string, currentWorktree: GitWorktree | undefined): RepositoryWorktreeSelection {
  return {
    menuAction: "closeWorktree",
    openWorktreePath: worktreePath === currentWorktree?.path ? "" : worktreePath,
  };
}

export function repositoryControlsView({
  branches,
  view,
  worktrees,
}: {
  branches: readonly GitBranchRef[];
  view: CommitViewSelection;
  worktrees: readonly GitWorktree[];
}) {
  const selectedBranch = selectedBranchName(view);
  const worktreeMenu = repositoryWorktreeMenuView(worktrees);

  return {
    selectedBranch,
    selectedBranchIsAvailable: selectedBranchAvailable(selectedBranch, branches),
    switchableWorktrees: worktreeMenu.switchableWorktrees,
    currentWorktree: worktreeMenu.currentWorktree,
  };
}
