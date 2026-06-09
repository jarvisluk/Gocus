import { useEffect, useRef, useState } from "react";
import { branchNameWithPrefix, type ActionDialogState, type BranchPrefix } from "../components/ActionDialog";
import { applyPreferences, defaultPreferences, mergePreferences, resolveThemePreset } from "../lib/preferences";
import { defaultWorkspaceOpenTargets, sanitizeWorkspaceOpenTargets } from "../lib/workspaceOpenTargets";
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

const defaultView: CommitViewSelection = { mode: "all" };
const autoRefreshIntervals: Record<UiPreferences["autoRefreshInterval"], number> = {
  off: 0,
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
};

function isElectronRuntime() {
  return Boolean(window.gitPeek);
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preferences: UiPreferences, systemTheme: Theme): Theme {
  return preferences.themeMode === "system" ? systemTheme : preferences.themeMode;
}

function sameView(left: CommitViewSelection, right: CommitViewSelection) {
  return left.mode === right.mode && (left.ref ?? "") === (right.ref ?? "");
}

function viewLabel(view: CommitViewSelection) {
  if (view.mode === "branch") return view.ref ? `branch ${view.ref}` : "specific branch";
  if (view.mode === "current") return "current branch";
  return "all branches";
}

function pathName(pathValue: string) {
  const trimmed = pathValue.replace(/[\\/]+$/, "");
  return trimmed.split(/[\\/]/).pop() || pathValue;
}

function recentRepositoryFromSnapshot(snapshot: GitSnapshot): RecentRepository {
  return {
    path: snapshot.repoPath,
    name: snapshot.repoName || pathName(snapshot.repoPath),
    repositoryKey: snapshot.repositoryKey,
  };
}

function upsertRecentRepository(repositories: RecentRepository[], repository: RecentRepository) {
  const dedupeKey = repository.repositoryKey || repository.path;
  return [repository, ...repositories.filter((entry) => (entry.repositoryKey || entry.path) !== dedupeKey)].slice(0, 8);
}

