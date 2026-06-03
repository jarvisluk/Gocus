export type BranchKind = "main" | "develop" | "feature" | "fix" | "release" | "remote";

export interface GraphLaneSegment {
  column: number;
  color: BranchKind;
}

export interface GraphBridge {
  fromColumn: number;
  toColumn: number;
  color: BranchKind;
}

export interface CommitGraph {
  column: number;
  laneCount: number;
  currentColor: BranchKind;
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
  author: string;
  relativeTime: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  parents: string[];
  refs: string[];
  lane: BranchKind;
  graph: CommitGraph;
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
