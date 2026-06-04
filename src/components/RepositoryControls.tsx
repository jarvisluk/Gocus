import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, GitBranch, GitFork } from "lucide-react";
import { joinClass } from "../lib/classNames";
import { pathName } from "../lib/pathLabels";
import type { CommitViewSelection, GitBranchRef, GitSnapshot, GitWorktree } from "../types";

function branchOptionLabel(branch: GitBranchRef) {
  if (branch.type === "remote") return `${branch.name} remote`;
  if (branch.type === "tag") return `${branch.name} tag`;
  return branch.name;
}

function shortHash(hash: string) {
  return hash ? hash.slice(0, 7) : "unknown";
}

function worktreeMenuLabel(worktree: GitWorktree) {
  if (worktree.detached) {
    const prefix = worktree.current ? "Current detached" : "Detached";
    return `${prefix} @ ${shortHash(worktree.head)} - ${pathName(worktree.path)}`;
  }

  const prefix = worktree.current ? `Current ${worktree.branch || "worktree"}` : worktree.branch || "Worktree";
  return `${prefix} - ${pathName(worktree.path)}`;
}

function worktreeChipLabel(worktree: GitWorktree | undefined) {
  if (!worktree) return "Worktrees";
  if (worktree.detached) return `Detached ${shortHash(worktree.head)}`;
  return worktree.branch || pathName(worktree.path);
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
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [worktreeMenuOpen, setWorktreeMenuOpen] = useState(false);
  const branchControlRef = useRef<HTMLDivElement>(null);
  const worktreeControlRef = useRef<HTMLDivElement>(null);
  const selectedBranch = view.mode === "branch" ? view.ref ?? "" : "";
  const selectedBranchIsAvailable = selectedBranch ? snapshot.branches.some((branch) => branch.name === selectedBranch) : true;
  const switchableWorktrees = snapshot.worktrees.filter((worktree) => !worktree.bare);
  const currentWorktree = switchableWorktrees.find((worktree) => worktree.current) ?? switchableWorktrees[0];

  useEffect(() => {
    if (!branchMenuOpen && !worktreeMenuOpen) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (branchControlRef.current?.contains(target) || worktreeControlRef.current?.contains(target)) return;
      setBranchMenuOpen(false);
      setWorktreeMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setBranchMenuOpen(false);
      setWorktreeMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [branchMenuOpen, worktreeMenuOpen]);

  function changeView(mode: Exclude<CommitViewSelection["mode"], "branch">) {
    setBranchMenuOpen(false);
    setWorktreeMenuOpen(false);
    onChangeView({ mode });
  }

  function selectBranch(ref: string) {
    setBranchMenuOpen(false);
    onChangeView({ mode: "branch", ref });
  }

  function openWorktree(worktreePath: string) {
    setWorktreeMenuOpen(false);
    if (worktreePath !== currentWorktree?.path) onOpenWorktree(worktreePath);
  }

  return (
    <section className="repo-controls" aria-label="Repository view controls">
      <div className="commit-view-strip" role="group" aria-label="Commit view">
        <button className={joinClass("view-chip", view.mode === "all" && "is-active")} type="button" onClick={() => changeView("all")}>
          All
        </button>
        <button className={joinClass("view-chip", view.mode === "current" && "is-active")} type="button" onClick={() => changeView("current")}>
          Current
        </button>
        <div className="branch-menu-control" ref={branchControlRef}>
          <button
            className={joinClass("view-chip", "branch-view-trigger", view.mode === "branch" && "is-active", branchMenuOpen && "is-open")}
            type="button"
            aria-label="Choose branch view"
            aria-haspopup="menu"
            aria-expanded={branchMenuOpen}
            aria-controls="branch-ref-menu"
            title={selectedBranch || snapshot.branch.name}
            onClick={() => {
              setWorktreeMenuOpen(false);
              setBranchMenuOpen((current) => !current);
            }}
            disabled={!snapshot.branches.length && !selectedBranch}
          >
            <GitBranch aria-hidden="true" />
            <span>Branch</span>
            <ChevronDown aria-hidden="true" />
          </button>
          {branchMenuOpen ? (
            <div className="ui-menu branch-ref-menu" id="branch-ref-menu" role="menu">
              {selectedBranch && !selectedBranchIsAvailable ? (
                <button className="ui-menu-item branch-ref-menu-item is-active" type="button" role="menuitem" onClick={() => selectBranch(selectedBranch)}>
                  <Check aria-hidden="true" />
                  <span>{selectedBranch}</span>
                </button>
              ) : null}
              {snapshot.branches.map((branch) => (
                <button
                  className={joinClass("ui-menu-item", "branch-ref-menu-item", view.mode === "branch" && branch.name === selectedBranch && "is-active")}
                  type="button"
                  role="menuitem"
                  aria-current={view.mode === "branch" && branch.name === selectedBranch ? "true" : undefined}
                  title={branch.fullName}
                  key={`${branch.type}-${branch.name}`}
                  onClick={() => selectBranch(branch.name)}
                >
                  {view.mode === "branch" && branch.name === selectedBranch ? <Check aria-hidden="true" /> : <GitBranch aria-hidden="true" />}
                  <span>{branchOptionLabel(branch)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {view.mode === "branch" && selectedBranch ? (
        <div className="selected-branch-view" title={`Viewing branch ${selectedBranch}`} aria-label={`Viewing branch ${selectedBranch}`}>
          <GitBranch aria-hidden="true" />
          <span>Viewing</span>
          <strong>{selectedBranch}</strong>
        </div>
      ) : null}
      {switchableWorktrees.length > 1 ? (
        <div className="worktree-compact" ref={worktreeControlRef}>
          <button
            className={joinClass("worktree-trigger", worktreeMenuOpen && "is-open")}
            type="button"
            aria-label="Choose worktree"
            aria-haspopup="menu"
            aria-expanded={worktreeMenuOpen}
            aria-controls="worktree-menu"
            title={currentWorktree?.path}
            onClick={() => {
              setBranchMenuOpen(false);
              setWorktreeMenuOpen((current) => !current);
            }}
          >
            <GitFork aria-hidden="true" />
            <span>{worktreeChipLabel(currentWorktree)}</span>
            <strong>{switchableWorktrees.length}</strong>
            <ChevronDown aria-hidden="true" />
          </button>
          {worktreeMenuOpen ? (
            <div className="ui-menu worktree-menu" id="worktree-menu" role="menu">
              {switchableWorktrees.map((worktree) => (
                <button
                  className={joinClass("ui-menu-item", "worktree-menu-item", worktree.path === currentWorktree?.path && "is-active")}
                  type="button"
                  role="menuitem"
                  aria-current={worktree.path === currentWorktree?.path ? "true" : undefined}
                  title={worktree.path}
                  key={worktree.path}
                  onClick={() => openWorktree(worktree.path)}
                >
                  {worktree.path === currentWorktree?.path ? <Check aria-hidden="true" /> : <GitFork aria-hidden="true" />}
                  <span>{worktreeMenuLabel(worktree)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