export function useGitPeekController() {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [notice, setNoticeState] = useState("No working folder selected.");
  const [folderWithoutGit, setFolderWithoutGit] = useState<FolderWithoutGit | null>(null);
  const [initializingRepository, setInitializingRepository] = useState(false);
  const [commitView, setCommitViewState] = useState<CommitViewSelection>(defaultView);
  const [preferences, setPreferencesState] = useState<UiPreferences>(defaultPreferences);
  const [availableWorkspaceTargets, setAvailableWorkspaceTargets] = useState<WorkspaceOpenTarget[]>(defaultWorkspaceOpenTargets);
  const [recentRepositories, setRecentRepositories] = useState<RecentRepository[]>([]);
  const [actionDialog, setActionDialog] = useState<(ActionDialogState & { commit?: CommitItem; ref?: string }) | null>(null);
  const [repositoryDialogOpen, setRepositoryDialogOpen] = useState(false);
  const lastGitRequestAtRef = useRef(Date.now());
  const autoRefreshInFlightRef = useRef(false);
  const electron = isElectronRuntime();
  const theme = resolveTheme(preferences, systemTheme);

  function selectedCommit() {
    return snapshot?.commits.find((commit) => commit.id === selectedCommitId) ?? null;
  }

  function setNotice(message: string) {
    if (message.trim()) console.info(`[Git Peek] ${message}`);
    setNoticeState(message);
  }

  function markGitRequest() {
    lastGitRequestAtRef.current = Date.now();
  }

  function applySnapshotResponse(response: SnapshotResponse, successNotice: string | null = "Live Git data connected.") {
    if (response.ok) {
      setSnapshot(response.snapshot);
      setFolderWithoutGit(null);
      setRecentRepositories((current) => upsertRecentRepository(current, recentRepositoryFromSnapshot(response.snapshot)));
      setCommitViewState(response.snapshot.view);
      setSelectedCommitId((current) => (current && response.snapshot.commits.some((commit) => commit.id === current) ? current : ""));
      if (successNotice) setNotice(successNotice);
      return;
    }

    if (!response.canceled) {
      setSnapshot(null);
      setSelectedCommitId("");
      if (response.reason === "not_git_repository" && response.folder) {
        setFolderWithoutGit(response.folder);
        setNotice(response.error ?? `${response.folder.name} does not have Git initialized yet.`);
        return;
      }

      setFolderWithoutGit(null);
      setNotice(response.error ?? "Choose a working folder to start.");
    }
  }

  async function refreshSnapshot(view = commitView, successNotice = "Git status refreshed.", options: { silent?: boolean; markActivity?: boolean } = {}) {
    if (!snapshot && !window.gitPeek) {
      setNotice("Run the Electron app to choose a local working folder.");
      return;
    }

    if (options.markActivity !== false) markGitRequest();
    setRefreshing(true);

    if (!window.gitPeek) {
      window.setTimeout(() => {
        setRefreshing(false);
        setNotice("Preview refreshed.");
      }, 400);
      return;
    }

    const response = await window.gitPeek.refresh(view);
    setRefreshing(false);
    applySnapshotResponse(response, options.silent ? null : successNotice);
  }

  async function openRepository() {
    if (!window.gitPeek) {
      setNotice("Electron mode is required to open a local folder.");
      return;
    }

    markGitRequest();
    setLoading(true);
    const response = await window.gitPeek.openRepository(commitView);
    applySnapshotResponse(response, response.ok ? `Opened ${response.snapshot.repoName}.` : undefined);
    setLoading(false);
  }

  async function switchRepository(repositoryPath: string) {
    if (!window.gitPeek) {
      setNotice("Electron mode is required to switch local folders.");
      return;
    }

    markGitRequest();
    setRefreshing(true);
    try {
      const response = await window.gitPeek.switchRepository(repositoryPath, commitView);
      applySnapshotResponse(response, response.ok ? `Switched to ${response.snapshot.repoName}.` : "Unable to switch repository.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to switch repository.");
    } finally {
      setRefreshing(false);
    }
  }

  async function initializeRepository() {
    if (!window.gitPeek || !folderWithoutGit) {
      setNotice("Choose a folder without Git first.");
      return;
    }

    markGitRequest();
    setInitializingRepository(true);
    try {
      await runAction(window.gitPeek.initializeRepository(folderWithoutGit.path, commitView), "Initialized Git repository.");
    } finally {
      setInitializingRepository(false);
    }
  }

  async function changeCommitView(nextView: CommitViewSelection) {
    if (sameView(commitView, nextView)) return;
    setCommitViewState(nextView);
    if (!window.gitPeek || !snapshot) {
      setNotice(`Commit view set to ${viewLabel(nextView)}.`);
      return;
    }

    markGitRequest();
    setRefreshing(true);
    const response = await window.gitPeek.getSnapshot(nextView);
    setRefreshing(false);
    applySnapshotResponse(response, response.ok ? `Showing ${viewLabel(nextView)}.` : "Unable to change commit view.");
  }

  async function runAction(responsePromise: Promise<ActionResponse>, fallbackNotice: string) {
    markGitRequest();
    const response = await responsePromise;
    if (response.ok) {
      if (response.snapshot) {
        applySnapshotResponse({ ok: true, snapshot: response.snapshot }, response.message ?? fallbackNotice);
      } else {
        setNotice(response.message ?? fallbackNotice);
      }
      return;
    }

    if (!response.canceled) setNotice(response.error ?? "Action failed.");
  }

  async function handleCommitAction(action: "branch" | "checkout", commit: CommitItem) {
    if (!window.gitPeek) {
      setNotice("Electron mode is required for Git actions.");
      return;
    }

    if (action === "branch") {
      setActionDialog({
        type: "createBranch",
        title: "Create branch",
        body: `Start a new branch from ${commit.hash}.`,
        branchPrefix: "none",
        branchName: commit.hash,
        commit,
      });
      return;
    }

    setActionDialog({
      type: "checkout",
      title: "Checkout commit",
      body: `Checkout ${commit.hash}. This can detach HEAD.`,
      ref: commit.fullHash,
    });
  }

  async function checkoutRef(ref: string) {
    if (!window.gitPeek) {
      setNotice("Electron mode is required for Git actions.");
      return;
    }

    setActionDialog({
      type: "checkout",
      title: "Checkout branch",
      body: `Switch the working folder to ${ref}.`,
      ref,
    });
  }

  async function openWorktree(worktreePath: string) {
    if (!window.gitPeek) {
      setNotice("Electron mode is required for Git actions.");
      return;
    }

    setRefreshing(true);
    try {
      await runAction(window.gitPeek.openWorktree(worktreePath, { mode: "current" }), "Opened worktree.");
    } finally {
      setRefreshing(false);
    }
  }

  function updateActionBranchName(branchName: string) {
    setActionDialog((current) => (current?.type === "createBranch" ? { ...current, branchName } : current));
  }

  function updateActionBranchPrefix(branchPrefix: BranchPrefix) {
    setActionDialog((current) => (current?.type === "createBranch" ? { ...current, branchPrefix } : current));
  }

  function cancelActionDialog() {
    setActionDialog(null);
  }

  async function confirmActionDialog() {
    if (!window.gitPeek || !actionDialog) return;
    const currentDialog = actionDialog;
    setActionDialog(null);

    if (currentDialog.type === "createBranch" && currentDialog.commit) {
      const branchName = branchNameWithPrefix(currentDialog.branchPrefix, currentDialog.branchName);
      if (!branchName) return;
      await runAction(window.gitPeek.createBranch(branchName, currentDialog.commit.fullHash, commitView), `Created ${branchName}.`);
      return;
    }

    if (currentDialog.type === "checkout" && currentDialog.ref) {
      await runAction(window.gitPeek.checkout(currentDialog.ref, { mode: "current" }), "Checkout complete.");
    }
  }

  async function openWorkspace(target: WorkspaceOpenTarget) {
    if (!window.gitPeek || !snapshot) {
      setNotice("Choose a working folder first.");
      return;
    }

    const response = await window.gitPeek.openWorkspace(target);
    if (response.ok) {
      setNotice(response.message ?? "Workspace opened.");
    } else {
      setNotice(response.error ?? "Unable to open workspace.");
    }
  }

  function togglePinned() {
    const next = !pinned;
    setPinned(next);
    window.gitPeek?.setPinned(next);
    setNotice(next ? "Panel pinned above other windows." : "Panel unpinned.");
  }

  function setCollapsedState(next: boolean) {
    setCollapsed(next);
    window.gitPeek?.setCollapsed(next);
  }

  function dockCurrentState() {
    window.gitPeek?.dockToEdge(collapsed);
  }

  function selectCommit(commitId: string) {
    setSelectedCommitId((current) => (current === commitId ? "" : commitId));
  }

  function setPreferences(nextPreferences: UiPreferences) {
    const normalized = mergePreferences(nextPreferences);
    setPreferencesState(normalized);
    applyPreferences(normalized);
    window.gitPeek?.savePreferences(normalized);
  }

  function resetPreferences() {
    setPreferences(defaultPreferences);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreset = resolveThemePreset(preferences, theme);
  }, [preferences.darkThemePreset, preferences.lightThemePreset, theme]);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (window.gitPeek) {
      window.gitPeek.getSystemTheme().then(setSystemTheme);
      window.gitPeek.getPreferences().then((value) => setPreferencesState(mergePreferences(value)));
      window.gitPeek.getAvailableWorkspaceTargets().then((targets) => setAvailableWorkspaceTargets(sanitizeWorkspaceOpenTargets(targets, [])));
      const unsubscribeTheme = window.gitPeek.onThemeChanged(setSystemTheme);
      const unsubscribePreferences = window.gitPeek.onPreferencesChanged((value) => setPreferencesState(mergePreferences(value)));
      return () => {
        unsubscribeTheme();
        unsubscribePreferences();
      };
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => setSystemTheme(media.matches ? "dark" : "light");
    handleThemeChange();
    media.addEventListener("change", handleThemeChange);
    return () => media.removeEventListener("change", handleThemeChange);
  }, []);

  useEffect(() => {
    if (!window.gitPeek) {
      setLoading(false);
      setNotice("Run the Electron app to choose a local working folder.");
      return;
    }

    window.gitPeek.getSnapshot(commitView).then((response) => {
      applySnapshotResponse(response);
      setLoading(false);
    });
    window.gitPeek.getRecentRepositories().then(setRecentRepositories);

    const unsubscribeSnapshot = window.gitPeek.onSnapshotUpdated((response) => {
      markGitRequest();
      applySnapshotResponse(response, response.ok ? "Git data updated from menu." : "Working folder cleared.");
      setLoading(false);
    });
    const unsubscribeCollapsed = window.gitPeek.onCollapsedChanged(setCollapsed);
    const unsubscribeRepositoryDialog = window.gitPeek.onRepositoryDialogOpenChanged(setRepositoryDialogOpen);

    return () => {
      unsubscribeSnapshot();
      unsubscribeCollapsed();
      unsubscribeRepositoryDialog();
    };
  }, []);

  useEffect(() => {
    const intervalMs = autoRefreshIntervals[preferences.autoRefreshInterval];
    if (!intervalMs || !electron || !snapshot || actionDialog || repositoryDialogOpen) return undefined;

    const tickMs = Math.min(intervalMs, 30_000);
    const timer = window.setInterval(async () => {
      if (!window.gitPeek || autoRefreshInFlightRef.current || refreshing) return;
      if (Date.now() - lastGitRequestAtRef.current < intervalMs) return;

      autoRefreshInFlightRef.current = true;
      setRefreshing(true);

      try {
        const response = await window.gitPeek.refresh(commitView);
        applySnapshotResponse(response, response.ok ? null : "Auto refresh failed.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Auto refresh failed.");
      } finally {
        setRefreshing(false);
        markGitRequest();
        autoRefreshInFlightRef.current = false;
      }
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [actionDialog, commitView, electron, preferences.autoRefreshInterval, refreshing, repositoryDialogOpen, snapshot]);

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
    cancelActionDialog,
    confirmActionDialog,
    openWorkspace,
    setPreferences,
    resetPreferences,
    setNotice,
  };
}
