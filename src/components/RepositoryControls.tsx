import { GitFork } from "lucide-react";
import type { CommitViewSelection, GitBranchRef, GitSnapshot, GitWorktree } from "../types";

function branchOptionLabel(branch: GitBranchRef) {
  if (branch.type === "remote") return `${branch.name} remote`;
  if (branch.type === "tag") return `${branch.name} tag`;
  return branch.name;
}

function shortHash(hash: string) {
  return hash ? hash.slice(0, 7) : "unknown";
}

function pathName(pathValue: string) {
  const trimmed = pathValue.replace(/[\\/]+$/, "");
  return trimmed.split(/[\\/]/).pop() || pathValue;
}

function detachedWorktreeLabel(worktree: GitWorktree) {
  const prefix = worktree.current ? "Current detached" : "Detached";
  return `${prefix} @ ${shortHash(worktree.head)} - ${pathName(worktree.path)}`;
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
  onOpenWorktree,
}: {
  snapshot: GitSnapshot;
  view: CommitViewSelection;
  onChangeView: (view: CommitViewSelection) => void;
  onOpenWorktree: (worktreePath: string) => void;
}) {
  const selectedBranch = view.mode === "branch" ? view.ref ?? "" : "";
  const selectedBranchIsAvailable = selectedBranch ? snapshot.branches.some((branch) => branch.name === selectedBranch) : true;
  const detachedWorktrees = snapshot.worktrees.filter((worktree) => worktree.detached);
  const currentDetachedWorktree = view.mode === "current" ? detachedWorktrees.find((worktree) => worktree.current) : undefined;
  const selectedValue = currentDetachedWorktree ? `worktree:${currentDetachedWorktree.path}` : view.mode === "branch" ? `branch:${selectedBranch}` : `view:${view.mode}`;

  function handleViewChange(value: string) {
    if (value.startsWith("worktree:")) {
      onOpenWorktree(value.slice("worktree:".length));
      return;
    }

    if (value.startsWith("branch:")) {
      const ref = value.slice("branch:".length);
      onChangeView(ref ? { mode: "branch", ref } : { mode: "auto" });
      return;
    }

    if (value === "view:current") {
      onChangeView({ mode: "current" });
      return;
    }

    if (value === "view:all") {
      onChangeView({ mode: "all" });
      return;
    }

    onChangeView({ mode: "auto" });
  }

  return (
    <section className="repo-controls" aria-label="Repository view controls">
      <div className="branch-view">
        <select
          className="ui-select"
          aria-label="Commit view"
          value={selectedValue}
          onChange={(event) => handleViewChange(event.target.value)}
        >
          <optgroup label="View">
            <option value="view:auto">Auto</option>
            <option value="view:current">Current</option>
            <option value="view:all">All</option>
          </optgroup>
          <optgroup label="Specific branch">
            {selectedBranch && !selectedBranchIsAvailable ? <option value={`branch:${selectedBranch}`}>{selectedBranch}</option> : null}
            {snapshot.branches.map((branch) => (
              <option value={`branch:${branch.name}`} key={`${branch.type}-${branch.name}`}>
                {branchOptionLabel(branch)}
              </option>
            ))}
          </optgroup>
          {detachedWorktrees.length ? (
            <optgroup label="Detached worktrees">
              {detachedWorktrees.map((worktree) => (
                <option value={`worktree:${worktree.path}`} key={worktree.path}>
                  {detachedWorktreeLabel(worktree)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <WorktreeList worktrees={snapshot.worktrees} />
    </section>
  );
}
