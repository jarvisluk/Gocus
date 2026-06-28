import type { FunctionMenuPayload, GitSnapshot, WorkspaceOpenTarget } from "../types";
import { defaultWorkspaceOpenTarget, defaultWorkspaceOpenTargets } from "./workspaceOpenTargets";

export type FunctionMenuActionIcon =
  | "download"
  | "external"
  | "folder"
  | "github"
  | "refresh"
  | "upload"
  | "x";

export interface FunctionMenuActionView {
  key: string;
  className: string;
  icon: FunctionMenuActionIcon;
  label: string;
  detail: string;
  disabled: boolean;
  title: string;
}

export const functionMenuFallbackPayload: NonNullable<FunctionMenuPayload> = {
  kind: "function-menu",
  repository: null,
  activeWorkspaceTarget: defaultWorkspaceOpenTarget,
  availableWorkspaceTargets: defaultWorkspaceOpenTargets,
  enabledWorkspaceTargets: defaultWorkspaceOpenTargets,
};

export function functionMenuPayloadFromSnapshot({
  snapshot,
  activeWorkspaceTarget,
  availableWorkspaceTargets,
  enabledWorkspaceTargets,
}: {
  snapshot: GitSnapshot | null;
  activeWorkspaceTarget: WorkspaceOpenTarget;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  enabledWorkspaceTargets: WorkspaceOpenTarget[];
}): FunctionMenuPayload {
  return {
    kind: "function-menu",
    repository: snapshot
      ? {
          repoName: snapshot.repoName,
          repoPath: snapshot.repoPath,
          branch: snapshot.branch,
          changedFileCount: snapshot.changedFiles.length,
          worktreeCount: snapshot.worktrees.length,
        }
      : null,
    activeWorkspaceTarget,
    availableWorkspaceTargets,
    enabledWorkspaceTargets,
  };
}

export function functionMenuPushActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  return {
    key: "push",
    className: "function-menu-action",
    icon: "upload",
    label: "Push",
    detail: payload.repository ? "Push to remote." : "Choose a workspace first.",
    disabled: !payload.repository,
    title: payload.repository ? "Push to remote" : "Choose a workspace first",
  };
}

export function functionMenuFetchActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  return {
    key: "fetch",
    className: "function-menu-action",
    icon: "download",
    label: "Fetch",
    detail: payload.repository ? "Fetch remote refs." : "Choose a workspace first.",
    disabled: !payload.repository,
    title: payload.repository ? "Fetch remotes" : "Choose a workspace first",
  };
}

export function functionMenuRefreshActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  return {
    key: "refresh",
    className: "function-menu-action",
    icon: "refresh",
    label: "Refresh",
    detail: payload.repository ? "Refresh Git data." : "Choose a workspace first.",
    disabled: !payload.repository,
    title: payload.repository ? "Refresh Git data" : "Choose a workspace first",
  };
}

export function functionMenuWindowView(payload: FunctionMenuPayload) {
  const resolvedPayload = payload ?? functionMenuFallbackPayload;

  return {
    payload: resolvedPayload,
    viewport: {
      className: "side-window-viewport temporary-viewport function-menu-viewport",
    },
    panel: {
      className: "side-window-panel function-menu-panel",
      ariaLabel: "Function menu",
    },
    closeButton: {
      key: "close",
      className: "function-menu-action",
      icon: "x" as FunctionMenuActionIcon,
      label: "Close",
      detail: "Close menu.",
      disabled: false,
      title: "Close menu",
    },
    openRepositoryAction: {
      key: "open-repository",
      className: "function-menu-action",
      icon: "folder" as FunctionMenuActionIcon,
      label: "Workspace",
      detail: "Open or switch workspace.",
      disabled: false,
      title: "Open or switch workspace",
    },
    githubAction: {
      key: "github-releases",
      className: "function-menu-action",
      icon: "github" as FunctionMenuActionIcon,
      label: "Releases",
      detail: "Open the release page in browser.",
      disabled: false,
      title: "Open GitHub Releases",
    },
    updatesAction: {
      key: "check-updates",
      className: "function-menu-action",
      icon: "download" as FunctionMenuActionIcon,
      label: "Updates",
      detail: "Check for updates.",
      disabled: false,
      title: "Check for updates",
    },
    pushAction: functionMenuPushActionView(resolvedPayload),
    fetchAction: functionMenuFetchActionView(resolvedPayload),
    refreshAction: functionMenuRefreshActionView(resolvedPayload),
  };
}
