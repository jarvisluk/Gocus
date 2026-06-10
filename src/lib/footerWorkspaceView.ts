import type { WorkspaceOpenTarget } from "../types";
import { joinClass } from "./classNames";
import { politeStatusView } from "./statusView";
import { activeWorkspaceOpenOption, activeWorkspaceOpenTarget, visibleWorkspaceOpenOptions } from "./workspaceOpenChoices";
import type { WorkspaceOpenOption } from "./workspaceOpenOptions";

const workspaceOpenMenuToggleId = "workspace-open-menu-toggle";
const workspaceOpenMenuId = "workspace-open-menu";

export interface FooterWorkspaceSelection {
  activeTarget: WorkspaceOpenTarget;
  menuOpen: boolean;
  openTarget: WorkspaceOpenTarget;
}

export function footerChangedNowButtonView(changedNowOpen: boolean) {
  return {
    className: joinClass("footer-changed-now", changedNowOpen && "is-open"),
    ariaLabel: changedNowOpen ? "Close Changed now" : "Open Changed now",
    ariaPressed: changedNowOpen,
    title: changedNowOpen ? "Close Changed now" : "Changed now",
  };
}

export function footerSettingsButtonView() {
  return {
    className: "ui-icon-button footer-icon footer-settings",
    ariaLabel: "Settings",
    title: "Settings",
  };
}

export function footerOpenRepositoryButtonView() {
  return {
    className: "footer-primary",
    label: "Open folder",
  };
}

export function footerZenButtonView(hasRepository: boolean) {
  return {
    className: "ui-icon-button footer-icon footer-zen",
    ariaLabel: "Enter Zen mode",
    title: "Zen mode",
    disabled: !hasRepository,
  };
}

export function footerNoticeView({ hasRepository, notice }: { hasRepository: boolean; notice: string }) {
  const message = notice.trim();
  if (!hasRepository || !message) return null;

  return politeStatusView({
    className: "notice-line",
    message,
  });
}

export function footerActionsView({
  changedNowOpen,
  hasRepository,
  showZenEntry,
}: {
  changedNowOpen: boolean;
  hasRepository: boolean;
  showZenEntry: boolean;
}) {
  return {
    className: joinClass("peek-footer", showZenEntry && "has-zen-entry"),
    showOpenRepositoryButton: !hasRepository,
    showChangedNowButton: hasRepository,
    settingsButton: footerSettingsButtonView(),
    openRepositoryButton: footerOpenRepositoryButtonView(),
    changedNowButton: footerChangedNowButtonView(changedNowOpen),
    showZenButton: showZenEntry,
    zenButton: footerZenButtonView(hasRepository),
  };
}

export function footerWorkspaceMenuToggleView(menuOpen: boolean) {
  return {
    id: workspaceOpenMenuToggleId,
    className: joinClass("workspace-open-menu-toggle", menuOpen && "is-open"),
    ariaLabel: "Choose external app",
    ariaHasPopup: "menu" as const,
    ariaExpanded: menuOpen,
    ariaControls: workspaceOpenMenuId,
    title: "Choose external app",
  };
}

export function footerWorkspaceOpenButtonView(option: WorkspaceOpenOption) {
  const label = `Open in ${option.label}`;

  return {
    className: "workspace-open-trigger",
    ariaLabel: label,
    title: label,
  };
}

export function footerWorkspaceMenuView() {
  return {
    className: "ui-menu ui-layer-panel workspace-open-menu",
    id: workspaceOpenMenuId,
    role: "menu" as const,
    ariaLabelledBy: workspaceOpenMenuToggleId,
  };
}

export function footerWorkspaceMenuItemView(option: WorkspaceOpenOption, activeMenuTarget: WorkspaceOpenTarget | "") {
  const active = option.target === activeMenuTarget;

  return {
    active,
    className: joinClass("ui-menu-item", "workspace-open-menu-item", active && "is-active"),
    iconClassName: "external-app-icon",
    role: "menuitem" as const,
    ariaCurrent: active ? ("true" as const) : undefined,
  };
}

export function footerWorkspaceMenuOpenAfterToggle(menuOpen: boolean, canToggleMenu: boolean) {
  return canToggleMenu ? !menuOpen : menuOpen;
}

export function footerWorkspaceMenuOpenAfterSelection() {
  return false;
}

export function footerWorkspaceSelection(target: WorkspaceOpenTarget): FooterWorkspaceSelection {
  return {
    activeTarget: target,
    menuOpen: footerWorkspaceMenuOpenAfterSelection(),
    openTarget: target,
  };
}

export function footerWorkspaceView({
  options,
  availableTargets,
  enabledTargets,
  activeTarget,
  hasRepository,
}: {
  options: readonly WorkspaceOpenOption[];
  availableTargets: readonly WorkspaceOpenTarget[];
  enabledTargets: readonly WorkspaceOpenTarget[];
  activeTarget: WorkspaceOpenTarget;
  hasRepository: boolean;
}) {
  const visibleOptions = visibleWorkspaceOpenOptions(options, availableTargets, enabledTargets);
  const activeOption = activeWorkspaceOpenOption(visibleOptions, activeTarget);
  const canToggleMenu = hasRepository && visibleOptions.length > 0;

  return {
    control: {
      className: "workspace-open-control",
      iconClassName: "external-app-icon",
    },
    visibleOptions,
    activeOption,
    activeMenuTarget: activeWorkspaceOpenTarget(visibleOptions, activeTarget),
    controlsDisabled: !hasRepository,
    canToggleMenu,
    shouldCloseMenu: !canToggleMenu,
  };
}
