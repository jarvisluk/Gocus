import type { FunctionMenuPayload, GitSnapshot, WorkspaceOpenTarget } from "../types";
import { defaultWorkspaceOpenTarget, defaultWorkspaceOpenTargets } from "./workspaceOpenTargets";

export type FunctionMenuActionIcon =
  | "download"
  | "folder"
  | "github"
  | "pull"
  | "refresh"
  | "upload";

export interface FunctionMenuActionView {
  key: string;
  className: string;
  icon: FunctionMenuActionIcon;
  label: string;
  detail: string;
  disabled: boolean;
  title: string;
}

export interface FunctionMenuSectionView {
  key: string;
  label: string;
  actions: FunctionMenuActionView[];
}

export const functionMenuTitleId = "function-menu-title";

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
    detail: payload.repository ? "Push or publish current branch." : "Choose a workspace first.",
    disabled: !payload.repository,
    title: payload.repository ? "Push or publish current branch" : "Choose a workspace first",
  };
}

export function functionMenuPullActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  return {
    key: "pull",
    className: "function-menu-action",
    icon: "pull",
    label: "Pull",
    detail: payload.repository ? "Pull current branch with fast-forward only." : "Choose a workspace first.",
    disabled: !payload.repository,
    title: payload.repository ? "Pull current branch (fast-forward only)" : "Choose a workspace first",
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
  const openRepositoryAction: FunctionMenuActionView = {
    key: "open-repository",
    className: "function-menu-action",
    icon: "folder" as FunctionMenuActionIcon,
    label: "Open",
    detail: "Open or switch workspace.",
    disabled: false,
    title: "Open or switch workspace",
  };
  const pullAction = functionMenuPullActionView(resolvedPayload);
  const pushAction = functionMenuPushActionView(resolvedPayload);
  const fetchAction = functionMenuFetchActionView(resolvedPayload);
  const refreshAction = functionMenuRefreshActionView(resolvedPayload);
  const githubAction: FunctionMenuActionView = {
    key: "github-releases",
    className: "function-menu-action",
    icon: "github" as FunctionMenuActionIcon,
    label: "Release",
    detail: "Open the release page in browser.",
    disabled: false,
    title: "Open GitHub Releases",
  };
  const updatesAction: FunctionMenuActionView = {
    key: "check-updates",
    className: "function-menu-action",
    icon: "download" as FunctionMenuActionIcon,
    label: "Update",
    detail: "Check for updates.",
    disabled: false,
    title: "Check for updates",
  };

  return {
    payload: resolvedPayload,
    viewport: {
      className: "side-window-viewport temporary-viewport function-menu-viewport",
    },
    panel: {
      className: "side-window-panel function-menu-panel",
      ariaLabelledBy: functionMenuTitleId,
    },
    titleId: functionMenuTitleId,
    title: "Tools",
    sections: [
      { key: "workspace", label: "Workspace", actions: [openRepositoryAction] },
      { key: "git", label: "Git", actions: [pullAction, pushAction, fetchAction, refreshAction] },
      { key: "github", label: "GitHub", actions: [githubAction] },
      { key: "app", label: "App", actions: [updatesAction] },
    ] satisfies FunctionMenuSectionView[],
    openRepositoryAction,
    pullAction,
    pushAction,
    fetchAction,
    refreshAction,
    githubAction,
    updatesAction,
  };
}
