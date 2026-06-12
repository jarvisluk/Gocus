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
const repositoryPathTooltipId = "repo-title-path-tooltip";

export function repositoryOptionActive(repository: RecentRepository, currentRepository: RecentRepository | null) {
  return currentRepository ? isSameRecentRepository(repository, currentRepository) : false;
}

export function panelHeaderOpenRepositoryButtonView() {
  return {
    label: "Open repository",
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

export function panelRepositoryMenuItemView(repository: RecentRepository, currentRepository: RecentRepository | null) {
  const active = repositoryOptionActive(repository, currentRepository);

  return {
    active,
    className: joinClass("ui-menu-item", "repo-menu-item", active && "is-active"),
    role: "menuitem" as const,
    ariaCurrent: active ? ("true" as const) : undefined,
    showCheck: active,
    checkClassName: "repo-menu-check",
    textClassName: "repo-menu-text",
    key: repository.path,
    path: repository.path,
    title: repository.path,
    label: recentRepositoryLabel(repository),
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
  repositoryPath,
}: {
  canSwitchRepository: boolean;
  repoMenuOpen: boolean;
  repositoryPath: string;
}) {
  return {
    id: repositoryTriggerId,
    className: joinClass("repo-title", canSwitchRepository && "repo-title-button", repoMenuOpen && "is-open"),
    disabled: !canSwitchRepository,
    ariaLabel: "Switch recent repository",
    ariaHasPopup: "menu" as const,
    ariaExpanded: repoMenuOpen,
    ariaControls: repositoryMenuId,
    ariaDescribedBy: repositoryPath ? repositoryPathTooltipId : undefined,
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
  const repositoryPath = snapshot?.repoPath || "";

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
    repositoryTitle: currentRepository?.name || "Git Peek",
    repositoryPathLabel: repositoryPath || "No working folder",
    repositoryPathTooltip: repositoryPath
      ? {
          id: repositoryPathTooltipId,
          className: "repo-title-tooltip",
          text: repositoryPath,
        }
      : null,
  };
}
