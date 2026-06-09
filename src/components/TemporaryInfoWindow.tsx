import { useEffect, useState } from "react";
import { applyPreferences, defaultPreferences, mergePreferences, resolveThemePreset } from "../lib/preferences";
import type { TemporaryInfoPayload, Theme, UiPreferences } from "../types";
import { ChangedNow } from "./ChangedNow";

function systemThemeFallback(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preferences: UiPreferences, systemTheme: Theme): Theme {
  return preferences.themeMode === "system" ? systemTheme : preferences.themeMode;
}

export function TemporaryInfoWindow() {
  const [payload, setPayload] = useState<TemporaryInfoPayload>(null);
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const theme = resolveTheme(preferences, systemTheme);

  useEffect(() => {
    window.gitPeek?.getTemporaryInfoPayload().then(setPayload);
    return window.gitPeek?.onTemporaryInfoPayloadUpdated(setPayload);
  }, []);

  useEffect(() => {
    window.gitPeek?.getPreferences().then((value) => setPreferences(mergePreferences(value)));
    window.gitPeek?.getSystemTheme().then(setSystemTheme);
    const unsubscribeTheme = window.gitPeek?.onThemeChanged(setSystemTheme);
    const unsubscribePreferences = window.gitPeek?.onPreferencesChanged((value) => setPreferences(mergePreferences(value)));
    return () => {
      unsubscribeTheme?.();
      unsubscribePreferences?.();
    };
  }, []);

  useEffect(() => {
    applyPreferences(preferences);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreset = resolveThemePreset(preferences, theme);
  }, [preferences, theme]);

  useEffect(() => {
    if (payload?.kind === "changed-files") setSelectedFileKey(payload.selectedFileKey);
  }, [payload]);

  return (
    <main className="temporary-info-viewport is-electron">
      {payload?.kind === "changed-files" ? (
        <section className="peek-panel temporary-info-panel" aria-label="Changed files window">
          <ChangedNow
            files={payload.files}
            filter={payload.filter}
            promptLanguage={preferences.promptLanguage}
            selectedFileKey={selectedFileKey}
            onClose={() => window.gitPeek?.setTemporaryInfoPanel(null)}
            onSelectFile={setSelectedFileKey}
          />
        </section>
      ) : (
        <section className="temporary-info-empty" aria-label="Temporary information">
          No file selected.
        </section>
      )}
    </main>
  );
}
