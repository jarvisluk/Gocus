import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FolderOpen, Github, RefreshCw, Upload, X } from "lucide-react";
import { actionResponseNotice, actionResponseSnapshot } from "../lib/actionResponseView";
import { errorMessage, logBridgeWarning } from "../lib/errorMessages";
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
      disabled={action.disabled || busy}
      onClick={onClick}
    >
      <span className="function-menu-action-icon">{functionMenuIcon(action.icon, busy ? "is-spinning" : "")}</span>
      <span className="function-menu-action-copy">
        <strong>{action.label}</strong>
        <span>{action.detail}</span>
      </span>
    </button>
  );
}

export function FunctionMenuWindow() {
  const [payload, setPayload] = useState<FunctionMenuPayload>(null);
  const [feedback, setFeedback] = useState("");
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

  async function runAction(actionKey: string, action: () => Promise<ActionResponse | unknown>, fallbackNotice: string) {
    setBusyAction(actionKey);
    setFeedback("");
    try {
      const response = await action();
      if (response && typeof response === "object" && "ok" in response) {
        updatePayloadFromResponse(response as ActionResponse);
        setFeedback(actionResponseNotice(response as ActionResponse, fallbackNotice) ?? "");
      } else {
        setFeedback(fallbackNotice);
      }
    } catch (error) {
      setFeedback(errorMessage(error, "Action failed."));
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
      "Opened workspace.",
    );
  }

  function pushCurrentBranch() {
    void runAction(
      view.pushAction.key,
      () => window.gocus?.pushCurrentBranch?.({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Push is unavailable." }),
      "Pushed current branch.",
    );
  }

  function fetchRemotes() {
    void runAction(
      view.fetchAction.key,
      () => window.gocus?.fetchRemotes?.({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Fetch is unavailable." }),
      "Fetched remotes.",
    );
  }

  function refreshGitData() {
    void runAction(
      view.refreshAction.key,
      () => window.gocus?.refresh({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Refresh is unavailable." }),
      "Git data refreshed.",
    );
  }

  function checkForUpdates() {
    void runAction(
      view.updatesAction.key,
      () => window.gocus?.checkForUpdates() ?? Promise.resolve({ ok: false, error: "Updates are unavailable." }),
      "Checking for updates.",
    );
  }

  function openGitHubReleases() {
    void runAction(
      view.githubAction.key,
      () => window.gocus?.openGitHubReleases?.() ?? Promise.resolve({ ok: false, error: "GitHub Releases are unavailable." }),
      "Opened GitHub Releases.",
    );
  }

  const resizeFunctionMenu = useCallback((height: number) => {
    return window.gocus?.setFunctionMenuPanelHeight?.(height);
  }, []);

  return (
    <SideWindowShell
      viewportClassName={view.viewport.className}
      panelClassName={view.panel.className}
      panelAriaLabelledBy={view.panel.ariaLabelledBy}
      onPanelHeightChange={resizeFunctionMenu}
      resizeWarning="Unable to resize function menu."
    >
      <header className="function-menu-header">
        <div>
          <h2 id={view.titleId}>{view.title}</h2>
          <span>{view.repositorySummary.name}</span>
        </div>
        <button className={view.closeButton.className} type="button" aria-label={view.closeButton.label} onClick={closeMenu}>
          {functionMenuIcon(view.closeButton.icon)}
        </button>
      </header>

      <div className={view.repositorySummary.className} title={view.repositorySummary.title}>
        <strong>{view.repositorySummary.detail}</strong>
        {view.repositorySummary.meta ? <span>{view.repositorySummary.meta}</span> : null}
      </div>

      <div className="function-menu-section">
        <strong>{view.sections.workspace}</strong>
        <FunctionMenuActionButton
          action={view.openRepositoryAction}
          busy={busyAction === view.openRepositoryAction.key}
          onClick={openRepository}
        />
      </div>

      <div className="function-menu-section">
        <strong>{view.sections.remote}</strong>
        <FunctionMenuActionButton action={view.pushAction} busy={busyAction === view.pushAction.key} onClick={pushCurrentBranch} />
        <FunctionMenuActionButton action={view.fetchAction} busy={busyAction === view.fetchAction.key} onClick={fetchRemotes} />
        <FunctionMenuActionButton
          action={view.githubAction}
          busy={busyAction === view.githubAction.key}
          onClick={openGitHubReleases}
        />
      </div>

      <div className="function-menu-section">
        <strong>{view.sections.maintenance}</strong>
        <FunctionMenuActionButton action={view.refreshAction} busy={busyAction === view.refreshAction.key} onClick={refreshGitData} />
        <FunctionMenuActionButton action={view.updatesAction} busy={busyAction === view.updatesAction.key} onClick={checkForUpdates} />
      </div>

      {feedback ? (
        <div className="function-menu-feedback" role="status" aria-live="polite">
          {feedback}
        </div>
      ) : null}
    </SideWindowShell>
  );
}
