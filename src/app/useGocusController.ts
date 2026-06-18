import { useRef, useState } from "react";
import {
  useAutoRefreshLoop,
  useInitialGitData,
  usePreferenceDomEffects,
  useRuntimePreferenceBridge,
} from "./useControllerEffects";
import {
  actionDialogAfterBranchNameChange,
  actionDialogAfterBranchPrefixChange,
  actionDialogAfterMergeError,
  actionDialogAfterMergeTargetChange,
  actionDialogConfirmation,
  checkoutRefActionDialog,
  commitActionDialog,
  mergeTargetBranchOptions,
  type ActionDialogState,
  type BranchPrefix,
  type CommitAction,
} from "../lib/actionDialogView";
import { actionResponseNotice, actionResponseSnapshot } from "../lib/actionResponseView";
import {
  gitActionBridgeNotice,
  initializeRepositoryAvailabilityNotice,
  localFolderBridgeNotice,
  previewRefreshCompletion,
  refreshSnapshotAvailability,
  workspaceActionAvailabilityNotice,
} from "../lib/bridgeAvailability";
import { selectedCommitFromSnapshot, selectedCommitIdAfterToggle } from "../lib/commitListView";
import { commitViewChangeDecision, defaultCommitView } from "../lib/commitView";
import { errorMessage, runBridgeSideEffect } from "../lib/errorMessages";
import { dirtyWorkspaceMergeNotice, snapshotHasUncommittedChanges } from "../lib/mergeGuard";
import { panelPinnedNotice, panelPinnedStateAfterToggle } from "../lib/panelHeaderView";
import {
  applyPreferences,
  defaultPreferences,
  mergePreferences,
  preferencesDocumentThemeView,
  systemThemeFallback,
} from "../lib/preferences";
import {
  recentRepositoryFromSnapshot,
  upsertRecentRepository,
} from "../lib/recentRepositories";
import {
  folderWithoutGitAfterSnapshotResponse,
  selectedCommitIdAfterSnapshotResponse,
  snapshotResponseNotice,
} from "../lib/snapshotResponseView";
import { defaultWorkspaceOpenTargets } from "../lib/workspaceOpenTargets";
import type {
  ActionResponse,
  CommitItem,
  CommitViewSelection,
  FolderWithoutGit,
  GitSnapshot,
  RecentRepository,
  SnapshotResponse,
  Theme,
  UiPreferences,
  WorkspaceOpenTarget,
} from "../types";

function isElectronRuntime() {
  return Boolean(window.gocus);
}

