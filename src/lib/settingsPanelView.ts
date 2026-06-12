import type { UiPreferences, WorkspaceOpenTarget } from "../types";
import { politeStatusView } from "./statusView";
import { workspaceOpenTargetsSummary } from "./workspaceOpenChoices";
import type { WorkspaceOpenOption } from "./workspaceOpenOptions";

export type SettingsPage = "main" | "openIn";
export type SettingsSegmentIcon = "monitor" | "sun" | "moon";

export const settingsPanelTitleId = "settings-panel-title";
export const settingsRefreshMenuId = "settings-refresh-menu";
export const settingsRefreshTriggerId = "settings-refresh-trigger";

interface SettingsSegmentOption<T extends string> {
  value: T;
  label: string;
  className: string;
  ariaPressed: boolean;
  icon?: SettingsSegmentIcon;
}

interface SettingsSelectOption<T extends string> {
  value: T;
  label: string;
}

function activeSegmentClass(active: boolean) {
  return active ? "is-active" : "";
}

function settingsSegmentOption<T extends string>(
  value: T,
  currentValue: T,
  label: string,
  icon?: SettingsSegmentIcon,
): SettingsSegmentOption<T> {
  const active = value === currentValue;
  const option: SettingsSegmentOption<T> = {
    value,
    label,
    className: activeSegmentClass(active),
    ariaPressed: active,
  };

  if (icon) option.icon = icon;
  return option;
}

export function settingsPreferencesView(preferences: UiPreferences) {
  return {
    themeModeOptions: [
      settingsSegmentOption("system", preferences.themeMode, "System", "monitor"),
      settingsSegmentOption("light", preferences.themeMode, "Light", "sun"),
      settingsSegmentOption("dark", preferences.themeMode, "Dark", "moon"),
    ],
    densityOptions: [
      settingsSegmentOption("compact", preferences.density, "Compact"),
      settingsSegmentOption("comfortable", preferences.density, "Comfort"),
    ],
    graphStyleOptions: [
      settingsSegmentOption("solid", preferences.graphStyle, "Solid"),
      settingsSegmentOption("soft", preferences.graphStyle, "Soft"),
    ],
    promptLanguageOptions: [
      settingsSegmentOption("en", preferences.promptLanguage, "English"),
      settingsSegmentOption("zh", preferences.promptLanguage, "中文"),
    ],
    fontFamilyOptions: [
      { value: "system", label: "System" },
      { value: "inter", label: "Inter" },
      { value: "mono", label: "Mono" },
    ] satisfies SettingsSelectOption<UiPreferences["fontFamily"]>[],
  };
}

export function settingsWorkspaceTargetItems(
  availableWorkspaceOptions: readonly WorkspaceOpenOption[],
  enabledWorkspaceTargets: readonly WorkspaceOpenTarget[],
) {
  const enabledTargets = new Set(enabledWorkspaceTargets);

  return availableWorkspaceOptions.map((option) => ({
    option,
    checked: enabledTargets.has(option.target),
    ariaLabel: `Show ${option.label} in open menu`,
  }));
}

export function settingsPanelView(
  page: SettingsPage,
  availableWorkspaceOptions: readonly WorkspaceOpenOption[],
  enabledWorkspaceTargets: readonly WorkspaceOpenTarget[],
) {
  const openInPageActive = page === "openIn";
  const workspaceTargetsSummary = workspaceOpenTargetsSummary(availableWorkspaceOptions, enabledWorkspaceTargets);

  return {
    openInPageActive,
    page: {
      className: "ui-page settings-page",
      ariaLabelledBy: settingsPanelTitleId,
    },
    header: {
      className: "ui-page-header settings-page-header",
      backButton: {
        className: "ui-icon-button",
        ariaLabel: openInPageActive ? "Back to settings" : "Back to Git view",
      },
    },
    titleId: settingsPanelTitleId,
    title: openInPageActive ? "Open in" : "Settings",
    subtitle: openInPageActive ? "External apps" : "Interface preferences",
    workspaceTargetsSummary,
    openInPanel: {
      className: "ui-form settings-panel settings-workspace-targets-panel",
      listClassName: "workspace-target-list",
      toggleClassName: "workspace-target-toggle",
      iconClassName: "external-app-icon",
      emptyState: politeStatusView({
        className: "empty-state",
        message: "No external apps available.",
      }),
    },
    mainPanel: {
      className: "ui-form settings-panel",
      sectionClassName: "ui-form-section",
      sectionTitleClassName: "ui-form-section-title",
      rowClassName: "ui-form-row settings-row",
      labelClassName: "ui-label",
      segmentedClassName: "ui-segmented segmented-control",
      compactSegmentedClassName: "ui-segmented segmented-control compact",
      selectFrameClassName: "ui-select-frame",
      selectClassName: "ui-select",
      refreshControlClassName: "settings-refresh-control",
      refreshFrameClassName: "ui-select-frame ui-disclosure-frame settings-refresh-frame",
      refreshTriggerClassName: "settings-refresh-trigger ui-disclosure-button",
      refreshTriggerId: settingsRefreshTriggerId,
      refreshMenuClassName: "ui-menu settings-refresh-menu",
      refreshMenuId: settingsRefreshMenuId,
      refreshMenuItemClassName: "ui-menu-item settings-refresh-menu-item",
      refreshMenuRole: "menu",
      launchAtLoginToggleClassName: "ui-toggle settings-launch-at-login-toggle",
      menuBarIconToggleClassName: "ui-toggle settings-menu-bar-icon-toggle",
      mergeCommitToggleClassName: "ui-toggle settings-merge-commit-toggle",
      disclosureFrameClassName: "ui-select-frame ui-disclosure-frame",
      disclosureButtonClassName: "ui-disclosure-button",
      disclosureLabelClassName: "ui-disclosure-label",
      disclosureValueClassName: "ui-disclosure-value",
      resetSectionClassName: "ui-form-section ui-form-section-actions",
      resetButtonClassName: "ui-button settings-reset",
    },
    sections: {
      appearance: {
        titleId: "settings-appearance-title",
        title: "Appearance",
        rows: {
          mode: "Mode",
          light: "Light",
          dark: "Dark",
          density: "Density",
          font: "Font",
        },
        lightThemeAriaLabel: "Light theme preset",
        darkThemeAriaLabel: "Dark theme preset",
        fontFamilyAriaLabel: "Font family",
      },
      graph: {
        titleId: "settings-graph-title",
        title: "Graph",
        rows: {
          lines: "Lines",
        },
      },
      behavior: {
        titleId: "settings-behavior-title",
        title: "Behavior",
        rows: {
          refresh: "Refresh",
          startup: "Startup",
          menuBar: "Menu bar",
          merge: "No-FF",
          prompt: "Prompt",
        },
        autoRefreshAriaLabel: "Auto refresh interval",
        launchAtLoginAriaLabel: "Launch at login",
        showMenuBarIconAriaLabel: "Show menu bar icon",
        createMergeCommitAriaLabel: "Disable fast-forward merges",
      },
      workspace: {
        titleId: "settings-workspace-title",
        title: "Workspace",
        rowLabel: "Open in",
        disclosureAriaLabel: "Open external app settings",
        disclosureLabel: "Apps",
        disclosureValue: workspaceTargetsSummary,
      },
      reset: {
        ariaLabel: "Reset preferences",
        label: "Reset",
      },
    },
  };
}

export function settingsPageAfterBack(page: SettingsPage) {
  return page === "openIn" ? "main" : null;
}

export function settingsPageAfterEscape(page: SettingsPage) {
  return page === "openIn" ? "main" : null;
}
