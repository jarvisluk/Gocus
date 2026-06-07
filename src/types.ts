export type BranchKind = "main" | "develop" | "feature" | "fix" | "release" | "stash" | "topic" | "remote";
export type BranchColor = string;
export type Theme = "light" | "dark";
export type ThemeMode = "system" | Theme;
export type LightThemePreset = "paper" | "mist" | "pearl";
export type DarkThemePreset = "graphite" | "cursor" | "matte";
export type FileFilter = "all" | "modified" | "staged" | "untracked";
export type WorkspaceOpenTarget = "vscode" | "cursor" | "codex" | "antigravity" | "finder" | "terminal" | "xcode";
export type CommitViewMode = "current" | "all" | "branch";
export type GraphLineVariant = "solid" | "dashed";

export interface RecentRepository {
  path: string;
  name: string;
  repositoryKey?: string;
}

export interface FolderWithoutGit {
  path: string;
  name: string;
  hasGitIgnore: boolean;
}

export interface CommitViewSelection {
  mode: CommitViewMode;
  ref?: string;
}

export interface UiPreferences {
  themeMode: ThemeMode;
  lightThemePreset: LightThemePreset;
  darkThemePreset: DarkThemePreset;
  density: "compact" | "comfortable";
  fontFamily: "system" | "inter" | "mono";
  graphStyle: "solid" | "soft";
  workspaceOpenTargets: WorkspaceOpenTarget[];
  showZenEntry: boolean;
  launchAtLogin: boolean;
  zenMode: boolean;
}

export interface GraphLaneSegment {
  column: number;
  color: BranchColor;
  variant?: GraphLineVariant;
  from?: "top" | "node";
  to?: "node" | "bottom";
}

export interface GraphBridge {
  fromColumn: number;
  toColumn: number;
  color: BranchColor;
  variant?: GraphLineVariant;
  to?: "lane" | "bottom";
}

export interface CommitGraph {
  column: number;
  laneCount: number;
  currentColor: BranchColor;
  currentVariant: GraphLineVariant;
  currentContinues: boolean;
  passThrough: GraphLaneSegment[];
  parentStems: GraphLaneSegment[];
  bridges: GraphBridge[];
  isMerge: boolean;
}

export interface GitBranchState {
  name: string;
  upstream: string;
  ahead: number;
  behind: number;
  detached: boolean;
}

export interface GitBranchRef {
  name: string;
  fullName: string;
  type: "local" | "remote" | "tag";
  current: boolean;
  upstream: string;
}

export interface GitWorktree {
  path: string;
  branch: string;
  head: string;
  headShortHash: string;
  headTitle: string;
  headRelativeTime: string;
  detached: boolean;
  bare: boolean;
  current: boolean;
  counts: WorkingTreeCounts;
}

export interface WorkingTreeCounts {
  modified: number;
  staged: number;
  untracked: number;
}

export interface CommitItem {
  id: string;
  fullHash: string;
  hash: string;
  title: string;
  message: string;
  author: string;
  relativeTime: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  parents: string[];
  refs: string[];
  lane: BranchKind;
  branchColor: BranchColor;
  refColors: BranchColor[];
  graph: CommitGraph;
  checkedOutWorktrees: GitWorktree[];
}

export interface ChangedFile {
  path: string;
  originalPath?: string;
  status: string;
  indexStatus: string;
  workingTreeStatus: string;
  statusLabel: string;
  additions: number;
  deletions: number;
}

export interface GitSnapshot {
  repoPath: string;
  repoName: string;
  repositoryKey: string;
  branch: GitBranchState;
  branches: GitBranchRef[];
  worktrees: GitWorktree[];
  view: CommitViewSelection;
  counts: WorkingTreeCounts;
  commits: CommitItem[];
  changedFiles: ChangedFile[];
  lastFetchedAt: string;
  isSample: boolean;
}

export type SnapshotResponse =
  | { ok: true; snapshot: GitSnapshot }
  | { ok: false; reason: "not_git_repository"; error?: string; canceled?: boolean; folder: FolderWithoutGit }
  | { ok: false; error?: string; canceled?: boolean; reason?: "not_configured" | "invalid_repository" | "read_failed" };

export type ActionResponse =
  | { ok: true; message?: string; snapshot?: GitSnapshot }
  | { ok: false; error?: string; canceled?: boolean; reason?: "not_configured" | "invalid_repository" | "action_failed" };
