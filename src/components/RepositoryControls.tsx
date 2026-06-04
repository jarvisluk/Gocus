import { GitBranch, GitCommitHorizontal, GitFork } from "lucide-react";
import type { CommitViewSelection, GitBranchRef, GitSnapshot, GitWorktree } from "../types";

function branchOptionLabel(branch: GitBranchRef) {
  if (branch.type === "remote") return `${branch.name} remote`;
  if (branch.type === "tag") return `${branch.name} tag`;
  return branch.name;
}

function WorktreeList({ worktrees }: { worktrees: GitWorktree[] }) {
  if (!worktrees.length) return null;

  return (
    <div className="worktree-list" aria-label="Worktrees">
      {worktrees.slice(0, 3).map((worktree) => (
        <div className="worktree-row" key={worktree.path} title={worktree.path}>
          <GitFork aria-hidden="true" />
          <span>{worktree.current ? "Current" : worktree.branch || "Detached"}</span>
          <code>{worktree.path}</code>
        </div>
      ))}
    </div>
  );
}

export function RepositoryControls({
  snapshot,
  view,
  onChangeView,
  onCheckoutRef,
}: {
  snapshot: GitSnapshot;
  view: CommitViewSelection;
  onChangeView: (view: CommitViewSelection) => void;
  onCheckoutRef: (ref: string) => void;
}) {
  const selectedBranch = view.mode === "branch" ? view.ref ?? "" : "";

  return (
    <section className="repo-controls" aria-label="Repository view controls">
      <div className="branch-view">
        <div className="segmented-control" aria-label="Commit view">
          <button className={view.mode === "auto" ? "is-active" : ""} type="button" onClick={() => onChangeView({ mode: "auto" })}>
            <GitCommitHorizontal aria-hidden="true" />
            Auto
          </button>
          <button className={view.mode === "current" ? "is-active" : ""} type="button" onClick={() => onChangeView({ mode: "current" })}>
            <GitBranch aria-hidden="true" />
            Current
          </button>
          <button className={view.mode === "all" ? "is-active" : ""} type="button" onClick={() => onChangeView({ mode: "all" })}>
            All
          </button>
        </div>
        <select
          aria-label="Specific branch"
          value={selectedBranch}
          onChange={(event) => onChangeView(event.target.value ? { mode: "branch", ref: event.target.value } : { mode: "auto" })}
        >
          <option value="">Specific branch</option>
          {snapshot.branches.map((branch) => (
            <option value={branch.name} key={`${branch.type}-${branch.name}`}>
              {branchOptionLabel(branch)}
            </option>
          ))}
        </select>
        <button className="branch-checkout" type="button" onClick={() => selectedBranch && onCheckoutRef(selectedBranch)} disabled={!selectedBranch}>
          <GitBranch aria-hidden="true" />
          Switch
        </button>
      </div>
      <WorktreeList worktrees={snapshot.worktrees} />
    </section>
  );
}
