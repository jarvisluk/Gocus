import { FolderOpen } from "lucide-react";
import type { RecentRepository } from "../types";

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
  recentRepositories,
  onOpen,
  onSwitchRepository,
}: {
  loading: boolean;
  notice: string;
  recentRepositories: RecentRepository[];
  onOpen: () => void;
  onSwitchRepository: (repositoryPath: string) => void;
}) {
  return (
    <section className="empty-repository" aria-label="Open working folder">
      <div className="empty-icon">
        <FolderOpen aria-hidden="true" />
      </div>
      <h2>{loading ? "Checking working folder" : "Open a working folder"}</h2>
      <p>{loading ? "Looking for the last saved repository." : "Git Peek only shows real data from a folder you choose. It remembers that folder for next time."}</p>
      <button className="primary-action" type="button" onClick={onOpen} disabled={loading}>
        <FolderOpen aria-hidden="true" />
        Choose folder
      </button>
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
