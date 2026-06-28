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
import type { TemporaryInfoPayload, Theme, UiPreferences } from "../types";
import { ChangedNow } from "./ChangedNow";
import { SideWindowShell } from "./SideWindowShell";

export function TemporaryInfoWindow() {
  const [payload, setPayload] = useState<TemporaryInfoPayload>(null);
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);
  const view = temporaryInfoWindowView(payload, selectedFileKey);

  useEffect(() => {
    window.gocus
      ?.getTemporaryInfoPayload()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load temporary info payload.", error));
    return window.gocus?.onTemporaryInfoPayloadUpdated(setPayload);
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

  useEffect(() => {
    setSelectedFileKey((current) => changedFilesSelectedFileKey(payload, current));
  }, [payload]);

  useEffect(() => {
    const selectedFile = view.selectedFile;
    const workspaceOpenTarget = view.changedFilesPayload?.workspaceOpenTarget ?? "";
    const nextPayload = selectedFile ? { kind: "changed-file" as const, file: selectedFile, workspaceOpenTarget } : null;

    window.gocus
      ?.setChangedFileInfoPanel(nextPayload)
      .catch((error) => logBridgeWarning("Unable to update changed file info panel.", error));
  }, [view.changedFilesPayload?.workspaceOpenTarget, view.selectedFile]);

  useEffect(() => {
    return window.gocus?.onChangedFileInfoPanelClosed(() => {
      setSelectedFileKey("");
    });
  }, []);

  function closeTemporaryInfoPanel() {
    runTemporaryInfoPanelBridgeSideEffect("close", (nextPayload) => window.gocus?.setTemporaryInfoPanel(nextPayload));
  }

  return (
    <SideWindowShell
      viewportClassName={view.viewport.className}
      panelClassName={view.panel.className}
      panelAriaLabel={view.panel.ariaLabel}
      emptyState={view.emptyState}
    >
      {view.changedFilesPayload ? (
        <ChangedNow
          files={view.changedFilesPayload.files}
          filter={view.changedFilesPayload.filter}
          promptLanguage={preferences.promptLanguage}
          selectedFileKey={selectedFileKey}
          onClose={closeTemporaryInfoPanel}
          onSelectFile={setSelectedFileKey}
        />
      ) : null}
    </SideWindowShell>
  );
}
