import type { FolderWithoutGit, RecentRepository } from "../types";
import { recentRepositoryLabel } from "./pathLabels";
import { recentRepositoryPreview } from "./recentRepositories";
import { politeStatusView } from "./statusView";

export type EmptyRepositoryIcon = "folder" | "folder-git";
export type EmptyRepositoryActionIcon = "folder" | "branch-plus";
export type EmptyRepositoryPrimaryAction = "open" | "initialize";

export const emptyRepositoryTitleId = "empty-repository-title";

export function emptyRepositoryFolderPathView(folderWithoutGit: FolderWithoutGit | null) {
  if (!folderWithoutGit) return null;

  return {
    className: "empty-folder-path",
    text: folderWithoutGit.path,
    title: folderWithoutGit.path,
  };
}

export function emptyRepositoryNoticeView(notice: string) {
  const message = notice.trim();
  if (!message) return null;

  return politeStatusView({
    message,
  });
}

export function emptyRepositoryView({
  loading,
  folderWithoutGit,
  initializingRepository,
  recentRepositories,
}: {
  loading: boolean;
  folderWithoutGit: FolderWithoutGit | null;
  initializingRepository: boolean;
  recentRepositories: readonly RecentRepository[];
}) {
  const actionDisabled = loading || initializingRepository;
  const { hiddenCountLabel, visibleRepositories } = recentRepositoryPreview(recentRepositories);
  const hasFolderWithoutGit = Boolean(folderWithoutGit);
  const folderPath = emptyRepositoryFolderPathView(folderWithoutGit);
  const primaryAction = hasFolderWithoutGit ? ("initialize" as const) : ("open" as const);
  const primaryActionIcon = hasFolderWithoutGit ? ("branch-plus" as const) : ("folder" as const);
  const primaryActionLabel = folderWithoutGit ? (initializingRepository ? "Initializing" : "Initialize Git") : "Choose folder";
  const repositoryItems = visibleRepositories.map((repository) => ({
    ...repository,
    label: recentRepositoryLabel(repository),
    title: repository.path,
  }));

  return {
    section: {
      className: "empty-repository",
      ariaLabelledBy: emptyRepositoryTitleId,
    },
    hasFolderWithoutGit,
    icon: hasFolderWithoutGit ? ("folder-git" as const) : ("folder" as const),
    iconFrameClassName: "empty-icon",
    titleId: emptyRepositoryTitleId,
    primaryAction,
    primaryActionIcon,
    actionDisabled,
    title: loading ? "Checking working folder" : hasFolderWithoutGit ? "Folder without Git" : "Open a working folder",
    body: loading
      ? "Looking for the last saved repository."
      : folderWithoutGit
        ? `${folderWithoutGit.name} can be initialized here and then tracked by Gocus.`
        : "Gocus only shows real data from a folder you choose. It remembers that folder for next time.",
    primaryActionLabel,
    actionsClassName: "empty-actions",
    primaryButton: {
      className: "primary-action",
      icon: primaryActionIcon,
      label: primaryActionLabel,
      disabled: actionDisabled,
    },
    showSecondaryAction: hasFolderWithoutGit,
    secondaryButton: {
      className: "secondary-action",
      icon: "folder" as EmptyRepositoryActionIcon,
      label: "Choose another",
      disabled: actionDisabled,
    },
    showFolderPath: hasFolderWithoutGit,
    folderPath,
    showGitIgnoreNote: hasFolderWithoutGit,
    gitIgnoreNote: {
      className: "empty-gitignore-note",
      text: folderWithoutGit ? (folderWithoutGit.hasGitIgnore ? "Keeps the existing .gitignore." : "Adds a starter .gitignore.") : "",
    },
    showRecentRepositories: repositoryItems.length > 0,
    recentRepositories: {
      className: "empty-recent-repos",
      ariaLabel: "Recent repositories",
      heading: "Recent",
      hiddenCountView: politeStatusView({
        className: "empty-recent-repos-more",
      }),
    },
    recentRepositoriesAriaLabel: "Recent repositories",
    recentRepositoriesHeading: "Recent",
    visibleRepositories: repositoryItems,
    hiddenCountLabel,
  };
}
