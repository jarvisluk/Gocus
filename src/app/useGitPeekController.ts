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
  return Boolean(window.gitPeek);
}

export function useGitPeekController() {
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
    if (message.trim()) console.info(`[Git Peek] ${message}`);
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
    const bridge = window.gitPeek;
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
    const bridge = window.gitPeek;
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
    const bridge = window.gitPeek;
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
    const bridge = window.gitPeek;
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
    const bridge = window.gitPeek;
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

  function blockGitActionWithoutBridge(bridge = window.gitPeek) {
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

  async function checkoutRef(ref: string) {
    if (blockGitActionWithoutBridge()) return;

    setActionDialog(checkoutRefActionDialog(ref));
  }

  async function openWorktree(worktreePath: string) {
    const bridge = window.gitPeek;
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
    const bridge = window.gitPeek;
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
    const bridge = window.gitPeek;
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
    runBridgeSideEffect("Unable to update pinned state.", () => window.gitPeek?.setPinned(next));
    setNotice(panelPinnedNotice(next));
  }

  function setCollapsedState(next: boolean) {
    setCollapsed(next);
    runBridgeSideEffect("Unable to update collapsed state.", () => window.gitPeek?.setCollapsed(next));
  }

  function dockCurrentState() {
    runBridgeSideEffect("Unable to dock window.", () => window.gitPeek?.dockToEdge(collapsed));
  }

  function selectCommit(commitId: string) {
    setSelectedCommitId((current) => selectedCommitIdAfterToggle(current, commitId));
  }

  function setPreferences(nextPreferences: UiPreferences) {
    const normalized = mergePreferences(nextPreferences);
    setPreferencesState(normalized);
    applyPreferences(normalized);
    runBridgeSideEffect("Unable to save preferences.", () => window.gitPeek?.savePreferences(normalized));
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
    checkoutRef,
    openWorktree,
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
