import { useEffect, useState } from "react";
import { changedFileInfoWindowView } from "../lib/changedFileInfoSelection";
import { logBridgeWarning } from "../lib/errorMessages";
import {
  applyPreferences,
  defaultPreferences,
  mergePreferences,
  preferencesDocumentThemeView,
  systemThemeFallback,
} from "../lib/preferences";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { ChangedFileInfoPayload, Theme, UiPreferences } from "../types";
import { ChangedFileInfoPanel } from "./ChangedNow";

export function ChangedFileInfoWindow() {
  const [payload, setPayload] = useState<ChangedFileInfoPayload>(null);
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);
  const view = changedFileInfoWindowView(payload);

  useEffect(() => {
    window.gitPeek
      ?.getChangedFileInfoPayload()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load changed file info payload.", error));
    return window.gitPeek?.onChangedFileInfoPayloadUpdated(setPayload);
  }, []);

  useEffect(() => {
    window.gitPeek
      ?.getPreferences()
      .then((value) => setPreferences(mergePreferences(value)))
      .catch((error) => logBridgeWarning("Unable to load preferences.", error));
    window.gitPeek?.getSystemTheme().then(setSystemTheme).catch((error) => logBridgeWarning("Unable to load system theme.", error));
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
    document.documentElement.dataset.themePreset = themePreset;
  }, [preferences, theme, themePreset]);

  function closeChangedFileInfoPanel() {
    window.gitPeek?.setChangedFileInfoPanel(null).catch((error) => logBridgeWarning("Unable to close changed file info panel.", error));
  }

  async function openChangedFile(filePath: string) {
    const target = view.changedFilePayload?.workspaceOpenTarget ?? "";
    if (!target) return;

    try {
      const response = await window.gitPeek?.openWorkspaceFile(target, filePath);
      if (response && !response.ok) {
        logBridgeWarning("Unable to open file in selected app.", response.error ?? response);
      }
    } catch (error) {
      logBridgeWarning("Unable to open file in selected app.", error);
    }
  }

  const workspaceOpenTarget = view.changedFilePayload?.workspaceOpenTarget ?? "";
  const workspaceOpenOption =
    workspaceOpenTarget === "" ? null : workspaceOpenOptions.find((option) => option.target === workspaceOpenTarget) ?? null;

  return (
    <main className={view.viewport.className}>
      {view.changedFilePayload ? (
        <section className={view.panel.className} aria-label={view.panel.ariaLabel}>
          <ChangedFileInfoPanel
            file={view.changedFilePayload.file}
            workspaceOpenOption={workspaceOpenOption}
            onClose={closeChangedFileInfoPanel}
            onOpenFile={openChangedFile}
          />
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
