import type { UiPreferences } from "../types";

export const defaultPreferences: UiPreferences = {
  accentColor: "#6aa8ff",
  themeMode: "system",
  density: "compact",
  fontFamily: "system",
  graphStyle: "solid",
  zenMode: false,
};

const fontStacks: Record<UiPreferences["fontFamily"], string> = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  inter: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

export function mergePreferences(value: Partial<UiPreferences> | null | undefined): UiPreferences {
  return {
    ...defaultPreferences,
    ...(value ?? {}),
  };
}

export function applyPreferences(preferences: UiPreferences) {
  const root = document.documentElement;
  root.dataset.density = preferences.density;
  root.dataset.graphStyle = preferences.graphStyle;
  root.dataset.zenMode = preferences.zenMode ? "true" : "false";
  root.style.setProperty("--focus", preferences.accentColor);
  root.style.setProperty("--user-font", fontStacks[preferences.fontFamily]);
}
