import type { DarkThemePreset, LightThemePreset, Theme, ThemeMode, UiPreferences } from "../types";
import { defaultWorkspaceOpenTargets, sanitizeWorkspaceOpenTargets } from "./workspaceOpenTargets";

export const defaultPreferences: UiPreferences = {
  themeMode: "system",
  lightThemePreset: "paper",
  darkThemePreset: "graphite",
  density: "compact",
  fontFamily: "system",
  graphStyle: "solid",
  workspaceOpenTargets: defaultWorkspaceOpenTargets,
  showZenEntry: true,
  launchAtLogin: false,
  zenMode: false,
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

export function mergePreferences(value: Partial<UiPreferences> | null | undefined): UiPreferences {
  const candidate = value ?? {};

  return {
    themeMode: includesValue(themeModes, candidate.themeMode) ? candidate.themeMode : defaultPreferences.themeMode,
    lightThemePreset: includesValue(lightPresetValues, candidate.lightThemePreset) ? candidate.lightThemePreset : defaultPreferences.lightThemePreset,
    darkThemePreset: includesValue(darkPresetValues, candidate.darkThemePreset) ? candidate.darkThemePreset : defaultPreferences.darkThemePreset,
    density: includesValue(densityValues, candidate.density) ? candidate.density : defaultPreferences.density,
    fontFamily: includesValue(fontFamilyValues, candidate.fontFamily) ? candidate.fontFamily : defaultPreferences.fontFamily,
    graphStyle: includesValue(graphStyleValues, candidate.graphStyle) ? candidate.graphStyle : defaultPreferences.graphStyle,
    workspaceOpenTargets: sanitizeWorkspaceOpenTargets(candidate.workspaceOpenTargets),
    showZenEntry: typeof candidate.showZenEntry === "boolean" ? candidate.showZenEntry : defaultPreferences.showZenEntry,
    launchAtLogin: typeof candidate.launchAtLogin === "boolean" ? candidate.launchAtLogin : defaultPreferences.launchAtLogin,
    zenMode: typeof candidate.zenMode === "boolean" ? candidate.zenMode : defaultPreferences.zenMode,
  };
}

export function resolveThemePreset(preferences: UiPreferences, theme: Theme) {
  return theme === "dark" ? preferences.darkThemePreset : preferences.lightThemePreset;
}

export function applyPreferences(preferences: UiPreferences) {
  const root = document.documentElement;
  root.dataset.density = preferences.density;
  root.dataset.graphStyle = preferences.graphStyle;
  root.dataset.zenMode = preferences.zenMode ? "true" : "false";
  root.style.removeProperty("--focus");
  root.style.removeProperty("--focus-soft");
  root.style.setProperty("--user-font", fontStacks[preferences.fontFamily]);
}
