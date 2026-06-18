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
import { defaultWorkspaceOpenTargets, sanitizeWorkspaceOpenTargets } from "../lib/workspaceOpenTargets";
import type { ChangedFileInfoPayload, Theme, UiPreferences, WorkspaceOpenMenuAnchorBounds, WorkspaceOpenTarget } from "../types";
import { ChangedFileInfoPanel } from "./ChangedNow";
import { WorkspaceOpenControl } from "./WorkspaceOpenControl";

export function ChangedFileInfoWindow() {
  const [payload, setPayload] = useState<ChangedFileInfoPayload>(null);
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [availableWorkspaceTargets, setAvailableWorkspaceTargets] = useState<WorkspaceOpenTarget[]>(defaultWorkspaceOpenTargets);
  const [activeWorkspaceTarget, setActiveWorkspaceTarget] = useState<WorkspaceOpenTarget>("cursor");
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);
  const view = changedFileInfoWindowView(payload);

  useEffect(() => {
    window.gocus
      ?.getChangedFileInfoPayload()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load changed file info payload.", error));
    return window.gocus?.onChangedFileInfoPayloadUpdated(setPayload);
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
    window.gocus
      ?.getAvailableWorkspaceTargets()
      .then((targets) => setAvailableWorkspaceTargets(sanitizeWorkspaceOpenTargets(targets, [])))
      .catch((error) => logBridgeWarning("Unable to load available workspace targets.", error));
  }, []);

  useEffect(() => {
    window.gocus
      ?.getActiveWorkspaceTarget()
      .then(setActiveWorkspaceTarget)
      .catch((error) => logBridgeWarning("Unable to load active workspace target.", error));
    return window.gocus?.onActiveWorkspaceTargetChanged(setActiveWorkspaceTarget);
  }, []);

  useEffect(() => {
    if (window.gocus?.getActiveWorkspaceTarget) return;
    if (view.changedFilePayload?.workspaceOpenTarget) setActiveWorkspaceTarget(view.changedFilePayload.workspaceOpenTarget);
  }, [view.changedFilePayload?.workspaceOpenTarget]);

  useEffect(() => {
    applyPreferences(preferences);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreset = themePreset;
  }, [preferences, theme, themePreset]);

  function closeChangedFileInfoPanel() {
    window.gocus?.setChangedFileInfoPanel(null).catch((error) => logBridgeWarning("Unable to close changed file info panel.", error));
  }

  function updateActiveWorkspaceTarget(target: WorkspaceOpenTarget) {
    setActiveWorkspaceTarget(target);
    window.gocus?.setActiveWorkspaceTarget(target).catch((error) => logBridgeWarning("Unable to save active workspace target.", error));
  }

  async function openChangedFile(target: WorkspaceOpenTarget) {
    const filePath = view.changedFilePayload?.file.path;
    if (!filePath) return;

    try {
      const response = await window.gocus?.openWorkspaceFile(target, filePath);
      if (response && !response.ok) {
        logBridgeWarning("Unable to open file in selected app.", response.error ?? response);
      }
    } catch (error) {
      logBridgeWarning("Unable to open file in selected app.", error);
    }
  }

  function openChangedFileWorkspaceMenu(anchorBounds: WorkspaceOpenMenuAnchorBounds, itemCount: number) {
    const filePath = view.changedFilePayload?.file.path;
    if (!filePath) return;

    window.gocus
      ?.openWorkspaceFileMenu({
        kind: "changed-file",
        filePath,
        anchorBounds,
        activeWorkspaceTarget,
        availableWorkspaceTargets,
        enabledWorkspaceTargets: preferences.workspaceOpenTargets,
        itemCount,
      })
      .catch((error) => logBridgeWarning("Unable to open workspace app menu.", error));
  }

  return (
    <main className={view.viewport.className}>
      {view.changedFilePayload ? (
        <section className={view.panel.className} aria-label={view.panel.ariaLabel}>
          <ChangedFileInfoPanel
            file={view.changedFilePayload.file}
            actions={
              <WorkspaceOpenControl
                activeWorkspaceTarget={activeWorkspaceTarget}
                availableWorkspaceTargets={availableWorkspaceTargets}
                enabledWorkspaceTargets={preferences.workspaceOpenTargets}
                onActiveWorkspaceTargetChange={updateActiveWorkspaceTarget}
                onOpenExternalMenu={openChangedFileWorkspaceMenu}
                onOpenTarget={openChangedFile}
              />
            }
            onClose={closeChangedFileInfoPanel}
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
