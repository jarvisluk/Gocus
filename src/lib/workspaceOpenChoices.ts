import type { WorkspaceOpenTarget } from "../types";
import type { WorkspaceOpenOption } from "./workspaceOpenOptions";

export function availableWorkspaceOpenOptions(options: readonly WorkspaceOpenOption[], availableTargets: readonly WorkspaceOpenTarget[]) {
  const availableTargetSet = new Set(availableTargets);
  return options.filter((option) => availableTargetSet.has(option.target));
}

export function visibleWorkspaceOpenOptions(
  options: readonly WorkspaceOpenOption[],
  availableTargets: readonly WorkspaceOpenTarget[],
  enabledTargets: readonly WorkspaceOpenTarget[],
) {
  const availableTargetSet = new Set(availableTargets);
  const enabledTargetSet = new Set(enabledTargets);
  return options.filter((option) => availableTargetSet.has(option.target) && enabledTargetSet.has(option.target));
}

export function activeWorkspaceOpenOption(options: readonly WorkspaceOpenOption[], activeTarget: WorkspaceOpenTarget) {
  return options.find((option) => option.target === activeTarget) ?? options[0] ?? null;
}

export function activeWorkspaceOpenTarget(options: readonly WorkspaceOpenOption[], activeTarget: WorkspaceOpenTarget) {
  return activeWorkspaceOpenOption(options, activeTarget)?.target ?? "";
}

export function enabledWorkspaceOpenOptionCount(options: readonly WorkspaceOpenOption[], enabledTargets: readonly WorkspaceOpenTarget[]) {
  const enabledTargetSet = new Set(enabledTargets);
  return options.filter((option) => enabledTargetSet.has(option.target)).length;
}

export function workspaceOpenTargetsSummary(options: readonly WorkspaceOpenOption[], enabledTargets: readonly WorkspaceOpenTarget[]) {
  if (!options.length) return "Unavailable";
  return `${enabledWorkspaceOpenOptionCount(options, enabledTargets)} enabled`;
}

export function workspaceOpenTargetsAfterToggle(
  options: readonly WorkspaceOpenOption[],
  enabledTargets: readonly WorkspaceOpenTarget[],
  target: WorkspaceOpenTarget,
  checked: boolean,
) {
  const nextTargets = new Set(enabledTargets);

  if (checked) {
    nextTargets.add(target);
  } else {
    nextTargets.delete(target);
  }

  return options.filter((option) => nextTargets.has(option.target)).map((option) => option.target);
}
