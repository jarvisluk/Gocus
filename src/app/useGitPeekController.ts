import { useEffect, useState } from "react";
import type { ActionDialogState } from "../components/ActionDialog";
import { applyPreferences, defaultPreferences, mergePreferences } from "../lib/preferences";
import type { ActionResponse, CommitItem, CommitViewSelection, FileFilter, GitSnapshot, SnapshotResponse, Theme, UiPreferences, WorkspaceOpenTarget } from "../types";

const defaultView: CommitViewSelection = { mode: "auto" };

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
  if (view.mode === "all") return "all branches";
  return "auto view";
}

export function useGitPeekController() {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [notice, setNoticeState] = useState("No working folder selected.");
  const [commitView, setCommitViewState] = useState<CommitViewSelection>(defaultView);
  const [preferences, setPreferencesState] = useState<UiPreferences>(defaultPreferences);
  const [actionDialog, setActionDialog] = useState<(ActionDialogState & { commit?: CommitItem; ref?: string }) | null>(null);
  const [repositoryDialogOpen, setRepositoryDialogOpen] = useState(false);
  const electron = isElectronRuntime();
  const theme = resolveTheme(preferences, systemTheme);

  function selectedCommit() {
    return snapshot?.commits.find((commit) => commit.id === selectedCommitId) ?? null;
  }

  function setNotice(message: string) {
    if (message.trim()) console.info(`[Git Peek] ${message}`);
    setNoticeState(message);
  }

  function applySnapshotResponse(response: SnapshotResponse, successNotice = "Live Git data connected.") {
    if (response.ok) {
      setSnapshot(response.snapshot);
      setCommitViewState(response.snapshot.view);
      setSelectedCommitId((current) => (current && response.snapshot.commits.some((commit) => commit.id === current) ? current : ""));
      setNotice(successNotice);
      return;
    }

    if (!response.canceled) {
      setSnapshot(null);
      setSelectedCommitId("");
      setNotice(response.error ?? "Choose a working folder to start.");
    }
  }

  async function refreshSnapshot(view = commitView, successNotice = "Git status refreshed.") {
    if (!snapshot && !window.gitPeek) {
      setNotice("Run the Electron app to choose a local working folder.");
      return;
    }

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
    applySnapshotResponse(response, successNotice);
  }

  async function openRepository() {
    if (!window.gitPeek) {
      setNotice("Electron mode is required to open a local folder.");
      return;
    }

    setLoading(true);
    const response = await window.gitPeek.openRepository(commitView);
    applySnapshotResponse(response, response.ok ? `Opened ${response.snapshot.repoName}.` : undefined);
    setLoading(false);
  }

  async function changeCommitView(nextView: CommitViewSelection) {
    if (sameView(commitView, nextView)) return;
    setCommitViewState(nextView);
    if (!window.gitPeek || !snapshot) {
      setNotice(`Commit view set to ${viewLabel(nextView)}.`);
      return;
    }

    setRefreshing(true);
    const response = await window.gitPeek.getSnapshot(nextView);
    setRefreshing(false);
    applySnapshotResponse(response, response.ok ? `Showing ${viewLabel(nextView)}.` : "Unable to change commit view.");
  }

  async function runAction(responsePromise: Promise<ActionResponse>, fallbackNotice: string) {
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

  async function handleCommitAction(action: "compare" | "branch" | "checkout", commit: CommitItem) {
    if (!window.gitPeek) {
      setNotice("Electron mode is required for Git actions.");
      return;
    }

    if (action === "compare") {
      setNotice(`${commit.hash} selected for compare. Full graph diff is next on the roadmap.`);
      return;
    }

    if (action === "branch") {
      setActionDialog({
        type: "createBranch",
        title: "Create branch",
        body: `Start a new branch from ${commit.hash}.`,
        branchName: `peek/${commit.hash}`,
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
      await runAction(window.gitPeek.openWorktree(worktreePath, { mode: "current" }), "Opened detached worktree.");
    } finally {
      setRefreshing(false);
    }
  }

  function updateActionBranchName(branchName: string) {
    setActionDialog((current) => (current?.type === "createBranch" ? { ...current, branchName } : current));
  }

  function cancelActionDialog() {
    setActionDialog(null);
  }

  async function confirmActionDialog() {
    if (!window.gitPeek || !actionDialog) return;
    const currentDialog = actionDialog;
    setActionDialog(null);

    if (currentDialog.type === "createBranch" && currentDialog.commit) {
      const branchName = currentDialog.branchName.trim();
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
  }, [theme]);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (window.gitPeek) {
      window.gitPeek.getSystemTheme().then(setSystemTheme);
      window.gitPeek.getPreferences().then((value) => setPreferencesState(mergePreferences(value)));
      return window.gitPeek.onThemeChanged(setSystemTheme);
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

    const unsubscribeSnapshot = window.gitPeek.onSnapshotUpdated((response) => {
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

  return {
    snapshot,
    selectedCommit: selectedCommit(),
    theme,
    loading,
    collapsed,
    pinned,
    refreshing,
    settingsOpen,
    fileFilter,
    selectedCommitId,
    notice,
    commitView,
    preferences,
    actionDialog,
    repositoryDialogOpen,
    electron,
    setFileFilter,
    setSettingsOpen,
    openRepository,
    refreshSnapshot,
    changeCommitView,
    togglePinned,
    setCollapsedState,
    dockCurrentState,
    selectCommit,
    handleCommitAction,
    checkoutRef,
    openWorktree,
    updateActionBranchName,
    cancelActionDialog,
    confirmActionDialog,
    openWorkspace,
    setPreferences,
    resetPreferences,
    setNotice,
  };
}
