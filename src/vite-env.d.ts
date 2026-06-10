/// <reference types="vite/client" />

import type {
  ActionResponse,
  CommitViewSelection,
  RecentRepository,
  SnapshotResponse,
  TemporaryInfoPayload,
  UiPreferences,
  WorkspaceOpenTarget,
} from "./types";

declare global {
  interface Window {
    gitPeek?: {
      openRepository: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      switchRepository: (repositoryPath: string, view?: CommitViewSelection) => Promise<SnapshotResponse>;
      getRecentRepositories: () => Promise<RecentRepository[]>;
      refresh: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      getSnapshot: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      clearRepository: () => Promise<SnapshotResponse>;
      initializeRepository: (repositoryPath: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      createBranch: (branchName: string, startPoint: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      checkout: (ref: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      openWorktree: (worktreePath: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      openWorkspace: (target: WorkspaceOpenTarget) => Promise<ActionResponse>;
      getAvailableWorkspaceTargets: () => Promise<WorkspaceOpenTarget[]>;
      getPreferences: () => Promise<UiPreferences>;
      savePreferences: (preferences: UiPreferences) => Promise<void>;
      setCollapsed: (collapsed: boolean) => Promise<void>;
      getPinned: () => Promise<boolean>;
      setPinned: (pinned: boolean) => Promise<void>;
      dockToEdge: (collapsed: boolean) => Promise<void>;
      getTemporaryInfoPayload: () => Promise<TemporaryInfoPayload>;
      setTemporaryInfoPanel: (payload: TemporaryInfoPayload) => Promise<void>;
      copyText: (text: string) => Promise<void>;
      getSystemTheme: () => Promise<"light" | "dark">;
      onTemporaryInfoPayloadUpdated: (callback: (payload: TemporaryInfoPayload) => void) => () => void;
      onTemporaryInfoPanelClosed: (callback: () => void) => () => void;
      onThemeChanged: (callback: (theme: "light" | "dark") => void) => () => void;
      onPreferencesChanged: (callback: (preferences: UiPreferences) => void) => () => void;
      onSnapshotUpdated: (callback: (response: SnapshotResponse) => void) => () => void;
      onCollapsedChanged: (callback: (collapsed: boolean) => void) => () => void;
      onPinnedChanged: (callback: (pinned: boolean) => void) => () => void;
      onRepositoryDialogOpenChanged: (callback: (open: boolean) => void) => () => void;
    };
  }
}

export {};
