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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCommitAbsoluteTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

export function commitRowView(commit: CommitItem, selected: boolean, expandSelectedMessage = false) {
  const message = commit.message.trim() || commit.title;
  const ref = commit.refs[0] ?? "";
  const externalWorktreeCheckoutDisabled = commit.graph.currentVariant === "dashed";

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
    mergeAction: {
      action: "merge",
      label: "Merge",
      icon: "merge",
      disabled: false,
      title: undefined,
    } satisfies CommitRowActionView,
    checkoutAction: {
      action: "checkout",
      label: "Checkout",
      icon: "checkout",
      disabled: externalWorktreeCheckoutDisabled,
      title: externalWorktreeCheckoutDisabled ? "Open that worktree first to checkout there." : undefined,
    } satisfies CommitRowActionView,
  };
}

export function commitHoverPanelView(commit: CommitItem) {
  const message = commit.message.trim() || commit.title;
  const absoluteTime = formatCommitAbsoluteTime(commit.authoredAt);
  const timeLabel = absoluteTime && commit.relativeTime ? `${commit.relativeTime} (${absoluteTime})` : commit.relativeTime || absoluteTime;
  const containedBranches = commit.containedBranches ?? [];
  const refPills = commit.refs.length
    ? commit.refs.map((ref, index) => ({
        key: `${ref}-${index}`,
        label: ref,
        color: commit.refColors[index] ?? commit.branchColor,
      }))
    : commit.graph.currentLabel
      ? [
          {
            key: `${commit.graph.currentLabel}-lane`,
            label: commit.graph.currentLabel,
            color: commit.graph.currentColor,
          },
        ]
      : [];

  return {
    panel: {
      className: "commit-hover-panel changed-side-panel",
      role: "tooltip" as const,
      ariaLabel: `Commit ${commit.hash} details`,
    },
    bodyClassName: "commit-hover-body",
    primarySectionClassName: "commit-hover-section commit-hover-primary",
    statsSectionClassName: "commit-hover-section commit-hover-stats-section",
    refsSectionClassName: "commit-hover-section commit-hover-refs-section",
    containedSectionClassName: "commit-hover-section commit-hover-contained-section",
    hashSectionClassName: "commit-hover-section commit-hover-hash-section",
    headerClassName: "commit-hover-header",
    authorClassName: "commit-hover-author",
    timeClassName: "commit-hover-time",
    titleClassName: "commit-hover-title",
    statsClassName: "commit-hover-stats",
    refsClassName: "commit-hover-refs",
    refPillClassName: "ref-pill commit-hover-ref-pill",
    containedClassName: "commit-hover-contained",
    containedLabelClassName: "commit-hover-contained-label",
    containedBranchesClassName: "commit-hover-contained-branches",
    containedBranchClassName: "commit-hover-contained-branch",
    hashClassName: "commit-hover-hash",
    author: commit.author || "Unknown",
    relativeTime: commit.relativeTime,
    absoluteTime,
    timeLabel,
    showTime: Boolean(timeLabel),
    message,
    filesLabel: `${commit.filesChanged}`,
    filesChangedLabel: `${pluralize(commit.filesChanged, "file")} changed`,
    insertionsLabel: `${pluralize(commit.additions, "insertion")}(+)`,
    deletionsLabel: `${pluralize(commit.deletions, "deletion")}(-)`,
    refs: refPills,
    showRefs: refPills.length > 0,
    containedBranches,
    showContainedBranches: containedBranches.length > 0,
    containedBranchesLabel: "Contained in",
    hash: commit.hash,
  };
}
