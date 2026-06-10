import type { GitSnapshot, RecentRepository } from "../types";
import { pathName } from "./pathLabels";

export const maxRecentRepositories = 8;
export const maxEmptyStateRecentRepositories = 4;

export function recentRepositoryFromSnapshot(snapshot: GitSnapshot): RecentRepository {
  return {
    path: snapshot.repoPath,
    name: snapshot.repoName || pathName(snapshot.repoPath),
    repositoryKey: snapshot.repositoryKey,
  };
}

export function isSameRecentRepository(left: RecentRepository, right: RecentRepository) {
  if (left.path === right.path) return true;
  return Boolean(left.repositoryKey && right.repositoryKey && left.repositoryKey === right.repositoryKey);
}

export function dedupeRecentRepositories(repositories: RecentRepository[], limit = Number.POSITIVE_INFINITY) {
  const deduped: RecentRepository[] = [];

  for (const repository of repositories) {
    if (deduped.some((entry) => isSameRecentRepository(entry, repository))) continue;
    deduped.push(repository);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

export function upsertRecentRepository(repositories: RecentRepository[], repository: RecentRepository, limit = maxRecentRepositories) {
  return dedupeRecentRepositories([repository, ...repositories], limit);
}

export function recentRepositoriesWithCurrent(snapshot: GitSnapshot | null, repositories: RecentRepository[]) {
  return dedupeRecentRepositories(snapshot ? [recentRepositoryFromSnapshot(snapshot), ...repositories] : repositories);
}

export function recentRepositoryHiddenCountLabel(hiddenCount: number) {
  if (hiddenCount <= 0) return "";
  return hiddenCount === 1 ? "+1 more repository" : `+${hiddenCount} more repositories`;
}

export function recentRepositoryPreview(repositories: readonly RecentRepository[], limit = maxEmptyStateRecentRepositories) {
  const hiddenCount = Math.max(0, repositories.length - limit);

  return {
    visibleRepositories: repositories.slice(0, limit),
    hiddenCount,
    hiddenCountLabel: recentRepositoryHiddenCountLabel(hiddenCount),
  };
}
