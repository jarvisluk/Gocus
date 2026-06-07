import { FilePlus, FolderGit2, FolderOpen, GitBranchPlus } from "lucide-react";
import type { FolderWithoutGit, RecentRepository } from "../types";

function parentPathName(pathValue: string) {
  const trimmed = pathValue.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : "";
}

function recentRepositoryLabel(repository: RecentRepository) {
  const parentName = parentPathName(repository.path);
  return parentName ? `${repository.name} - ${parentName}` : repository.name;
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
  const actionDisabled = loading || initializingRepository;

  return (
    <section className="empty-repository" aria-label="Open working folder">
      <div className="empty-icon">
        {folderWithoutGit ? <FolderGit2 aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
      </div>
      <h2>{loading ? "Checking working folder" : folderWithoutGit ? "Folder without Git" : "Open a working folder"}</h2>
      <p>
        {loading
          ? "Looking for the last saved repository."
          : folderWithoutGit
            ? `${folderWithoutGit.name} can be initialized here and then tracked by Git Peek.`
            : "Git Peek only shows real data from a folder you choose. It remembers that folder for next time."}
      </p>
      {folderWithoutGit ? (
        <code className="empty-folder-path" title={folderWithoutGit.path}>
          {folderWithoutGit.path}
        </code>
      ) : null}
      <div className="empty-actions">
        <button className="primary-action" type="button" onClick={folderWithoutGit ? onInitializeRepository : onOpen} disabled={actionDisabled}>
          {folderWithoutGit ? <GitBranchPlus aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
          {folderWithoutGit ? (initializingRepository ? "Initializing" : "Initialize Git") : "Choose folder"}
        </button>
        {folderWithoutGit ? (
          <button className="secondary-action" type="button" onClick={onOpen} disabled={actionDisabled}>
            <FolderOpen aria-hidden="true" />
            Choose another
          </button>
        ) : null}
      </div>
      {folderWithoutGit ? (
        <div className="empty-gitignore-note">
          <FilePlus aria-hidden="true" />
          <span>{folderWithoutGit.hasGitIgnore ? "Keeps the existing .gitignore." : "Adds a starter .gitignore."}</span>
        </div>
      ) : null}
      {recentRepositories.length ? (
        <div className="empty-recent-repos" aria-label="Recent repositories">
          <strong>Recent</strong>
          {recentRepositories.slice(0, 4).map((repository) => (
            <button type="button" title={repository.path} key={repository.path} onClick={() => onSwitchRepository(repository.path)} disabled={loading}>
              <FolderOpen aria-hidden="true" />
              <span>{recentRepositoryLabel(repository)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <span>{notice}</span>
    </section>
  );
}
