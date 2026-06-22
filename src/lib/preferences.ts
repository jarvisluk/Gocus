import type { DarkThemePreset, LightThemePreset, Theme, ThemeMode, UiPreferences } from "../types";
import { defaultWorkspaceOpenTargets, sanitizeWorkspaceOpenTargets } from "./workspaceOpenTargets";

export const defaultPreferences: UiPreferences = {
  themeMode: "dark",
  lightThemePreset: "paper",
  darkThemePreset: "graphite",
  density: "compact",
  fontFamily: "system",
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

export const lightThemePresetOptions: { value: LightThemePreset; label: string }[] = [
  { value: "paper", label: "Paper" },
  { value: "mist", label: "Mist" },
  { value: "pearl", label: "Pearl" },
];

export const darkThemePresetOptions: { value: DarkThemePreset; label: string }[] = [
  { value: "graphite", label: "Graphite" },
  { value: "cursor", label: "Cursor" },
  { value: "matte", label: "Matte" },
];

export const autoRefreshIntervalOptions: { value: UiPreferences["autoRefreshInterval"]; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "1m", label: "1 min" },
  { value: "5m", label: "5 min" },
  { value: "15m", label: "15 min" },
];

const fontStacks: Record<UiPreferences["fontFamily"], string> = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  inter: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

function includesValue<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

const themeModes: ThemeMode[] = ["system", "light", "dark"];
const lightPresetValues = lightThemePresetOptions.map((option) => option.value);
const darkPresetValues = darkThemePresetOptions.map((option) => option.value);
const densityValues: UiPreferences["density"][] = ["compact", "comfortable"];
const fontFamilyValues: UiPreferences["fontFamily"][] = ["system", "inter", "mono"];
const graphStyleValues: UiPreferences["graphStyle"][] = ["solid", "soft"];
const autoUpdateChannelValues: UiPreferences["autoUpdateChannel"][] = ["stable", "develop"];
const autoRefreshIntervalValues = autoRefreshIntervalOptions.map((option) => option.value);
const promptLanguageValues: UiPreferences["promptLanguage"][] = ["en", "zh"];

export function mergePreferences(value: Partial<UiPreferences> | null | undefined): UiPreferences {
  const candidate = value ?? {};

  return {
    themeMode: includesValue(themeModes, candidate.themeMode) ? candidate.themeMode : defaultPreferences.themeMode,
    lightThemePreset: includesValue(lightPresetValues, candidate.lightThemePreset)
      ? candidate.lightThemePreset
      : defaultPreferences.lightThemePreset,
    darkThemePreset: includesValue(darkPresetValues, candidate.darkThemePreset)
      ? candidate.darkThemePreset
      : defaultPreferences.darkThemePreset,
    density: includesValue(densityValues, candidate.density) ? candidate.density : defaultPreferences.density,
    fontFamily: includesValue(fontFamilyValues, candidate.fontFamily) ? candidate.fontFamily : defaultPreferences.fontFamily,
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

export function resolveThemePreset(preferences: UiPreferences, theme: Theme) {
  return theme === "dark" ? preferences.darkThemePreset : preferences.lightThemePreset;
}

export function systemThemeFromMediaMatches(prefersDark: boolean): Theme {
  return prefersDark ? "dark" : "light";
}

export function systemThemeFallback(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return systemThemeFromMediaMatches(window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function resolveTheme(preferences: UiPreferences, systemTheme: Theme): Theme {
  return preferences.themeMode === "system" ? systemTheme : preferences.themeMode;
}

export function preferencesDocumentThemeView(preferences: UiPreferences, systemTheme: Theme) {
  const theme = resolveTheme(preferences, systemTheme);

  return {
    theme,
    themePreset: resolveThemePreset(preferences, theme),
  };
}

export function applyPreferences(preferences: UiPreferences) {
  const root = document.documentElement;
  root.dataset.density = preferences.density;
  root.dataset.graphStyle = preferences.graphStyle;
  root.style.removeProperty("--focus");
  root.style.removeProperty("--focus-soft");
  root.style.setProperty("--user-font", fontStacks[preferences.fontFamily]);
}
