import { FileCode2, GitBranch, GitCompareArrows, GitFork, GitMerge, Search } from "lucide-react";
import type { CSSProperties } from "react";
import { GitTreeCell, getGitTreeRailWidth, getGitTreeRequiredLaneCount } from "../git-tree";
import { joinClass } from "../lib/classNames";
import type { CommitItem } from "../types";

type CommitAction = "compare" | "branch" | "checkout";

function CommitRow({
  commit,
  selected,
  expandSelectedMessage,
  onSelect,
  onAction,
}: {
  commit: CommitItem;
  selected: boolean;
  expandSelectedMessage?: boolean;
  onSelect: () => void;
  onAction: (action: CommitAction, commit: CommitItem) => void;
}) {
  const ref = commit.refs[0];
  const graphLaneCount = getGitTreeRequiredLaneCount(commit.graph);
  const rowStyle: CSSProperties & { "--git-tree-rail-width": string } = {
    "--git-tree-rail-width": `${getGitTreeRailWidth(graphLaneCount)}px`,
  };
  const refStyle = {
    "--branch-color": commit.refColors[0] ?? commit.branchColor,
  } as CSSProperties;
  const message = commit.message.trim() || commit.title;
  const displayMessage = expandSelectedMessage && selected ? message : commit.title;
  const checkoutDisabled = commit.graph.currentVariant === "dashed";

  return (
    <article className={joinClass("commit-row", selected && "is-selected")} style={rowStyle} onClick={onSelect} title={message}>
      <GitTreeCell graph={commit.graph} laneCount={graphLaneCount} />
      <div className="commit-content">
        <div className="commit-title-line">
          <h3>{displayMessage}</h3>
          {ref ? (
            <span className="ref-pill" style={refStyle}>
              {ref}
            </span>
          ) : null}
        </div>
        <div className="commit-meta">
          <code>{commit.hash}</code>
          <span>{commit.relativeTime}</span>
          {selected ? <span>{commit.author}</span> : null}
          {commit.graph.isMerge ? (
            <span className="merge-indicator" title={`${commit.parents.length} parent commits`}>
              <GitMerge aria-hidden="true" />
              merge
            </span>
          ) : null}
        </div>
        <div className="commit-stats">
          <span className="additions">+{commit.additions}</span>
          <span className="deletions">-{commit.deletions}</span>
          <span className="files">
            <FileCode2 aria-hidden="true" />
            {commit.filesChanged}
          </span>
        </div>
        <div className="commit-message-popover" role="tooltip">
          {message}
        </div>
        {selected ? (
          <div className="commit-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => onAction("compare", commit)}>
              <GitCompareArrows aria-hidden="true" />
              Compare
            </button>
            <button type="button" onClick={() => onAction("branch", commit)}>
              <GitFork aria-hidden="true" />
              Branch
            </button>
            <button
              type="button"
              onClick={() => {
                if (!checkoutDisabled) onAction("checkout", commit);
              }}
              disabled={checkoutDisabled}
              title={checkoutDisabled ? "Open that worktree first to checkout there." : undefined}
            >
              <GitBranch aria-hidden="true" />
              Checkout
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function RecentCommits({
  commits,
  selectedId,
  expandSelectedMessage = false,
  onSelect,
  onAction,
}: {
  commits: CommitItem[];
  selectedId: string;
  expandSelectedMessage?: boolean;
  onSelect: (id: string) => void;
  onAction: (action: CommitAction, commit: CommitItem) => void;
}) {
  return (
    <section className="commits-section" aria-label="Recent commits">
      <div className="section-heading">
        <h2>Recent commits</h2>
        <div className="heading-tools">
          <span>Showing {commits.length}</span>
          <button type="button" aria-label="Filter commits">
            <Search aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="commit-list">
        {commits.map((commit) => (
          <CommitRow
            key={commit.id}
            commit={commit}
            selected={commit.id === selectedId}
            expandSelectedMessage={expandSelectedMessage}
            onSelect={() => onSelect(commit.id)}
            onAction={onAction}
          />
        ))}
      </div>
    </section>
  );
}
