import { useEffect, type Dispatch, type SetStateAction } from "react";
import { autoRefreshSchedule, shouldRunAutoRefreshTick } from "../lib/autoRefresh";
import { chooseLocalWorkingFolderInElectronNotice } from "../lib/bridgeAvailability";
import { errorMessage, logBridgeWarning } from "../lib/errorMessages";
import type { ActionDialogState } from "../lib/actionDialogView";
import {
  applyPreferences,
  mergePreferences,
  systemThemeFromMediaMatches,
} from "../lib/preferences";
import { dedupeRecentRepositories, maxRecentRepositories } from "../lib/recentRepositories";
import { sanitizeWorkspaceOpenTargets } from "../lib/workspaceOpenTargets";
import type {
  CommitViewSelection,
  RecentRepository,
  SnapshotResponse,
  Theme,
  UiPreferences,
  WorkspaceOpenTarget,
} from "../types";

type RefValue<T> = { current: T };

export function usePreferenceDomEffects({
  preferences,
  theme,
  themePreset,
}: {
  preferences: UiPreferences;
  theme: Theme;
  themePreset: string;
}) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreset = themePreset;
  }, [theme, themePreset]);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);
}

export function useRuntimePreferenceBridge({
  setAvailableWorkspaceTargets,
  setPinned,
  setPreferencesState,
  setSystemTheme,
}: {
  setAvailableWorkspaceTargets: Dispatch<SetStateAction<WorkspaceOpenTarget[]>>;
  setPinned: Dispatch<SetStateAction<boolean>>;
  setPreferencesState: Dispatch<SetStateAction<UiPreferences>>;
  setSystemTheme: Dispatch<SetStateAction<Theme>>;
}) {
  useEffect(() => {
    if (window.gocus) {
      window.gocus.getSystemTheme().then(setSystemTheme).catch((error) => logBridgeWarning("Unable to load system theme.", error));
      window.gocus
        .getPreferences()
        .then((value) => setPreferencesState(mergePreferences(value)))
        .catch((error) => logBridgeWarning("Unable to load preferences.", error));
      window.gocus
        .getAvailableWorkspaceTargets()
        .then((targets) => setAvailableWorkspaceTargets(sanitizeWorkspaceOpenTargets(targets, [])))
        .catch((error) => logBridgeWarning("Unable to load available workspace targets.", error));
      window.gocus.getPinned().then(setPinned).catch((error) => logBridgeWarning("Unable to load pinned state.", error));
      const unsubscribeTheme = window.gocus.onThemeChanged(setSystemTheme);
      const unsubscribePreferences = window.gocus.onPreferencesChanged((value) => setPreferencesState(mergePreferences(value)));
      const unsubscribePinned = window.gocus.onPinnedChanged(setPinned);
      return () => {
        unsubscribeTheme();
        unsubscribePreferences();
        unsubscribePinned();
      };
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => setSystemTheme(systemThemeFromMediaMatches(media.matches));
    handleThemeChange();
    media.addEventListener("change", handleThemeChange);
    return () => media.removeEventListener("change", handleThemeChange);
  }, [setAvailableWorkspaceTargets, setPinned, setPreferencesState, setSystemTheme]);
}

export function useInitialGitData({
  applySnapshotResponse,
  commitView,
  markGitRequest,
  setCollapsed,
  setLoading,
  setNotice,
  setRecentRepositories,
  setRepositoryDialogOpen,
}: {
  applySnapshotResponse: (response: SnapshotResponse, successNotice?: string | null) => void;
  commitView: CommitViewSelection;
  markGitRequest: () => void;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setNotice: (message: string) => void;
  setRecentRepositories: Dispatch<SetStateAction<RecentRepository[]>>;
  setRepositoryDialogOpen: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    if (!window.gocus) {
      setLoading(false);
      setNotice(chooseLocalWorkingFolderInElectronNotice);
      return undefined;
    }

    window.gocus
      .getSnapshot(commitView)
      .then((response) => applySnapshotResponse(response))
      .catch((error) => setNotice(errorMessage(error, "Unable to load Git status.")))
      .finally(() => setLoading(false));
    window.gocus
      .getRecentRepositories()
      .then((repositories) => setRecentRepositories(dedupeRecentRepositories(repositories, maxRecentRepositories)))
      .catch((error) => logBridgeWarning("Unable to load recent repositories.", error));

    const unsubscribeSnapshot = window.gocus.onSnapshotUpdated((response) => {
      markGitRequest();
      applySnapshotResponse(response, response.ok ? "Git data updated from menu." : "Working folder cleared.");
      setLoading(false);
    });
    const unsubscribeCollapsed = window.gocus.onCollapsedChanged(setCollapsed);
    const unsubscribeRepositoryDialog = window.gocus.onRepositoryDialogOpenChanged(setRepositoryDialogOpen);

    return () => {
      unsubscribeSnapshot();
      unsubscribeCollapsed();
      unsubscribeRepositoryDialog();
    };
  }, []);
}

export function useAutoRefreshLoop({
  actionDialog,
  applySnapshotResponse,
  autoRefreshInFlightRef,
  commitView,
  electron,
  hasSnapshot,
  lastGitRequestAtRef,
  markGitRequest,
  preferences,
  refreshing,
  repositoryDialogOpen,
  setNotice,
  setRefreshing,
}: {
  actionDialog: ActionDialogState | null;
  applySnapshotResponse: (response: SnapshotResponse, successNotice?: string | null) => void;
  autoRefreshInFlightRef: RefValue<boolean>;
  commitView: CommitViewSelection;
  electron: boolean;
  hasSnapshot: boolean;
  lastGitRequestAtRef: RefValue<number>;
  markGitRequest: () => void;
  preferences: UiPreferences;
  refreshing: boolean;
  repositoryDialogOpen: boolean;
  setNotice: (message: string) => void;
  setRefreshing: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    const schedule = autoRefreshSchedule({
      interval: preferences.autoRefreshInterval,
      electron,
      hasSnapshot,
      actionDialogOpen: Boolean(actionDialog),
      repositoryDialogOpen,
    });

    if (!schedule.enabled) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      const bridge = window.gocus;
      if (!bridge) return;
      if (
        !shouldRunAutoRefreshTick({
          bridgeAvailable: true,
          inFlight: autoRefreshInFlightRef.current,
          refreshing,
          lastGitRequestAt: lastGitRequestAtRef.current,
          now: Date.now(),
          intervalMs: schedule.intervalMs,
        })
      ) {
        return;
      }

      autoRefreshInFlightRef.current = true;
      setRefreshing(true);

      try {
        const response = await bridge.refresh(commitView);
        applySnapshotResponse(response, response.ok ? null : "Auto refresh failed.");
      } catch (error) {
        setNotice(errorMessage(error, "Auto refresh failed."));
      } finally {
        setRefreshing(false);
        markGitRequest();
        autoRefreshInFlightRef.current = false;
      }
    }, schedule.tickMs);

    return () => window.clearInterval(timer);
  }, [actionDialog, commitView, electron, hasSnapshot, preferences.autoRefreshInterval, refreshing, repositoryDialogOpen]);
}
