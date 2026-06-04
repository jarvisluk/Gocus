import { Code2, FolderOpen, MousePointer2 } from "lucide-react";
import type { WorkspaceOpenTarget } from "../types";

export function Footer({
  onOpenRepo,
  onOpenWorkspace,
  hasRepository,
}: {
  onOpenRepo: () => void;
  onOpenWorkspace: (target: WorkspaceOpenTarget) => void;
  hasRepository: boolean;
}) {
  return (
    <footer className="peek-footer">
      {!hasRepository ? (
        <button className="footer-primary" type="button" onClick={onOpenRepo}>
          <FolderOpen aria-hidden="true" />
          Open working folder
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <button className="footer-icon" type="button" aria-label="Open in Finder" title="Open in Finder" onClick={() => onOpenWorkspace("finder")} disabled={!hasRepository}>
        <FolderOpen aria-hidden="true" />
      </button>
      <button className="footer-icon" type="button" aria-label="Open in VS Code" title="Open in VS Code" onClick={() => onOpenWorkspace("vscode")} disabled={!hasRepository}>
        <Code2 aria-hidden="true" />
      </button>
      <button className="footer-icon" type="button" aria-label="Open in Cursor" title="Open in Cursor" onClick={() => onOpenWorkspace("cursor")} disabled={!hasRepository}>
        <MousePointer2 aria-hidden="true" />
      </button>
    </footer>
  );
}
