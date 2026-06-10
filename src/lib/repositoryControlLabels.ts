import type { GitBranchRef, GitWorktree } from "../types";
import { pathName } from "./pathLabels";

export function branchOptionLabel(branch: GitBranchRef) {
  if (branch.type === "remote") return `${branch.name} remote`;
  if (branch.type === "tag") return `${branch.name} tag`;
  return branch.name;
}

export function shortHash(hash: string) {
  return hash ? hash.slice(0, 7) : "unknown";
}

export function worktreeMenuLabel(worktree: GitWorktree) {
  if (worktree.detached) {
    const prefix = worktree.current ? "Current detached" : "Detached";
    return `${prefix} @ ${worktree.headShortHash || shortHash(worktree.head)} - ${pathName(worktree.path)}`;
  }

  const prefix = worktree.current ? `Current ${worktree.branch || "worktree"}` : worktree.branch || "Worktree";
  return `${prefix} - ${pathName(worktree.path)}`;
}

export function worktreeChipLabel(worktree: GitWorktree | undefined) {
  if (!worktree) return "Worktrees";
  if (worktree.detached) return `Detached ${worktree.headShortHash || shortHash(worktree.head)}`;
  return worktree.branch || pathName(worktree.path);
}
