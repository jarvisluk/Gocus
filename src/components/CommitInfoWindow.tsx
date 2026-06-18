import { useEffect, useState } from "react";
import { commitInfoWindowView } from "../lib/commitInfoSelection";
import { logBridgeWarning } from "../lib/errorMessages";
import {
  applyPreferences,
  defaultPreferences,
  mergePreferences,
  preferencesDocumentThemeView,
  systemThemeFallback,
} from "../lib/preferences";
import type { CommitInfoPayload, Theme, UiPreferences } from "../types";
import { CommitInfoPanel } from "./CommitInfoPanel";

export function CommitInfoWindow() {
  const [payload, setPayload] = useState<CommitInfoPayload>(null);
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);
  const view = commitInfoWindowView(payload);

  useEffect(() => {
    window.gocus
      ?.getCommitInfoPayload()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load commit info payload.", error));
    return window.gocus?.onCommitInfoPayloadUpdated(setPayload);
  }, []);

  useEffect(() => {
    window.gocus
      ?.getPreferences()
      .then((value) => setPreferences(mergePreferences(value)))
      .catch((error) => logBridgeWarning("Unable to load preferences.", error));
    window.gocus?.getSystemTheme().then(setSystemTheme).catch((error) => logBridgeWarning("Unable to load system theme.", error));
    const unsubscribeTheme = window.gocus?.onThemeChanged(setSystemTheme);
    const unsubscribePreferences = window.gocus?.onPreferencesChanged((value) => setPreferences(mergePreferences(value)));
    return () => {
      unsubscribeTheme?.();
      unsubscribePreferences?.();
    };
  }, []);

  useEffect(() => {
    applyPreferences(preferences);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreset = themePreset;
  }, [preferences, theme, themePreset]);

  return (
    <main className={view.viewport.className}>
      {view.commitPayload ? (
        <section className={view.panel.className} aria-label={view.panel.ariaLabel}>
          <CommitInfoPanel commit={view.commitPayload.commit} />
        </section>
      ) : (
        <section
          className={view.emptyState.className}
          aria-label={view.emptyState.ariaLabel}
          role={view.emptyState.role}
          aria-live={view.emptyState.ariaLive}
        >
          {view.emptyState.message}
        </section>
      )}
    </main>
  );
}
