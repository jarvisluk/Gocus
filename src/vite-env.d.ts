/// <reference types="vite/client" />

import type {
  ActionResponse,
  ChangedFileInfoPayload,
  CommitInfoPayload,
  CommitViewSelection,
  MergeOptions,
  RecentRepository,
  SnapshotResponse,
  TemporaryInfoPayload,
  UiPreferences,
  WorkspaceOpenMenuPayload,
  WorkspaceOpenTarget,
} from "./types";

declare global {
  interface Window {
    gocus?: {
      openRepository: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      switchRepository: (repositoryPath: string, view?: CommitViewSelection) => Promise<SnapshotResponse>;
      getRecentRepositories: () => Promise<RecentRepository[]>;
      refresh: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      getSnapshot: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      clearRepository: () => Promise<SnapshotResponse>;
      initializeRepository: (repositoryPath: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      createBranch: (branchName: string, startPoint: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      merge: (
        ref: string,
        targetBranch: string,
        view?: CommitViewSelection,
        options?: MergeOptions,
      ) => Promise<ActionResponse>;
      checkout: (ref: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      openWorktree: (worktreePath: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      cleanupWorktree: (worktreePath: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      openWorkspace: (target: WorkspaceOpenTarget) => Promise<ActionResponse>;
      openWorkspaceFile: (target: WorkspaceOpenTarget, filePath: string) => Promise<ActionResponse>;
      checkForUpdates: () => Promise<unknown>;
      getAvailableWorkspaceTargets: () => Promise<WorkspaceOpenTarget[]>;
      getActiveWorkspaceTarget: () => Promise<WorkspaceOpenTarget>;
      setActiveWorkspaceTarget: (target: WorkspaceOpenTarget) => Promise<WorkspaceOpenTarget>;
      openWorkspaceFileMenu: (payload: WorkspaceOpenMenuPayload) => Promise<void>;
      openGitHubReleases?: () => Promise<void>;
      getPreferences: () => Promise<UiPreferences>;
      savePreferences: (preferences: UiPreferences) => Promise<void>;
      setCollapsed: (collapsed: boolean) => Promise<void>;
      setCollapsedRailHeight?: (height: number) => Promise<void>;
      getPinned: () => Promise<boolean>;
      setPinned: (pinned: boolean) => Promise<void>;
      dockToEdge: (collapsed: boolean) => Promise<void>;
      getTemporaryInfoPayload: () => Promise<TemporaryInfoPayload>;
      setTemporaryInfoPanel: (payload: TemporaryInfoPayload) => Promise<void>;
      getChangedFileInfoPayload: () => Promise<ChangedFileInfoPayload>;
      setChangedFileInfoPanel: (payload: ChangedFileInfoPayload) => Promise<void>;
      getCommitInfoPayload: () => Promise<CommitInfoPayload>;
      setCommitInfoPanel: (payload: CommitInfoPayload) => Promise<void>;
      holdCommitInfoPanelInteraction?: (durationMs?: number) => Promise<void>;
      isCommitInfoPanelActive?: () => Promise<boolean>;
      setCommitInfoPanelHeight?: (height: number) => Promise<void>;
      copyText: (text: string) => Promise<void>;
      readText?: () => Promise<string>;
      getSystemTheme: () => Promise<"light" | "dark">;
      onTemporaryInfoPayloadUpdated: (callback: (payload: TemporaryInfoPayload) => void) => () => void;
      onTemporaryInfoPanelClosed: (callback: () => void) => () => void;
      onChangedFileInfoPayloadUpdated: (callback: (payload: ChangedFileInfoPayload) => void) => () => void;
      onChangedFileInfoPanelClosed: (callback: () => void) => () => void;
      onCommitInfoPayloadUpdated: (callback: (payload: CommitInfoPayload) => void) => () => void;
      onCommitInfoPanelClosed: (callback: () => void) => () => void;
      onThemeChanged: (callback: (theme: "light" | "dark") => void) => () => void;
      onPreferencesChanged: (callback: (preferences: UiPreferences) => void) => () => void;
      onActiveWorkspaceTargetChanged: (callback: (target: WorkspaceOpenTarget) => void) => () => void;
      onSnapshotUpdated: (callback: (response: SnapshotResponse) => void) => () => void;
      onCollapsedChanged: (callback: (collapsed: boolean) => void) => () => void;
      onPinnedChanged: (callback: (pinned: boolean) => void) => () => void;
      onRepositoryDialogOpenChanged: (callback: (open: boolean) => void) => () => void;
    };
  }
}

export {};
