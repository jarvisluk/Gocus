import { useEffect, useState } from "react";
import { logBridgeWarning } from "../lib/errorMessages";
import {
  applyPreferences,
  defaultPreferences,
  mergePreferences,
  preferencesDocumentThemeView,
  systemThemeFallback,
} from "../lib/preferences";
import { runTemporaryInfoPanelBridgeSideEffect } from "../lib/temporaryInfoPanelBridge";
import { changedFilesSelectedFileKey, temporaryInfoWindowView } from "../lib/temporaryInfoSelection";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { TemporaryInfoPayload, Theme, UiPreferences, WorkspaceOpenTarget } from "../types";
import { ChangedFileInfoPanel, ChangedNow } from "./ChangedNow";

export function TemporaryInfoWindow() {
  const [payload, setPayload] = useState<TemporaryInfoPayload>(null);
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);
  const view = temporaryInfoWindowView(payload, selectedFileKey);

  useEffect(() => {
    window.gitPeek
      ?.getTemporaryInfoPayload()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load temporary info payload.", error));
    return window.gitPeek?.onTemporaryInfoPayloadUpdated(setPayload);
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

  useEffect(() => {
    setSelectedFileKey((current) => changedFilesSelectedFileKey(payload, current));
  }, [payload]);

  function closeTemporaryInfoPanel() {
    runTemporaryInfoPanelBridgeSideEffect("close", (nextPayload) => window.gitPeek?.setTemporaryInfoPanel(nextPayload));
  }

  async function openChangedFile(filePath: string, target: WorkspaceOpenTarget | "") {
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

  const workspaceOpenTarget = view.changedFilesPayload?.workspaceOpenTarget ?? "";
  const workspaceOpenOption =
    workspaceOpenTarget === "" ? null : workspaceOpenOptions.find((option) => option.target === workspaceOpenTarget) ?? null;

  return (
    <main className={view.viewport.className}>
      {view.changedFilesPayload ? (
        <section className={view.panel.className} aria-label={view.panel.ariaLabel}>
          <ChangedNow
            files={view.changedFilesPayload.files}
            filter={view.changedFilesPayload.filter}
            promptLanguage={preferences.promptLanguage}
            selectedFileKey={selectedFileKey}
            onClose={closeTemporaryInfoPanel}
            onSelectFile={setSelectedFileKey}
          />
          {view.selectedFile ? (
            <ChangedFileInfoPanel
              file={view.selectedFile}
              workspaceOpenOption={workspaceOpenOption}
              onClose={() => setSelectedFileKey("")}
              onOpenFile={(filePath) => openChangedFile(filePath, workspaceOpenTarget)}
            />
          ) : null}
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