export function useGocusController() {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [systemTheme, setSystemTheme] = useState<Theme>(systemThemeFallback);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [notice, setNoticeState] = useState("No working folder selected.");
  const [folderWithoutGit, setFolderWithoutGit] = useState<FolderWithoutGit | null>(null);
  const [initializingRepository, setInitializingRepository] = useState(false);
  const [commitView, setCommitViewState] = useState<CommitViewSelection>(defaultCommitView);
  const [preferences, setPreferencesState] = useState<UiPreferences>(defaultPreferences);
  const [availableWorkspaceTargets, setAvailableWorkspaceTargets] = useState<WorkspaceOpenTarget[]>(defaultWorkspaceOpenTargets);
  const [recentRepositories, setRecentRepositories] = useState<RecentRepository[]>([]);
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(null);
  const [repositoryDialogOpen, setRepositoryDialogOpen] = useState(false);
  const lastGitRequestAtRef = useRef(Date.now());
  const autoRefreshInFlightRef = useRef(false);
  const electron = isElectronRuntime();
  const { theme, themePreset } = preferencesDocumentThemeView(preferences, systemTheme);

  function selectedCommit() {
    return selectedCommitFromSnapshot(snapshot, selectedCommitId);
  }

  function setNotice(message: string) {
    if (message.trim()) console.info(`[Gocus] ${message}`);
    setNoticeState(message);
  }

  function markGitRequest() {
    lastGitRequestAtRef.current = Date.now();
  }

  function applySnapshotResponse(response: SnapshotResponse, successNotice: string | null = "Live Git data connected.") {
    const nextNotice = snapshotResponseNotice(response, successNotice);

    if (response.ok) {
      setSnapshot(response.snapshot);
      setFolderWithoutGit(null);
      setRecentRepositories((current) => upsertRecentRepository(current, recentRepositoryFromSnapshot(response.snapshot)));
      setCommitViewState(response.snapshot.view);
      setSelectedCommitId((current) => selectedCommitIdAfterSnapshotResponse(response, current));
      if (nextNotice) setNotice(nextNotice);
      return;
    }

    const nextFolderWithoutGit = folderWithoutGitAfterSnapshotResponse(response);
    if (nextFolderWithoutGit === undefined) return;

    setSnapshot(null);
    setSelectedCommitId((current) => selectedCommitIdAfterSnapshotResponse(response, current));
    setFolderWithoutGit(nextFolderWithoutGit);
    if (nextNotice) setNotice(nextNotice);
  }

  async function refreshSnapshot(
    view = commitView,
    successNotice = "Git status refreshed.",
    options: { silent?: boolean; markActivity?: boolean } = {},
  ) {
    const bridge = window.gocus;
    const availability = refreshSnapshotAvailability({
      bridgeAvailable: Boolean(bridge),
      hasSnapshot: Boolean(snapshot),
    });

    if (availability.kind === "blocked") {
      setNotice(availability.notice);
      return;
    }

    if (options.markActivity !== false) markGitRequest();
    setRefreshing(true);

    if (availability.kind === "preview" || !bridge) {
      const completion = previewRefreshCompletion();
      window.setTimeout(() => {
        setRefreshing(false);
        setNotice(completion.notice);
      }, completion.delayMs);
      return;
    }

    try {
      const response = await bridge.refresh(view);
      applySnapshotResponse(response, options.silent ? null : successNotice);
    } catch (error) {
      setNotice(errorMessage(error, "Unable to refresh Git status."));
    } finally {
      setRefreshing(false);
    }
  }

  function blockWithNotice(nextNotice: string | null) {
    if (!nextNotice) return false;

    setNotice(nextNotice);
    return true;
  }

  async function openRepository() {
    const bridge = window.gocus;
    if (blockWithNotice(localFolderBridgeNotice("open", Boolean(bridge))) || !bridge) return;

    markGitRequest();
    setLoading(true);
    try {
      const response = await bridge.openRepository(commitView);
      applySnapshotResponse(response, response.ok ? `Opened ${response.snapshot.repoName}.` : undefined);
    } catch (error) {
      setNotice(errorMessage(error, "Unable to open repository."));
    } finally {
      setLoading(false);
    }
  }

  async function switchRepository(repositoryPath: string) {
    const bridge = window.gocus;
    if (blockWithNotice(localFolderBridgeNotice("switch", Boolean(bridge))) || !bridge) return;

    markGitRequest();
    setRefreshing(true);
    try {
      const response = await bridge.switchRepository(repositoryPath, commitView);
      applySnapshotResponse(response, response.ok ? `Switched to ${response.snapshot.repoName}.` : "Unable to switch repository.");
    } catch (error) {
      setNotice(errorMessage(error, "Unable to switch repository."));
    } finally {
      setRefreshing(false);
    }
  }

  async function initializeRepository() {
    const bridge = window.gocus;
    const targetFolder = folderWithoutGit;
    const availabilityNotice = initializeRepositoryAvailabilityNotice({
      bridgeAvailable: Boolean(bridge),
      hasFolderWithoutGit: Boolean(targetFolder),
    });
    if (blockWithNotice(availabilityNotice) || !bridge || !targetFolder) return;

    markGitRequest();
    setInitializingRepository(true);
    try {
      await runAction(() => bridge.initializeRepository(targetFolder.path, commitView), "Initialized Git repository.");
    } finally {
      setInitializingRepository(false);
    }
  }

  async function changeCommitView(nextView: CommitViewSelection) {
    const bridge = window.gocus;
    const decision = commitViewChangeDecision({
      currentView: commitView,
      nextView,
      bridgeAvailable: Boolean(bridge),
      hasSnapshot: Boolean(snapshot),
    });

    if (decision.kind === "unchanged") return;

    setCommitViewState(nextView);
    if (decision.kind === "local" || !bridge) {
      if (decision.kind === "local") setNotice(decision.notice);
      return;
    }

    markGitRequest();
    setRefreshing(true);
    try {
      const response = await bridge.getSnapshot(nextView);
      applySnapshotResponse(response, response.ok ? decision.successNotice : "Unable to change commit view.");
    } catch (error) {
      setNotice(errorMessage(error, "Unable to change commit view."));
    } finally {
      setRefreshing(false);
    }
  }

  async function runAction(responseRequest: () => Promise<ActionResponse>, fallbackNotice: string, failureNotice = "Action failed.") {
    markGitRequest();
    try {
      const response = await responseRequest();
      const nextNotice = actionResponseNotice(response, fallbackNotice, failureNotice);
      const nextSnapshot = actionResponseSnapshot(response);

      if (nextSnapshot) {
        applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, nextNotice);
        return;
      }

      if (nextNotice !== null) setNotice(nextNotice);
    } catch (error) {
      setNotice(errorMessage(error, failureNotice));
    }
  }

  function blockGitActionWithoutBridge(bridge = window.gocus) {
    return blockWithNotice(gitActionBridgeNotice(Boolean(bridge)));
  }

  async function handleCommitAction(action: CommitAction, commit: CommitItem) {
    if (blockGitActionWithoutBridge()) return;

    setActionDialog(
      commitActionDialog(action, commit, {
        targetBranches: mergeTargetBranchOptions(snapshot?.branches ?? [], snapshot?.branch.name ?? ""),
      }),
    );
  }

  async function switchBranch(ref: string) {
    if (blockGitActionWithoutBridge()) return;

    setActionDialog(checkoutRefActionDialog(ref));
  }

  async function openWorktree(worktreePath: string) {
    const bridge = window.gocus;
    if (blockGitActionWithoutBridge(bridge) || !bridge) return;

    setRefreshing(true);
    try {
      await runAction(
        () => bridge.openWorktree(worktreePath, commitView),
        "Opened worktree.",
        "Unable to open worktree.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function cleanupWorktrees(worktreePaths: readonly string[]) {
    const bridge = window.gocus;
    if (blockGitActionWithoutBridge(bridge) || !bridge) return;

    const cleanupPaths = Array.from(new Set(worktreePaths.map((worktreePath) => worktreePath.trim()).filter(Boolean)));
    if (!cleanupPaths.length) return;

    setRefreshing(true);
    try {
      if (cleanupPaths.length === 1) {
        await runAction(
          () => bridge.cleanupWorktree(cleanupPaths[0], commitView),
          "Cleaned up worktree.",
          "Unable to clean up worktree.",
        );
        return;
      }

      markGitRequest();
      let latestResponse: ActionResponse | null = null;

      for (const worktreePath of cleanupPaths) {
        const response = await bridge.cleanupWorktree(worktreePath, commitView);
        latestResponse = response;

        if (!response.ok) {
          const nextNotice = actionResponseNotice(response, "Cleaned up selected worktrees.", "Unable to clean up worktree.");
          const nextSnapshot = actionResponseSnapshot(response);

          if (nextSnapshot) {
            applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, nextNotice);
          } else if (nextNotice !== null) {
            setNotice(nextNotice);
          }
          return;
        }
      }

      if (!latestResponse) return;

      const nextSnapshot = actionResponseSnapshot(latestResponse);
      if (nextSnapshot) {
        applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, "Cleaned up selected worktrees.");
      } else {
        setNotice("Cleaned up selected worktrees.");
      }
    } catch (error) {
      setNotice(errorMessage(error, "Unable to clean up worktree."));
    } finally {
      setRefreshing(false);
    }
  }

  async function cleanupWorktree(worktreePath: string) {
    await cleanupWorktrees([worktreePath]);
  }

  function updateActionBranchName(branchName: string) {
    setActionDialog((current) => actionDialogAfterBranchNameChange(current, branchName));
  }

  function updateActionBranchPrefix(branchPrefix: BranchPrefix) {
    setActionDialog((current) => actionDialogAfterBranchPrefixChange(current, branchPrefix));
  }

  function updateActionMergeTarget(targetBranch: string) {
    setActionDialog((current) => actionDialogAfterMergeTargetChange(current, targetBranch));
  }

  function cancelActionDialog() {
    setActionDialog(null);
  }

  async function confirmActionDialog() {
    const bridge = window.gocus;
    if (!bridge || !actionDialog) return;
    const confirmation = actionDialogConfirmation(actionDialog);
    if (!confirmation) return;

    if (confirmation.type === "createBranch") {
      setActionDialog(null);
      await runAction(
        () => bridge.createBranch(confirmation.branchName, confirmation.baseHash, commitView),
        confirmation.fallbackNotice,
        confirmation.failureNotice,
      );
      return;
    }

    if (confirmation.type === "merge") {
      if (snapshotHasUncommittedChanges(snapshot)) {
        setActionDialog((current) => actionDialogAfterMergeError(current, dirtyWorkspaceMergeNotice));
        setNotice(dirtyWorkspaceMergeNotice);
        return;
      }

      markGitRequest();
      try {
        const response = await bridge.merge(
          confirmation.ref,
          confirmation.targetBranch,
          { mode: "current" },
          { createMergeCommit: preferences.createMergeCommit },
        );
        const nextNotice = actionResponseNotice(response, confirmation.fallbackNotice, confirmation.failureNotice);
        const nextSnapshot = actionResponseSnapshot(response);

        if (response.ok) {
          setActionDialog(null);
          if (nextSnapshot) {
            applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, nextNotice);
            return;
          }
          if (nextNotice !== null) setNotice(nextNotice);
          return;
        }

        if (nextSnapshot) applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, null);
        setActionDialog((current) => actionDialogAfterMergeError(current, nextNotice ?? confirmation.failureNotice));
      } catch (error) {
        setActionDialog((current) => actionDialogAfterMergeError(current, errorMessage(error, confirmation.failureNotice)));
      }
      return;
    }

    setActionDialog(null);
    await runAction(
      () => bridge.checkout(confirmation.ref, { mode: "current" }),
      confirmation.fallbackNotice,
      confirmation.failureNotice,
    );
  }

  async function openWorkspace(target: WorkspaceOpenTarget) {
    const bridge = window.gocus;
    const availabilityNotice = workspaceActionAvailabilityNotice({
      bridgeAvailable: Boolean(bridge),
      hasSnapshot: Boolean(snapshot),
    });
    if (blockWithNotice(availabilityNotice) || !bridge || !snapshot) return;

    await runAction(() => bridge.openWorkspace(target), "Workspace opened.", "Unable to open workspace.");
  }

  function togglePinned() {
    const next = panelPinnedStateAfterToggle(pinned);
    setPinned(next);
    runBridgeSideEffect("Unable to update pinned state.", () => window.gocus?.setPinned(next));
    setNotice(panelPinnedNotice(next));
  }

  function setCollapsedState(next: boolean) {
    setCollapsed(next);
    runBridgeSideEffect("Unable to update collapsed state.", () => window.gocus?.setCollapsed(next));
  }

  function dockCurrentState() {
    runBridgeSideEffect("Unable to dock window.", () => window.gocus?.dockToEdge(collapsed));
  }

  function selectCommit(commitId: string) {
    setSelectedCommitId((current) => selectedCommitIdAfterToggle(current, commitId));
  }

  function setPreferences(nextPreferences: UiPreferences) {
    const normalized = mergePreferences(nextPreferences);
    setPreferencesState(normalized);
    applyPreferences(normalized);
    runBridgeSideEffect("Unable to save preferences.", () => window.gocus?.savePreferences(normalized));
  }

  function resetPreferences() {
    setPreferences(defaultPreferences);
  }

  usePreferenceDomEffects({ preferences, theme, themePreset });
  useRuntimePreferenceBridge({
    setAvailableWorkspaceTargets,
    setPinned,
    setPreferencesState,
    setSystemTheme,
  });
  useInitialGitData({
    applySnapshotResponse,
    commitView,
    markGitRequest,
    setCollapsed,
    setLoading,
    setNotice,
    setRecentRepositories,
    setRepositoryDialogOpen,
  });
  useAutoRefreshLoop({
    actionDialog,
    applySnapshotResponse,
    autoRefreshInFlightRef,
    commitView,
    electron,
    hasSnapshot: Boolean(snapshot),
    lastGitRequestAtRef,
    markGitRequest,
    preferences,
    refreshing,
    repositoryDialogOpen,
    setNotice,
    setRefreshing,
  });

  return {
    snapshot,
    selectedCommit: selectedCommit(),
    theme,
    loading,
    collapsed,
    pinned,
    refreshing,
    settingsOpen,
    selectedCommitId,
    notice,
    folderWithoutGit,
    initializingRepository,
    commitView,
    preferences,
    availableWorkspaceTargets,
    recentRepositories,
    actionDialog,
    repositoryDialogOpen,
    electron,
    setSettingsOpen,
    openRepository,
    switchRepository,
    initializeRepository,
    refreshSnapshot,
    changeCommitView,
    togglePinned,
    setCollapsedState,
    dockCurrentState,
    selectCommit,
    handleCommitAction,
    switchBranch,
    openWorktree,
    cleanupWorktree,
    cleanupWorktrees,
    updateActionBranchPrefix,
    updateActionBranchName,
    updateActionMergeTarget,
    cancelActionDialog,
    confirmActionDialog,
    openWorkspace,
    setPreferences,
    resetPreferences,
    setNotice,
  };
}
