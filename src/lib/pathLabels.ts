import type { RecentRepository } from "../types";

export function pathName(pathValue: string) {
  const trimmed = pathValue.replace(/[\\/]+$/, "");
  return trimmed.split(/[\\/]/).pop() || pathValue;
}

export function parentPathName(pathValue: string) {
  const trimmed = pathValue.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : "";
}

export function recentRepositoryLabel(repository: RecentRepository) {
  const parentName = parentPathName(repository.path);
  return parentName ? `${repository.name} - ${parentName}` : repository.name;
}
