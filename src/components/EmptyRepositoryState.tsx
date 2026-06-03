import { FolderOpen } from "lucide-react";

export function EmptyRepositoryState({
  loading,
  notice,
  onOpen,
}: {
  loading: boolean;
  notice: string;
  onOpen: () => void;
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
      <span>{notice}</span>
    </section>
  );
}
