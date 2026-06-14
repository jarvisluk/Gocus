import type {
  ChangedFileInfoPayload,
  CommitInfoPayload,
  CommitViewSelection,
  MergeOptions,
  TemporaryInfoPayload,
  UiPreferences,
  WorkspaceOpenMenuPayload,
  WorkspaceOpenTarget,
} from "../types";

const bridgePrefix = "/__git_peek_dev_bridge";
const localHostnames = new Set(["localhost", "127.0.0.1"]);
const noopUnsubscribe = () => {};

export function isLocalDevBridgeHost(hostname: string) {
  return localHostnames.has(hostname);
}

export function devWebBridgeUrl(route: string) {
  return `${bridgePrefix}/${route}`;
}

function isLocalDevBrowser() {
  return isLocalDevBridgeHost(window.location.hostname);
}

async function requestBridge<T>(route: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(devWebBridgeUrl(route), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Dev bridge request failed with ${response.status}.`);
  return response.json() as Promise<T>;
}

function setPayload<T>(nextPayload: T, callbacks: Set<(payload: T) => void>) {
  for (const callback of callbacks) callback(nextPayload);
}

export function installDevWebBridge() {
  if (window.gitPeek || !isLocalDevBrowser()) return;

  let temporaryInfoPayload: TemporaryInfoPayload = null;
  let changedFileInfoPayload: ChangedFileInfoPayload = null;
  let commitInfoPayload: CommitInfoPayload = null;
  let activeWorkspaceTarget: WorkspaceOpenTarget = "cursor";
  const temporaryInfoCallbacks = new Set<(payload: TemporaryInfoPayload) => void>();
  const changedFileInfoCallbacks = new Set<(payload: ChangedFileInfoPayload) => void>();
  const commitInfoCallbacks = new Set<(payload: CommitInfoPayload) => void>();

  window.gitPeek = {
    openRepository: (view?: CommitViewSelection) => requestBridge("openRepository", { view }),
    switchRepository: (repositoryPath: string, view?: CommitViewSelection) =>
      requestBridge("switchRepository", { repositoryPath, view }),
    getRecentRepositories: () => requestBridge("getRecentRepositories"),
    refresh: (view?: CommitViewSelection) => requestBridge("refresh", { view }),
    getSnapshot: (view?: CommitViewSelection) => requestBridge("getSnapshot", { view }),
    clearRepository: () => requestBridge("clearRepository"),
    initializeRepository: (repositoryPath: string, view?: CommitViewSelection) =>
      requestBridge("initializeRepository", { repositoryPath, view }),
    createBranch: (branchName: string, startPoint: string, view?: CommitViewSelection) =>
      requestBridge("createBranch", { branchName, startPoint, view }),
    merge: (ref: string, targetBranch: string, view?: CommitViewSelection, options?: MergeOptions) =>
      requestBridge("merge", { ref, targetBranch, view, options }),
    checkout: (ref: string, view?: CommitViewSelection) => requestBridge("checkout", { ref, view }),
    openWorktree: (worktreePath: string, view?: CommitViewSelection) => requestBridge("openWorktree", { worktreePath, view }),
    cleanupWorktree: (worktreePath: string, view?: CommitViewSelection) =>
      requestBridge("cleanupWorktree", { worktreePath, view }),
    openWorkspace: (target: WorkspaceOpenTarget) => requestBridge("openWorkspace", { target }),
    openWorkspaceFile: (target: WorkspaceOpenTarget, filePath: string) => requestBridge("openWorkspaceFile", { target, filePath }),
    getAvailableWorkspaceTargets: () => requestBridge("getAvailableWorkspaceTargets"),
    getActiveWorkspaceTarget: async () => requestBridge<WorkspaceOpenTarget>("getActiveWorkspaceTarget"),
    setActiveWorkspaceTarget: async (target: WorkspaceOpenTarget) => {
      activeWorkspaceTarget = await requestBridge("setActiveWorkspaceTarget", { target });
      return activeWorkspaceTarget;
    },
    openWorkspaceFileMenu: async (_payload: WorkspaceOpenMenuPayload) => {},
    getPreferences: () => requestBridge("getPreferences"),
    savePreferences: (preferences: UiPreferences) => requestBridge("savePreferences", { preferences }),
    setCollapsed: async (_collapsed: boolean) => {},
    setCollapsedRailHeight: async (_height: number) => {},
    getPinned: async () => false,
    setPinned: async (_pinned: boolean) => {},
    dockToEdge: async (_collapsed: boolean) => {},
    getTemporaryInfoPayload: async () => temporaryInfoPayload,
    setTemporaryInfoPanel: async (payload: TemporaryInfoPayload) => {
      temporaryInfoPayload = payload;
      setPayload(payload, temporaryInfoCallbacks);
    },
    getChangedFileInfoPayload: async () => changedFileInfoPayload,
    setChangedFileInfoPanel: async (payload: ChangedFileInfoPayload) => {
      changedFileInfoPayload = payload;
      setPayload(payload, changedFileInfoCallbacks);
    },
    getCommitInfoPayload: async () => commitInfoPayload,
    setCommitInfoPanel: async (payload: CommitInfoPayload) => {
      commitInfoPayload = payload;
      setPayload(payload, commitInfoCallbacks);
    },
    holdCommitInfoPanelInteraction: async (_durationMs?: number) => {},
    isCommitInfoPanelActive: async () => false,
    setCommitInfoPanelHeight: async (_height: number) => {},
    copyText: async (text: string) => navigator.clipboard?.writeText(text),
    readText: async () => navigator.clipboard?.readText() ?? "",
    getSystemTheme: async () => (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
    onTemporaryInfoPayloadUpdated: (callback) => {
      temporaryInfoCallbacks.add(callback);
      return () => temporaryInfoCallbacks.delete(callback);
    },
    onTemporaryInfoPanelClosed: () => noopUnsubscribe,
    onChangedFileInfoPayloadUpdated: (callback) => {
      changedFileInfoCallbacks.add(callback);
      return () => changedFileInfoCallbacks.delete(callback);
    },
    onChangedFileInfoPanelClosed: () => noopUnsubscribe,
    onCommitInfoPayloadUpdated: (callback) => {
      commitInfoCallbacks.add(callback);
      return () => commitInfoCallbacks.delete(callback);
    },
    onCommitInfoPanelClosed: () => noopUnsubscribe,
    onThemeChanged: () => noopUnsubscribe,
    onPreferencesChanged: () => noopUnsubscribe,
    onActiveWorkspaceTargetChanged: () => noopUnsubscribe,
    onSnapshotUpdated: () => noopUnsubscribe,
    onCollapsedChanged: () => noopUnsubscribe,
    onPinnedChanged: () => noopUnsubscribe,
    onRepositoryDialogOpenChanged: () => noopUnsubscribe,
  };
}
