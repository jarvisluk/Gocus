import { useEffect, useState } from "react";
import { logBridgeWarning } from "../lib/errorMessages";
import { applyPreferences, defaultPreferences, mergePreferences } from "../lib/preferences";
import { runTemporaryInfoPanelBridgeSideEffect } from "../lib/temporaryInfoPanelBridge";
import { changedFilesSelectedFileKey, temporaryInfoWindowView } from "../lib/temporaryInfoSelection";
import type { TemporaryInfoPayload, UiPreferences } from "../types";
import { ChangedNow } from "./ChangedNow";
import { SideWindowShell } from "./SideWindowShell";

export function TemporaryInfoWindow() {
  const [payload, setPayload] = useState<TemporaryInfoPayload>(null);
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
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
    const unsubscribePreferences = window.gocus?.onPreferencesChanged((value) => setPreferences(mergePreferences(value)));
    return () => {
      unsubscribePreferences?.();
    };
  }, []);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

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
