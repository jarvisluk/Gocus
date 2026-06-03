import { useEffect, useState } from "react";
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
  const [theme, setTheme] = useState<Theme>(getSystemTheme);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [notice, setNotice] = useState("No working folder selected.");
  const [commitView, setCommitViewState] = useState<CommitViewSelection>(defaultView);
  const [preferences, setPreferencesState] = useState<UiPreferences>(defaultPreferences);
  const electron = isElectronRuntime();

  function selectedCommit() {
    return snapshot?.commits.find((commit) => commit.id === selectedCommitId) ?? null;
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
        setNotice("Sample data refreshed.");
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
      const branchName = window.prompt("New branch name", `peek/${commit.hash}`);
      if (!branchName) return;
      await runAction(window.gitPeek.createBranch(branchName, commit.fullHash, commitView), `Created ${branchName}.`);
      return;
    }

    const confirmed = window.confirm(`Checkout commit ${commit.hash}? This can detach HEAD.`);
    if (!confirmed) return;
    await runAction(window.gitPeek.checkout(commit.fullHash, commitView), `Checked out ${commit.hash}.`);
  }

  async function checkoutRef(ref: string) {
    if (!window.gitPeek) {
      setNotice("Electron mode is required for Git actions.");
      return;
    }

    const confirmed = window.confirm(`Checkout ${ref}?`);
    if (!confirmed) return;
    await runAction(window.gitPeek.checkout(ref, { mode: "current" }), `Checked out ${ref}.`);
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
      window.gitPeek.getSystemTheme().then(setTheme);
      window.gitPeek.getPreferences().then((value) => setPreferencesState(mergePreferences(value)));
      return window.gitPeek.onThemeChanged(setTheme);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => setTheme(media.matches ? "dark" : "light");
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

    return () => {
      unsubscribeSnapshot();
      unsubscribeCollapsed();
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
    openWorkspace,
    setPreferences,
    resetPreferences,
    setNotice,
  };
}
