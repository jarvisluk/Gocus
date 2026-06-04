/// <reference types="vite/client" />

import type { ActionResponse, CommitViewSelection, RecentRepository, SnapshotResponse, UiPreferences, WorkspaceOpenTarget } from "./types";

declare global {
  interface Window {
    gitPeek?: {
      openRepository: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      switchRepository: (repositoryPath: string, view?: CommitViewSelection) => Promise<SnapshotResponse>;
      getRecentRepositories: () => Promise<RecentRepository[]>;
      refresh: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      getSnapshot: (view?: CommitViewSelection) => Promise<SnapshotResponse>;
      clearRepository: () => Promise<SnapshotResponse>;
      createBranch: (branchName: string, startPoint: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      checkout: (ref: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      openWorktree: (worktreePath: string, view?: CommitViewSelection) => Promise<ActionResponse>;
      openWorkspace: (target: WorkspaceOpenTarget) => Promise<ActionResponse>;
      getAvailableWorkspaceTargets: () => Promise<WorkspaceOpenTarget[]>;
      getPreferences: () => Promise<UiPreferences>;
      savePreferences: (preferences: UiPreferences) => Promise<void>;
      setCollapsed: (collapsed: boolean) => Promise<void>;
      setPinned: (pinned: boolean) => Promise<void>;
      dockToEdge: (collapsed: boolean) => Promise<void>;
      getSystemTheme: () => Promise<"light" | "dark">;
      onThemeChanged: (callback: (theme: "light" | "dark") => void) => () => void;
      onSnapshotUpdated: (callback: (response: SnapshotResponse) => void) => () => void;
      onCollapsedChanged: (callback: (collapsed: boolean) => void) => () => void;
      onRepositoryDialogOpenChanged: (callback: (open: boolean) => void) => () => void;
    };
  }
}

export {};
