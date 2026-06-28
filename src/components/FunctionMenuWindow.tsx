import { useCallback, useEffect, useState } from "react";
import { Download, FolderOpen, Github, GitPullRequestArrow, RefreshCw, Upload } from "lucide-react";
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
  if (icon === "folder") return <FolderOpen className={className} aria-hidden="true" />;
  if (icon === "github") return <Github className={className} aria-hidden="true" />;
  if (icon === "pull") return <GitPullRequestArrow className={className} aria-hidden="true" />;
  if (icon === "refresh") return <RefreshCw className={className} aria-hidden="true" />;
  return <Upload className={className} aria-hidden="true" />;
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
      <span className="function-menu-action-label">{action.label}</span>
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

  function openRepository() {
    void runAction(
      view.openRepositoryAction.key,
      () => window.gocus?.openRepository({ mode: "all" }) ?? Promise.resolve({ ok: false, error: "Electron bridge unavailable." }),
    );
  }

  function pullCurrentBranch() {
    void runAction(
      view.pullAction.key,
      () => window.gocus?.pullCurrentBranch?.({ mode: "current" }) ?? Promise.resolve({ ok: false, error: "Pull is unavailable." }),
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
  const actionHandlers: Record<string, () => void> = {
    "open-repository": openRepository,
    pull: pullCurrentBranch,
    push: pushCurrentBranch,
    fetch: fetchRemotes,
    refresh: refreshGitData,
    "github-releases": openGitHubReleases,
    "check-updates": checkForUpdates,
  };

  return (
    <SideWindowShell
      viewportClassName={view.viewport.className}
      panelClassName={view.panel.className}
      panelAriaLabelledBy={view.panel.ariaLabelledBy}
      onPanelHeightChange={resizeFunctionMenu}
      resizeWarning="Unable to resize function menu."
    >
      <h1 className="function-menu-title" id={view.titleId}>
        {view.title}
      </h1>
      <div className="function-menu-sections">
        {view.sections.map((section) => (
          <section className="function-menu-section" key={section.key} aria-label={section.label}>
            <h2 className="function-menu-section-title">{section.label}</h2>
            <div className="function-menu-tools" role="toolbar" aria-label={`${section.label} tools`}>
              {section.actions.map((action) => (
                <FunctionMenuActionButton
                  action={action}
                  busy={busyAction === action.key}
                  key={action.key}
                  onClick={actionHandlers[action.key]}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SideWindowShell>
  );
}
