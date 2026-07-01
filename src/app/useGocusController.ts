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
import { errorMessage, logBridgeWarning, runBridgeSideEffect } from "../lib/errorMessages";
import { dirtyWorkspaceMergeNotice, snapshotHasUncommittedChanges } from "../lib/mergeGuard";
import { panelPinnedNotice, panelPinnedStateAfterToggle } from "../lib/panelHeaderView";
import { applyPreferences, defaultPreferences, mergePreferences } from "../lib/preferences";
import {
  isSameRecentRepository,
  recentRepositoryFromSnapshot,
  upsertRecentRepository,
} from "../lib/recentRepositories";
import {
  commitViewAfterSnapshotResponse,
  folderWithoutGitAfterSnapshotResponse,
  selectedCommitIdAfterSnapshotResponse,
  snapshotResponseNotice,
} from "../lib/snapshotResponseView";
import { defaultWorkspaceOpenTargets } from "../lib/workspaceOpenTargets";
import type {
  ActionResponse,
  CommitItem,
  CommitSearchResponse,
  CommitViewSelection,
  FolderWithoutGit,
  GitSnapshot,
  RecentRepository,
  SnapshotResponse,
  UiPreferences,
  WorkspaceOpenTarget,
} from "../types";

function isElectronRuntime() {
  return Boolean(window.gocus);
}

