import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FolderOpen, Github, RefreshCw, Upload, X } from "lucide-react";
import { actionResponseSnapshot } from "../lib/actionResponseView";
import { logBridgeWarning } from "../lib/errorMessages";
import {
  applyPreferences,
  defaultPreferences,
  mergePreferences,
  preferencesDocumentThemeView,
  systemThemeFallback,
} from "../lib/preferences";
import {
  functionMenuPayloadFromSnapshot,
  functionMenuWindowView,
  type FunctionMenuActionIcon,
  type FunctionMenuActionView,
} from "../lib/functionMenuView";
import type { ActionResponse, FunctionMenuPayload, Theme, UiPreferences } from "../types";
import { SideWindowShell } from "./SideWindowShell";

function functionMenuIcon(icon: FunctionMenuActionIcon, className = "") {
  if (icon === "download") return <Download className={className} aria-hidden="true" />;
  if (icon === "external") return <ExternalLink className={className} aria-hidden="true" />;
  if (icon === "folder") return <FolderOpen className={className} aria-hidden="true" />;
  if (icon === "github") return <Github className={className} aria-hidden="true" />;
  if (icon === "refresh") return <RefreshCw className={className} aria-hidden="true" />;
  if (icon === "upload") return <Upload className={className} aria-hidden="true" />;
  return <X className={className} aria-hidden="true" />;
}

function FunctionMenuActionButton({
  action,
  busy,
  onClick,
}: {
  action: FunctionMenuActionView;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={action.className}
      type="button"
      title={action.title}
      aria-label={action.title}
      aria-busy={busy || undefined}
      disabled={action.disabled || busy}
      onClick={onClick}
    >
      <span className="function-menu-action-icon">{functionMenuIcon(action.icon, busy ? "is-spinning" : "")}</span>
    </button>
  );
}

export function FunctionMenuWindow() {
  const [payload, setPayload] = useState<FunctionMenuPayload>(null);
  const [busyAction, setBusyAction] = useState("");
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);
  const view = functionMenuWindowView(payload);

  useEffect(() => {
    window.gocus
      ?.getFunctionMenuPayload?.()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load function menu payload.", error));
    return window.gocus?.onFunctionMenuPayloadUpdated?.(setPayload);
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

  function updatePayloadFromResponse(response: ActionResponse) {
    const snapshot = actionResponseSnapshot(response);
    if (!snapshot) return;

    setPayload(
      functionMenuPayloadFromSnapshot({
        snapshot,
        activeWorkspaceTarget: view.payload.activeWorkspaceTarget,
        availableWorkspaceTargets: view.payload.availableWorkspaceTargets,
        enabledWorkspaceTargets: view.payload.enabledWorkspaceTargets,
      }),
    );
  }

  async function runAction(actionKey: string, action: () => Promise<ActionResponse | unknown>) {
    setBusyAction(actionKey);
    try {
      const response = await action();
      if (response && typeof response === "object" && "ok" in response) {
        const actionResponse = response as ActionResponse;
        updatePayloadFromResponse(actionResponse);
        if (!actionResponse.ok) logBridgeWarning("Function menu action failed.", actionResponse.error ?? actionResponse);
      } else {
        logBridgeWarning("Function menu action returned no response.", response);
      }
    } catch (error) {
      logBridgeWarning("Function menu action failed.", error);
    } finally {
      setBusyAction("");
    }
  }

  function closeMenu() {
    window.gocus?.setFunctionMenuPanel?.(null).catch((error) => logBridgeWarning("Unable to close function menu.", error));
  }

  function openRepository() {
    void runAction(
      view.openRepositoryAction.key,
      () => window.gocus?.openRepository({ mode: "all" }) ?? Promise.resolve({ ok: false, error: "Electron bridge unavailable." }),
    );
  }

  function pushCurrentBranch() {
    void runAction(
      view.pushAction.key,
      () => window.gocus?.pushCurrentBranch?.({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Push is unavailable." }),
    );
  }

  function fetchRemotes() {
    void runAction(
      view.fetchAction.key,
      () => window.gocus?.fetchRemotes?.({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Fetch is unavailable." }),
    );
  }

  function refreshGitData() {
    void runAction(
      view.refreshAction.key,
      () => window.gocus?.refresh({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Refresh is unavailable." }),
    );
  }

  function checkForUpdates() {
    void runAction(
      view.updatesAction.key,
      () => window.gocus?.checkForUpdates() ?? Promise.resolve({ ok: false, error: "Updates are unavailable." }),
    );
  }

  function openGitHubReleases() {
    void runAction(
      view.githubAction.key,
      () => window.gocus?.openGitHubReleases?.() ?? Promise.resolve({ ok: false, error: "GitHub Releases are unavailable." }),
    );
  }

  const resizeFunctionMenu = useCallback((height: number) => {
    return window.gocus?.setFunctionMenuPanelHeight?.(height);
  }, []);

  return (
    <SideWindowShell
      viewportClassName={view.viewport.className}
      panelClassName={view.panel.className}
      panelAriaLabel={view.panel.ariaLabel}
      onPanelHeightChange={resizeFunctionMenu}
      resizeWarning="Unable to resize function menu."
    >
      <div className="function-menu-tools" role="toolbar" aria-label="Function menu tools">
        <FunctionMenuActionButton
          action={view.openRepositoryAction}
          busy={busyAction === view.openRepositoryAction.key}
          onClick={openRepository}
        />
        <FunctionMenuActionButton action={view.pushAction} busy={busyAction === view.pushAction.key} onClick={pushCurrentBranch} />
        <FunctionMenuActionButton action={view.fetchAction} busy={busyAction === view.fetchAction.key} onClick={fetchRemotes} />
        <FunctionMenuActionButton
          action={view.githubAction}
          busy={busyAction === view.githubAction.key}
          onClick={openGitHubReleases}
        />
        <FunctionMenuActionButton action={view.refreshAction} busy={busyAction === view.refreshAction.key} onClick={refreshGitData} />
        <FunctionMenuActionButton action={view.updatesAction} busy={busyAction === view.updatesAction.key} onClick={checkForUpdates} />
        <FunctionMenuActionButton action={view.closeButton} busy={false} onClick={closeMenu} />
      </div>
    </SideWindowShell>
  );
}
