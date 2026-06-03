import { Code2, ExternalLink, FolderOpen, GitCommitHorizontal, MousePointer2 } from "lucide-react";
import type { WorkspaceOpenTarget } from "../types";

export function Footer({
  onOpenRepo,
  onOpenGraph,
  onOpenWorkspace,
  hasRepository,
}: {
  onOpenRepo: () => void;
  onOpenGraph: () => void;
  onOpenWorkspace: (target: WorkspaceOpenTarget) => void;
  hasRepository: boolean;
}) {
  return (
    <footer className="peek-footer">
      <button className="open-graph" type="button" onClick={hasRepository ? onOpenGraph : onOpenRepo}>
        <GitCommitHorizontal aria-hidden="true" />
        {hasRepository ? "Open full graph" : "Open working folder"}
      </button>
      <button className="footer-icon" type="button" aria-label="Open in Finder" title="Open in Finder" onClick={() => onOpenWorkspace("finder")} disabled={!hasRepository}>
        <FolderOpen aria-hidden="true" />
      </button>
      <button className="footer-icon" type="button" aria-label="Open in VS Code" title="Open in VS Code" onClick={() => onOpenWorkspace("vscode")} disabled={!hasRepository}>
        <Code2 aria-hidden="true" />
      </button>
      <button className="footer-icon" type="button" aria-label="Open in Cursor" title="Open in Cursor" onClick={() => onOpenWorkspace("cursor")} disabled={!hasRepository}>
        <MousePointer2 aria-hidden="true" />
      </button>
      <button className="footer-icon" type="button" aria-label="Open graph in new window" title="Open graph in new window" onClick={onOpenGraph} disabled={!hasRepository}>
        <ExternalLink aria-hidden="true" />
      </button>
    </footer>
  );
}
