import type { UiPreferences } from "../types";
import { defaultWorkspaceOpenTargets, sanitizeWorkspaceOpenTargets } from "./workspaceOpenTargets";

export const defaultPreferences: UiPreferences = {
  graphStyle: "solid",
  workspaceOpenTargets: defaultWorkspaceOpenTargets,
  showMenuBarIcon: true,
  showDockIcon: false,
  launchAtLogin: false,
  autoUpdateChannel: "stable",
  autoUpdateChecks: true,
  autoUpdateInstall: false,
  createMergeCommit: true,
  autoRefreshInterval: "off",
  promptLanguage: "en",
};

export const autoRefreshIntervalOptions: { value: UiPreferences["autoRefreshInterval"]; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "1m", label: "1 min" },
  { value: "5m", label: "5 min" },
  { value: "15m", label: "15 min" },
];

function includesValue<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

const graphStyleValues: UiPreferences["graphStyle"][] = ["solid", "soft"];
const autoUpdateChannelValues: UiPreferences["autoUpdateChannel"][] = ["stable", "develop"];
const autoRefreshIntervalValues = autoRefreshIntervalOptions.map((option) => option.value);
const promptLanguageValues: UiPreferences["promptLanguage"][] = ["en", "zh"];

export function mergePreferences(value: Partial<UiPreferences> | null | undefined): UiPreferences {
  const candidate = value ?? {};

  return {
    graphStyle: includesValue(graphStyleValues, candidate.graphStyle) ? candidate.graphStyle : defaultPreferences.graphStyle,
    workspaceOpenTargets: sanitizeWorkspaceOpenTargets(candidate.workspaceOpenTargets),
    showMenuBarIcon: typeof candidate.showMenuBarIcon === "boolean" ? candidate.showMenuBarIcon : defaultPreferences.showMenuBarIcon,
    showDockIcon: typeof candidate.showDockIcon === "boolean" ? candidate.showDockIcon : defaultPreferences.showDockIcon,
    launchAtLogin: typeof candidate.launchAtLogin === "boolean" ? candidate.launchAtLogin : defaultPreferences.launchAtLogin,
    autoUpdateChannel: includesValue(autoUpdateChannelValues, candidate.autoUpdateChannel)
      ? candidate.autoUpdateChannel
      : defaultPreferences.autoUpdateChannel,
    autoUpdateChecks:
      typeof candidate.autoUpdateChecks === "boolean" ? candidate.autoUpdateChecks : defaultPreferences.autoUpdateChecks,
    autoUpdateInstall:
      typeof candidate.autoUpdateInstall === "boolean" ? candidate.autoUpdateInstall : defaultPreferences.autoUpdateInstall,
    createMergeCommit:
      typeof candidate.createMergeCommit === "boolean" ? candidate.createMergeCommit : defaultPreferences.createMergeCommit,
    autoRefreshInterval: includesValue(autoRefreshIntervalValues, candidate.autoRefreshInterval)
      ? candidate.autoRefreshInterval
      : defaultPreferences.autoRefreshInterval,
    promptLanguage: includesValue(promptLanguageValues, candidate.promptLanguage)
      ? candidate.promptLanguage
      : defaultPreferences.promptLanguage,
  };
}

export function applyPreferences(preferences: UiPreferences) {
  const root = document.documentElement;
  root.dataset.theme = "dark";
  root.dataset.themePreset = "graphite";
  root.dataset.graphStyle = preferences.graphStyle;
  root.style.removeProperty("--focus");
  root.style.removeProperty("--focus-soft");
  root.style.removeProperty("--user-font");
}
