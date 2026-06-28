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

function pluralizeCommit(count: number) {
  return count === 1 ? "commit" : "commits";
}

export function functionMenuPushActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  const branch = payload.repository?.branch;

  if (!branch) {
    return {
      key: "push",
      className: "function-menu-action",
      icon: "upload",
      label: "Push current branch",
      detail: "Choose a Git repository first.",
      disabled: true,
      title: "Choose a Git repository first",
    };
  }

  if (branch.detached) {
    return {
      key: "push",
      className: "function-menu-action",
      icon: "upload",
      label: "Cannot push detached HEAD",
      detail: "Create or switch to a branch before pushing.",
      disabled: true,
      title: "Cannot push detached HEAD",
    };
  }

  if (!branch.upstream) {
    return {
      key: "push",
      className: "function-menu-action",
      icon: "upload",
      label: "Publish branch",
      detail: `Set upstream for ${branch.name}.`,
      disabled: false,
      title: `Publish ${branch.name}`,
    };
  }

  if (branch.ahead <= 0) {
    return {
      key: "push",
      className: "function-menu-action",
      icon: "upload",
      label: "Nothing to push",
      detail: `${branch.name} is up to date with ${branch.upstream}.`,
      disabled: true,
      title: `${branch.name} is up to date`,
    };
  }

  return {
    key: "push",
    className: "function-menu-action",
    icon: "upload",
    label: `Push ${branch.ahead} ${pluralizeCommit(branch.ahead)}`,
    detail: `${branch.name} -> ${branch.upstream}`,
    disabled: false,
    title: `Push ${branch.ahead} ${pluralizeCommit(branch.ahead)} to ${branch.upstream}`,
  };
}

export function functionMenuFetchActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  return {
    key: "fetch",
    className: "function-menu-action",
    icon: "download",
    label: "Fetch remotes",
    detail: payload.repository ? "Update remote refs without merging." : "Choose a Git repository first.",
    disabled: !payload.repository,
    title: payload.repository ? "Fetch remotes" : "Choose a Git repository first",
  };
}

export function functionMenuRefreshActionView(payload: NonNullable<FunctionMenuPayload>): FunctionMenuActionView {
  return {
    key: "refresh",
    className: "function-menu-action",
    icon: "refresh",
    label: "Refresh Git data",
    detail: payload.repository ? "Read the latest local repository state." : "Choose a Git repository first.",
    disabled: !payload.repository,
    title: payload.repository ? "Refresh Git data" : "Choose a Git repository first",
  };
}

export function functionMenuWindowView(payload: FunctionMenuPayload) {
  const resolvedPayload = payload ?? functionMenuFallbackPayload;
  const repository = resolvedPayload.repository;
  const branch = repository?.branch;

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
    title: "Menu",
    closeButton: {
      className: "ui-icon-button function-menu-close",
      label: "Close function menu",
      icon: "x" as FunctionMenuActionIcon,
    },
    repositorySummary: repository
      ? {
          className: "function-menu-repository",
          title: repository.repoPath,
          name: repository.repoName,
          detail: branch?.detached ? "Detached HEAD" : branch?.name || "No branch",
          meta: `${repository.changedFileCount} changed / ${repository.worktreeCount} worktrees`,
        }
      : {
          className: "function-menu-repository is-empty",
          title: "No working folder",
          name: "No working folder",
          detail: "Open a workspace to enable Git actions.",
          meta: "",
        },
    sections: {
      workspace: "Workspace",
      remote: "Remote",
      maintenance: "Maintenance",
    },
    openRepositoryAction: {
      key: "open-repository",
      className: "function-menu-action",
      icon: "folder" as FunctionMenuActionIcon,
      label: repository ? "Open / switch workspace" : "Open workspace",
      detail: repository?.repoPath ?? "Choose a working folder.",
      disabled: false,
      title: repository ? "Open or switch workspace" : "Open workspace",
    },
    githubAction: {
      key: "github-releases",
      className: "function-menu-action",
      icon: "github" as FunctionMenuActionIcon,
      label: "GitHub Releases",
      detail: "Open the release page in browser.",
      disabled: false,
      title: "Open GitHub Releases",
    },
    updatesAction: {
      key: "check-updates",
      className: "function-menu-action",
      icon: "download" as FunctionMenuActionIcon,
      label: "Check for updates",
      detail: "Ask Gocus to check its update feed.",
      disabled: false,
      title: "Check for updates",
    },
    pushAction: functionMenuPushActionView(resolvedPayload),
    fetchAction: functionMenuFetchActionView(resolvedPayload),
    refreshAction: functionMenuRefreshActionView(resolvedPayload),
  };
}
