import type { GitSnapshot, RecentRepository } from "../types";
import { joinClass } from "./classNames";
import { recentRepositoryLabel } from "./pathLabels";
import { isSameRecentRepository, recentRepositoriesWithCurrent, recentRepositoryFromSnapshot } from "./recentRepositories";

export type PanelHeaderActionIcon = "pin" | "pin-off" | "refresh" | "collapse";
export type PanelHeaderBranchPillIcon = "branch";

export interface PanelRepositorySelection {
  menuOpen: boolean;
  switchRepositoryPath: string;
}

const repositoryTriggerId = "repo-switch-trigger";
const repositoryMenuId = "repo-switch-menu";

export function repositoryOptionActive(repository: RecentRepository, currentRepository: RecentRepository | null) {
  return currentRepository ? isSameRecentRepository(repository, currentRepository) : false;
}

export function panelHeaderFunctionMenuButtonView(open: boolean) {
  return {
    label: open ? "Close function menu" : "Open function menu",
    active: open,
  };
}

export function panelRepositoryMenuView() {
  return {
    className: "ui-menu repo-switch-menu",
    id: repositoryMenuId,
    role: "menu" as const,
    ariaLabelledBy: repositoryTriggerId,
  };
}

export function panelRepositoryMenuItemView(
  repository: RecentRepository,
  currentRepository: RecentRepository | null,
  confirmRemove = false,
) {
  const active = repositoryOptionActive(repository, currentRepository);
  const label = recentRepositoryLabel(repository);

  return {
    active,
    rowClassName: joinClass("repo-menu-row", !active && "has-remove"),
    className: joinClass("ui-menu-item", "repo-menu-item", active && "is-active"),
    role: "menuitem" as const,
    ariaCurrent: active ? ("true" as const) : undefined,
    showCheck: active,
    checkClassName: "repo-menu-check",
    textClassName: "repo-menu-text",
    showRemove: !active,
    removeClassName: joinClass("repo-menu-remove", confirmRemove && "is-confirming"),
    removeAriaLabel: confirmRemove ? `Confirm remove ${label} from recent workspaces` : `Remove ${label} from recent workspaces`,
    removeTitle: confirmRemove ? "Click again to remove" : "Remove from recent workspaces",
    confirmRemove,
    repository,
    key: repository.path,
    path: repository.path,
    title: repository.path,
    label,
  };
}

export function shouldSwitchRepository(snapshot: GitSnapshot | null, repositoryPath: string) {
  return Boolean(snapshot && repositoryPath !== snapshot.repoPath);
}

export function panelRepositoryMenuOpenAfterToggle(repoMenuOpen: boolean, canSwitchRepository: boolean) {
  return canSwitchRepository ? !repoMenuOpen : repoMenuOpen;
}

export function panelRepositoryMenuOpenAfterSelection() {
  return false;
}

export function panelRepositorySelection(snapshot: GitSnapshot | null, repositoryPath: string): PanelRepositorySelection {
  return {
    menuOpen: panelRepositoryMenuOpenAfterSelection(),
    switchRepositoryPath: shouldSwitchRepository(snapshot, repositoryPath) ? repositoryPath : "",
  };
}

export function panelPinnedStateAfterToggle(pinned: boolean) {
  return !pinned;
}

export function panelPinnedNotice(pinned: boolean) {
  return pinned ? "Panel pinned above other windows." : "Panel unpinned.";
}

export function panelRepositoryTriggerView({
  canSwitchRepository,
  repoMenuOpen,
}: {
  canSwitchRepository: boolean;
  repoMenuOpen: boolean;
}) {
  return {
    id: repositoryTriggerId,
    className: joinClass("repo-title", canSwitchRepository && "repo-title-button", repoMenuOpen && "is-open"),
    disabled: !canSwitchRepository,
    ariaLabel: "Switch recent repository",
    ariaHasPopup: "menu" as const,
    ariaExpanded: repoMenuOpen,
    ariaControls: repositoryMenuId,
  };
}

export function panelHeaderActionsView({
  pinned,
  refreshing,
  hasRepository,
}: {
  pinned: boolean;
  refreshing: boolean;
  hasRepository: boolean;
}) {
  return {
    className: "header-actions",
    pinButton: {
      label: pinned ? "Unpin floating panel" : "Pin floating panel",
      active: pinned,
      icon: pinned ? ("pin-off" as PanelHeaderActionIcon) : ("pin" as PanelHeaderActionIcon),
    },
    refreshButton: {
      label: refreshing ? "Refreshing Git status" : "Refresh Git status",
      busy: refreshing,
      disabled: !hasRepository || refreshing,
      icon: "refresh" as PanelHeaderActionIcon,
      iconClassName: refreshing ? "is-spinning" : "",
    },
    collapseButton: {
      label: "Collapse side peek",
      icon: "collapse" as PanelHeaderActionIcon,
    },
  };
}

export function branchPillTitle(snapshot: GitSnapshot) {
  return snapshot.branch.upstream || snapshot.branch.name;
}

export function panelHeaderBranchPillView(snapshot: GitSnapshot | null) {
  if (!snapshot) return null;

  return {
    className: "branch-pill",
    icon: "branch" as PanelHeaderBranchPillIcon,
    label: snapshot.branch.name,
    title: branchPillTitle(snapshot),
  };
}

export function panelHeaderView(snapshot: GitSnapshot | null, recentRepositories: readonly RecentRepository[]) {
  const currentRepository = snapshot ? recentRepositoryFromSnapshot(snapshot) : null;
  const recentRepositoryOptions = recentRepositoriesWithCurrent(snapshot, [...recentRepositories]);

  return {
    header: {
      className: "peek-header",
    },
    repoSwitcher: {
      className: "header-repo-switcher",
    },
    repositoryTitleCopy: {
      className: "repo-title-copy",
    },
    staticRepositoryTitle: {
      className: "repo-title",
    },
    branchPill: panelHeaderBranchPillView(snapshot),
    currentRepository,
    recentRepositoryOptions,
    canSwitchRepository: Boolean(snapshot && recentRepositoryOptions.length > 1),
    repositoryTitle: currentRepository?.name || "Gocus",
    repositoryPathLabel: snapshot?.repoPath || "No working folder",
  };
}
