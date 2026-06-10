import type { CommitAction, CommitItem } from "../types";
import { joinClass } from "./classNames";

export type CommitRowAction = CommitAction;
export type CommitRowActionIcon = CommitAction;

interface CommitRowActionView {
  action: CommitRowAction;
  label: string;
  icon: CommitRowActionIcon;
  disabled: boolean;
  title?: string;
}

export function commitRowView(commit: CommitItem, selected: boolean, expandSelectedMessage = false) {
  const message = commit.message.trim() || commit.title;
  const ref = commit.refs[0] ?? "";
  const checkoutDisabled = commit.graph.currentVariant === "dashed";

  return {
    className: joinClass("commit-row", selected && "is-selected"),
    contentClassName: "commit-content",
    selectButton: {
      className: "commit-select",
      ariaPressed: selected,
    },
    selectAriaPressed: selected,
    titleLineClassName: "commit-title-line",
    titleTextClassName: "commit-title-text",
    ref,
    showRef: Boolean(ref),
    refPillClassName: "ref-pill",
    refColor: commit.refColors[0] ?? commit.branchColor,
    message,
    displayMessage: expandSelectedMessage && selected ? message : commit.title,
    metaClassName: "commit-meta",
    showAuthor: selected,
    showActions: selected,
    isMerge: commit.graph.isMerge,
    mergeIndicator: {
      className: "merge-indicator",
      title: `${commit.parents.length} parent commits`,
    },
    mergeTitle: `${commit.parents.length} parent commits`,
    stats: {
      className: "commit-stats",
      additionsClassName: "additions",
      deletionsClassName: "deletions",
      filesClassName: "files",
    },
    messagePopover: {
      className: "commit-message-popover",
      role: "tooltip" as const,
      message,
    },
    actionsClassName: "commit-actions",
    branchAction: {
      action: "branch",
      label: "Branch",
      icon: "branch",
      disabled: false,
      title: undefined,
    } satisfies CommitRowActionView,
    checkoutAction: {
      action: "checkout",
      label: "Checkout",
      icon: "checkout",
      disabled: checkoutDisabled,
      title: checkoutDisabled ? "Open that worktree first to checkout there." : undefined,
    } satisfies CommitRowActionView,
  };
}
