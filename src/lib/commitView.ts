import type { CommitViewSelection } from "../types";

export const defaultCommitView: CommitViewSelection = { mode: "all" };

export type CommitViewChangeDecision =
  | { kind: "unchanged" }
  | { kind: "local"; notice: string }
  | { kind: "refresh"; successNotice: string };

export function sameCommitView(left: CommitViewSelection, right: CommitViewSelection) {
  return left.mode === right.mode && (left.ref ?? "") === (right.ref ?? "");
}

export function commitViewLabel(view: CommitViewSelection) {
  if (view.mode === "branch") return view.ref ? `branch ${view.ref}` : "specific branch";
  if (view.mode === "current") return "current branch";
  return "all branches";
}

export function commitViewChangeDecision(options: {
  currentView: CommitViewSelection;
  nextView: CommitViewSelection;
  bridgeAvailable: boolean;
  hasSnapshot: boolean;
}): CommitViewChangeDecision {
  if (sameCommitView(options.currentView, options.nextView)) return { kind: "unchanged" };

  const viewLabel = commitViewLabel(options.nextView);
  if (!options.bridgeAvailable || !options.hasSnapshot) {
    return { kind: "local", notice: `Commit view set to ${viewLabel}.` };
  }

  return { kind: "refresh", successNotice: `Showing ${viewLabel}.` };
}
