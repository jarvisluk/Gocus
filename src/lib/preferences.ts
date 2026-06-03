import type { UiPreferences } from "../types";

export const defaultPreferences: UiPreferences = {
  accentColor: "#6aa8ff",
  density: "compact",
  fontFamily: "system",
  graphStyle: "solid",
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
  root.style.setProperty("--focus", preferences.accentColor);
  root.style.setProperty("--user-font", fontStacks[preferences.fontFamily]);
}