export function useGocusController() {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
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
  const [centerSelectedCommitRequest, setCenterSelectedCommitRequest] = useState(0);
  const lastGitRequestAtRef = useRef(Date.now());
  const latestGitRequestIdRef = useRef(0);
  const currentRepositoryPathRef = useRef("");
  const autoRefreshInFlightRef = useRef(false);
  const electron = isElectronRuntime();

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

  function beginGitRequest() {
    markGitRequest();
    latestGitRequestIdRef.current += 1;
    return latestGitRequestIdRef.current;
  }

  function applySnapshotResponse(
    response: SnapshotResponse,
    successNotice: string | null = "Live Git data connected.",
    options: { requestId?: number; allowRepositoryChange?: boolean; adoptSnapshotView?: boolean } = {},
  ) {
    if (options.requestId !== undefined && options.requestId < latestGitRequestIdRef.current) return;
    if (
      response.ok &&
      response.updateSource === "refresh" &&
      !options.allowRepositoryChange &&
      currentRepositoryPathRef.current &&
      response.snapshot.repoPath !== currentRepositoryPathRef.current
    ) {
      return;
    }

    const nextNotice = snapshotResponseNotice(response, successNotice);

    if (response.ok) {
      currentRepositoryPathRef.current = response.snapshot.repoPath;
      setSnapshot(response.snapshot);
      setFolderWithoutGit(null);
      setRecentRepositories((current) => upsertRecentRepository(current, recentRepositoryFromSnapshot(response.snapshot)));
      setCommitViewState((current) => commitViewAfterSnapshotResponse(response, current, options));
      setSelectedCommitId((current) => selectedCommitIdAfterSnapshotResponse(response, current));
      if (nextNotice) setNotice(nextNotice);
      return;
    }

    const nextFolderWithoutGit = folderWithoutGitAfterSnapshotResponse(response);
    if (nextFolderWithoutGit === undefined) return;

    if (response.reason === "not_git_repository") currentRepositoryPathRef.current = response.folder.path;
    if (response.reason === "not_configured") currentRepositoryPathRef.current = "";
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

    const requestId = options.markActivity === false ? undefined : beginGitRequest();
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
      applySnapshotResponse(response, options.silent ? null : successNotice, { requestId });
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

    const requestId = beginGitRequest();
    setLoading(true);
    try {
      const response = await bridge.openRepository(commitView);
      applySnapshotResponse(response, response.ok ? `Opened ${response.snapshot.repoName}.` : undefined, {
        requestId,
        allowRepositoryChange: true,
        adoptSnapshotView: true,
      });
    } catch (error) {
      setNotice(errorMessage(error, "Unable to open repository."));
    } finally {
      setLoading(false);
    }
  }

  async function switchRepository(repositoryPath: string) {
    const bridge = window.gocus;
    if (blockWithNotice(localFolderBridgeNotice("switch", Boolean(bridge))) || !bridge) return;

    const requestId = beginGitRequest();
    setRefreshing(true);
    try {
      const response = await bridge.switchRepository(repositoryPath, commitView);
      applySnapshotResponse(response, response.ok ? `Switched to ${response.snapshot.repoName}.` : "Unable to switch repository.", {
        requestId,
        allowRepositoryChange: true,
        adoptSnapshotView: true,
      });
    } catch (error) {
      setNotice(errorMessage(error, "Unable to switch repository."));
    } finally {
      setRefreshing(false);
    }
  }

  async function removeRecentRepository(repository: RecentRepository) {
    setRecentRepositories((current) => current.filter((entry) => !isSameRecentRepository(entry, repository)));

    try {
      const repositories = await window.gocus?.removeRecentRepository(repository);
      if (repositories) setRecentRepositories(repositories);
    } catch (error) {
      logBridgeWarning("Unable to remove recent repository.", error);
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

    const requestId = beginGitRequest();
    setRefreshing(true);
    try {
      const response = await bridge.getSnapshot(nextView);
      applySnapshotResponse(response, response.ok ? decision.successNotice : "Unable to change commit view.", {
        requestId,
        adoptSnapshotView: true,
      });
    } catch (error) {
      setNotice(errorMessage(error, "Unable to change commit view."));
    } finally {
      setRefreshing(false);
    }
  }

  async function runAction(responseRequest: () => Promise<ActionResponse>, fallbackNotice: string, failureNotice = "Action failed.") {
    const requestId = beginGitRequest();
    try {
      const response = await responseRequest();
      const nextNotice = actionResponseNotice(response, fallbackNotice, failureNotice);
      const nextSnapshot = actionResponseSnapshot(response);

      if (nextSnapshot) {
        applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, nextNotice, { requestId });
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

      const requestId = beginGitRequest();
      let latestResponse: ActionResponse | null = null;

      for (const worktreePath of cleanupPaths) {
        const response = await bridge.cleanupWorktree(worktreePath, commitView);
        latestResponse = response;

        if (!response.ok) {
          const nextNotice = actionResponseNotice(response, "Cleaned up selected worktrees.", "Unable to clean up worktree.");
          const nextSnapshot = actionResponseSnapshot(response);

          if (nextSnapshot) {
            applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, nextNotice, { requestId });
          } else if (nextNotice !== null) {
            setNotice(nextNotice);
          }
          return;
        }
      }

      if (!latestResponse) return;

      const nextSnapshot = actionResponseSnapshot(latestResponse);
      if (nextSnapshot) {
        applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, "Cleaned up selected worktrees.", { requestId });
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

      const requestId = beginGitRequest();
      try {
        const response = await bridge.merge(
          confirmation.ref,
          confirmation.targetBranch,
          commitView,
          { createMergeCommit: preferences.createMergeCommit },
        );
        const nextNotice = actionResponseNotice(response, confirmation.fallbackNotice, confirmation.failureNotice);
        const nextSnapshot = actionResponseSnapshot(response);

        if (response.ok) {
          setActionDialog(null);
          if (nextSnapshot) {
            applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, nextNotice, { requestId });
            return;
          }
          if (nextNotice !== null) setNotice(nextNotice);
          return;
        }

        if (nextSnapshot) applySnapshotResponse({ ok: true, snapshot: nextSnapshot }, null, { requestId });
        setActionDialog((current) => actionDialogAfterMergeError(current, nextNotice ?? confirmation.failureNotice));
      } catch (error) {
        setActionDialog((current) => actionDialogAfterMergeError(current, errorMessage(error, confirmation.failureNotice)));
      }
      return;
    }

    setActionDialog(null);
    await runAction(
      () => bridge.checkout(confirmation.ref, commitView),
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

  function checkForUpdates() {
    setNotice("Checking for updates.");
    runBridgeSideEffect("Unable to check for updates.", () => window.gocus?.checkForUpdates());
  }

  function selectCommit(commitId: string) {
    setSelectedCommitId((current) => selectedCommitIdAfterToggle(current, commitId));
  }

  async function searchCommits(query: string): Promise<CommitSearchResponse> {
    const bridge = window.gocus;
    if (!bridge?.searchCommits) {
      return { ok: false, reason: "action_failed", error: "Commit search is unavailable." };
    }

    try {
      return await bridge.searchCommits(query, commitView);
    } catch (error) {
      return { ok: false, reason: "action_failed", error: errorMessage(error, "Unable to search commits.") };
    }
  }

  async function selectCommitFromSearch(commit: CommitItem) {
    if (snapshot?.commits.some((loadedCommit) => loadedCommit.id === commit.id)) {
      setSelectedCommitId(commit.id);
      setCenterSelectedCommitRequest((current) => current + 1);
      return;
    }

    const bridge = window.gocus;
    if (!bridge?.loadCommitsAround) {
      setSelectedCommitId(commit.id);
      setCenterSelectedCommitRequest((current) => current + 1);
      return;
    }

    const requestId = beginGitRequest();
    setRefreshing(true);

    try {
      const response = await bridge.loadCommitsAround(commit.fullHash, commitView);
      if (!response.ok) {
        setNotice(response.error || "Unable to load commit context.");
        return;
      }

      applySnapshotResponse({ ok: true, snapshot: response.snapshot }, null, { requestId });
      setSelectedCommitId(commit.id);
      setCenterSelectedCommitRequest((current) => current + 1);
    } catch (error) {
      setNotice(errorMessage(error, "Unable to load commit context."));
    } finally {
      setRefreshing(false);
    }
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

  usePreferenceDomEffects({ preferences });
  useRuntimePreferenceBridge({
    setAvailableWorkspaceTargets,
    setPinned,
    setPreferencesState,
  });
  useInitialGitData({
    applySnapshotResponse,
    beginGitRequest,
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
    beginGitRequest,
    collapsed,
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
    loading,
    collapsed,
    pinned,
    refreshing,
    settingsOpen,
    selectedCommitId,
    centerSelectedCommitRequest,
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
    removeRecentRepository,
    initializeRepository,
    refreshSnapshot,
    changeCommitView,
    togglePinned,
    setCollapsedState,
    dockCurrentState,
    checkForUpdates,
    selectCommit,
    selectCommitFromSearch,
    searchCommits,
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
