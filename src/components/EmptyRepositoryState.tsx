import { FilePlus, FolderGit2, FolderOpen, GitBranchPlus } from "lucide-react";
import {
  emptyRepositoryNoticeView,
  emptyRepositoryView,
  type EmptyRepositoryActionIcon,
  type EmptyRepositoryIcon,
} from "../lib/emptyRepositoryView";
import type { FolderWithoutGit, RecentRepository } from "../types";

function emptyRepositoryIcon(icon: EmptyRepositoryIcon) {
  if (icon === "folder-git") return <FolderGit2 aria-hidden="true" />;
  return <FolderOpen aria-hidden="true" />;
}

function emptyRepositoryActionIcon(icon: EmptyRepositoryActionIcon) {
  if (icon === "branch-plus") return <GitBranchPlus aria-hidden="true" />;
  return <FolderOpen aria-hidden="true" />;
}

export function EmptyRepositoryState({
  loading,
  notice,
  folderWithoutGit,
  initializingRepository,
  recentRepositories,
  onOpen,
  onInitializeRepository,
  onSwitchRepository,
}: {
  loading: boolean;
  notice: string;
  folderWithoutGit: FolderWithoutGit | null;
  initializingRepository: boolean;
  recentRepositories: RecentRepository[];
  onOpen: () => void;
  onInitializeRepository: () => void;
  onSwitchRepository: (repositoryPath: string) => void;
}) {
  const view = emptyRepositoryView({ loading, folderWithoutGit, initializingRepository, recentRepositories });
  const noticeView = emptyRepositoryNoticeView(notice);
  const primaryAction = view.primaryAction === "initialize" ? onInitializeRepository : onOpen;

  return (
    <section className={view.section.className} aria-labelledby={view.section.ariaLabelledBy}>
      <div className={view.iconFrameClassName}>
        {emptyRepositoryIcon(view.icon)}
      </div>
      <h2 id={view.titleId}>{view.title}</h2>
      <p>{view.body}</p>
      {view.showFolderPath && view.folderPath ? (
        <code className={view.folderPath.className} title={view.folderPath.title}>
          {view.folderPath.text}
        </code>
      ) : null}
      <div className={view.actionsClassName}>
        <button className={view.primaryButton.className} type="button" onClick={primaryAction} disabled={view.primaryButton.disabled}>
          {emptyRepositoryActionIcon(view.primaryButton.icon)}
          {view.primaryButton.label}
        </button>
        {view.showSecondaryAction ? (
          <button className={view.secondaryButton.className} type="button" onClick={onOpen} disabled={view.secondaryButton.disabled}>
            {emptyRepositoryActionIcon(view.secondaryButton.icon)}
            {view.secondaryButton.label}
          </button>
        ) : null}
      </div>
      {view.showGitIgnoreNote ? (
        <div className={view.gitIgnoreNote.className}>
          <FilePlus aria-hidden="true" />
          <span>{view.gitIgnoreNote.text}</span>
        </div>
      ) : null}
      {view.showRecentRepositories ? (
        <div className={view.recentRepositories.className} aria-label={view.recentRepositories.ariaLabel}>
          <strong>{view.recentRepositories.heading}</strong>
          {view.visibleRepositories.map((repository) => (
            <button
              type="button"
              title={repository.title}
              key={repository.path}
              onClick={() => onSwitchRepository(repository.path)}
              disabled={loading}
            >
              <FolderOpen aria-hidden="true" />
              <span>{repository.label}</span>
            </button>
          ))}
          {view.hiddenCountLabel ? (
            <span
              className={view.recentRepositories.hiddenCountView.className}
              role={view.recentRepositories.hiddenCountView.role}
              aria-live={view.recentRepositories.hiddenCountView.ariaLive}
            >
              {view.hiddenCountLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {noticeView ? <span role={noticeView.role} aria-live={noticeView.ariaLive}>{noticeView.message}</span> : null}
    </section>
  );
}
