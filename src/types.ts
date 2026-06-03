export type BranchKind = "main" | "feature" | "fix" | "release" | "remote";

export interface GitBranchState {
  name: string;
  upstream: string;
  ahead: number;
  behind: number;
  detached: boolean;
}

export interface WorkingTreeCounts {
  modified: number;
  staged: number;
  untracked: number;
}

export interface CommitItem {
  id: string;
  hash: string;
  title: string;
  author: string;
  relativeTime: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  refs: string[];
  lane: BranchKind;
}

export interface ChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface GitSnapshot {
  repoPath: string;
  repoName: string;
  branch: GitBranchState;
  counts: WorkingTreeCounts;
  commits: CommitItem[];
  changedFiles: ChangedFile[];
  lastFetchedAt: string;
  isSample: boolean;
}

export type SnapshotResponse =
  | { ok: true; snapshot: GitSnapshot }
  | { ok: false; error?: string; canceled?: boolean; reason?: "not_configured" | "invalid_repository" | "read_failed" };
