import type { WorkspaceOpenTarget } from "../types";

export const workspaceOpenTargetValues: WorkspaceOpenTarget[] = [
  "vscode",
  "cursor",
  "codex",
  "antigravity",
  "antigravityApp",
  "finder",
  "terminal",
  "xcode",
];
export const defaultWorkspaceOpenTargets: WorkspaceOpenTarget[] = [...workspaceOpenTargetValues];

export function isWorkspaceOpenTarget(value: unknown): value is WorkspaceOpenTarget {
  return typeof value === "string" && (workspaceOpenTargetValues as readonly string[]).includes(value);
}

export function sanitizeWorkspaceOpenTargets(value: unknown, fallback = defaultWorkspaceOpenTargets): WorkspaceOpenTarget[] {
  if (!Array.isArray(value)) return [...fallback];

  const nextTargets: WorkspaceOpenTarget[] = [];
  for (const target of value) {
    if (!isWorkspaceOpenTarget(target) || nextTargets.includes(target)) continue;
    nextTargets.push(target);
  }

  return nextTargets;
}
