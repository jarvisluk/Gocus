import type {
  ActionResponse,
  ChangedFileInfoPayload,
  CommitContextResponse,
  CommitInfoPayload,
  CommitSearchResponse,
  CommitViewSelection,
  FunctionMenuPayload,
  GitBranchState,
  MergeOptions,
  RecentRepository,
  TemporaryInfoPayload,
  UiPreferences,
  WorkspaceOpenMenuPayload,
  WorkspaceOpenTarget,
} from "../types";
import { gitHubReleasesUrl } from "./releaseLinks";
import { defaultWorkspaceOpenTarget, defaultWorkspaceOpenTargets } from "./workspaceOpenTargets";

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
  if (window.gocus || !isLocalDevBrowser()) return;

  let temporaryInfoPayload: TemporaryInfoPayload = null;
  let changedFileInfoPayload: ChangedFileInfoPayload = null;
  let commitInfoPayload: CommitInfoPayload = null;
  let functionMenuPayload: FunctionMenuPayload = null;
  let activeWorkspaceTarget: WorkspaceOpenTarget = defaultWorkspaceOpenTarget;
  const temporaryInfoCallbacks = new Set<(payload: TemporaryInfoPayload) => void>();
  const changedFileInfoCallbacks = new Set<(payload: ChangedFileInfoPayload) => void>();
  const commitInfoCallbacks = new Set<(payload: CommitInfoPayload) => void>();
  const functionMenuCallbacks = new Set<(payload: FunctionMenuPayload) => void>();

  window.gocus = {
    openRepository: (view?: CommitViewSelection) => requestBridge("openRepository", { view }),
    switchRepository: (repositoryPath: string, view?: CommitViewSelection) =>
      requestBridge("switchRepository", { repositoryPath, view }),
    getRecentRepositories: () => requestBridge("getRecentRepositories"),
    removeRecentRepository: (repository: RecentRepository) => requestBridge("removeRecentRepository", { repository }),
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
    pushCurrentBranch: (view?: CommitViewSelection) => requestBridge("pushCurrentBranch", { view }),
    pullCurrentBranch: (view?: CommitViewSelection) => requestBridge("pullCurrentBranch", { view }),
    fetchRemotes: (view?: CommitViewSelection) => requestBridge("fetchRemotes", { view }),
    openRepositoryRemote: async () => {
      const response = await requestBridge<ActionResponse & { url?: string }>("openRepositoryRemote");
      if (response.ok && response.url) window.open(response.url, "_blank", "noopener,noreferrer");
      return response;
    },
    openWorktree: (worktreePath: string, view?: CommitViewSelection) => requestBridge("openWorktree", { worktreePath, view }),
    cleanupWorktree: (worktreePath: string, view?: CommitViewSelection) =>
      requestBridge("cleanupWorktree", { worktreePath, view }),
    openWorkspace: (target: WorkspaceOpenTarget) => requestBridge("openWorkspace", { target }),
    openWorkspaceFile: (target: WorkspaceOpenTarget, filePath: string) => requestBridge("openWorkspaceFile", { target, filePath }),
    checkForUpdates: () => requestBridge("checkForUpdates"),
    searchCommits: (query: string, view?: CommitViewSelection) =>
      requestBridge<CommitSearchResponse>("searchCommits", { query, view }),
    loadCommitsAround: (commitHash: string, view?: CommitViewSelection) =>
      requestBridge<CommitContextResponse>("loadCommitsAround", { commitHash, view }),
    getAvailableWorkspaceTargets: () => requestBridge("getAvailableWorkspaceTargets"),
    getActiveWorkspaceTarget: async () => requestBridge<WorkspaceOpenTarget>("getActiveWorkspaceTarget"),
    setActiveWorkspaceTarget: async (target: WorkspaceOpenTarget) => {
      activeWorkspaceTarget = await requestBridge("setActiveWorkspaceTarget", { target });
      return activeWorkspaceTarget;
    },
    openWorkspaceFileMenu: async (_payload: WorkspaceOpenMenuPayload) => {},
    openGitHubReleases: async () => {
      window.open(gitHubReleasesUrl, "_blank", "noopener,noreferrer");
    },
    getPreferences: () => requestBridge("getPreferences"),
    savePreferences: (preferences: UiPreferences) => requestBridge("savePreferences", { preferences }),
    getCollapsed: async () => false,
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
    getFunctionMenuPayload: async () => {
      if (functionMenuPayload) return functionMenuPayload;

      const response = await requestBridge<{
        ok: boolean;
        snapshot?: {
          repoName: string;
          repoPath: string;
          branch: GitBranchState;
          changedFiles: unknown[];
          worktrees: unknown[];
        };
      }>("getSnapshot", { view: { mode: "all" } });
      if (!response.ok || !response.snapshot) return null;

      return {
        kind: "function-menu",
        repository: {
          repoName: response.snapshot.repoName,
          repoPath: response.snapshot.repoPath,
          branch: response.snapshot.branch,
          changedFileCount: response.snapshot.changedFiles.length,
          worktreeCount: response.snapshot.worktrees.length,
        },
        activeWorkspaceTarget,
        availableWorkspaceTargets: await requestBridge<WorkspaceOpenTarget[]>("getAvailableWorkspaceTargets"),
        enabledWorkspaceTargets: defaultWorkspaceOpenTargets,
      };
    },
    setFunctionMenuPanel: async (payload: FunctionMenuPayload) => {
      functionMenuPayload = payload;
      setPayload(payload, functionMenuCallbacks);
    },
    setFunctionMenuPanelHeight: async (_height: number) => {},
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
    onTemporaryInfoPayloadUpdated: (callback) => {
      temporaryInfoCallbacks.add(callback);
      return () => temporaryInfoCallbacks.delete(callback);
    },
    onTemporaryInfoPanelClosed: () => noopUnsubscribe,
    onFunctionMenuPayloadUpdated: (callback) => {
      functionMenuCallbacks.add(callback);
      return () => functionMenuCallbacks.delete(callback);
    },
    onFunctionMenuPanelClosed: () => noopUnsubscribe,
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
    onPreferencesChanged: () => noopUnsubscribe,
    onActiveWorkspaceTargetChanged: () => noopUnsubscribe,
    onSnapshotUpdated: () => noopUnsubscribe,
    onCollapsedChanged: () => noopUnsubscribe,
    onPinnedChanged: () => noopUnsubscribe,
    onRepositoryDialogOpenChanged: () => noopUnsubscribe,
  };
}
