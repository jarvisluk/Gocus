import type { CommitItem } from "../types";

export function commitSearchTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function commitMatchesSearch(commit: CommitItem, terms: string[]) {
  if (!terms.length) return true;

  const worktreeText = commit.checkedOutWorktrees
    .flatMap((worktree) => [worktree.branch, worktree.path, worktree.headShortHash, worktree.headTitle])
    .join(" ");
  const searchableText = [
    commit.title,
    commit.message,
    commit.hash,
    commit.fullHash,
    commit.author,
    commit.relativeTime,
    ...commit.refs,
    ...(commit.mergedRefs ?? []),
    ...(commit.containedBranches ?? []),
    ...commit.parents,
    worktreeText,
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => searchableText.includes(term));
}

export function filterCommitsBySearch(commits: CommitItem[], query: string) {
  const terms = commitSearchTerms(query);
  return commits.filter((commit) => commitMatchesSearch(commit, terms));
}
