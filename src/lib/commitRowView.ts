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

function shortHash(value: string) {
  return value ? value.slice(0, 7) : "";
}

function compactWorktreePath(value: string) {
  const parts = value.split(/[\\/]+/).filter(Boolean);
  if (!parts.length) return "worktree";

  const name = parts[parts.length - 1] ?? "worktree";
  const parent = parts[parts.length - 2] ?? "";
  const grandparent = parts[parts.length - 3] ?? "";

  if (grandparent === "worktrees" && parent) return `${parent}/${name}`;
  return name;
}

function detachedWorktreesForCommit(commit: CommitItem) {
  return (commit.checkedOutWorktrees ?? []).filter((worktree) => worktree.detached && !worktree.bare);
}

function detachedWorktreeTitle(worktrees: ReturnType<typeof detachedWorktreesForCommit>) {
  if (!worktrees.length) return undefined;

  const worktreeSummaries = worktrees.map((worktree) => {
    const hash = worktree.headShortHash || shortHash(worktree.head);
    const name = compactWorktreePath(worktree.path);
    return `${name}${hash ? ` @ ${hash}` : ""}: ${worktree.path}`;
  });

  return `Checked out as detached HEAD in ${worktreeSummaries.join(", ")}`;
}

function detachedWorktreePanelLabel(worktrees: ReturnType<typeof detachedWorktreesForCommit>) {
  if (worktrees.length === 1) return `Detached ${compactWorktreePath(worktrees[0].path)}`;
  return `${worktrees.length} detached worktrees`;
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
  const detachedWorktrees = detachedWorktreesForCommit(commit);
  const branchPills = commit.refs.length
    ? commit.refs.map((ref, index) => ({
        key: `${ref}-${index}`,
        label: ref,
        color: commit.refColors[index] ?? commit.branchColor,
        title: ref,
        icon: "branch" as const,
        modifierClassName: "",
      }))
    : commit.graph.currentLabel
      ? [
          {
            key: `${commit.graph.currentLabel}-lane`,
            label: commit.graph.currentLabel,
            color: commit.graph.currentColor,
            title: commit.graph.currentLabel,
            icon: "branch" as const,
            modifierClassName: "",
          },
        ]
      : [];
  const mergedRefPills = (commit.mergedRefs ?? []).map((ref, index) => ({
    key: `${ref}-merged-${index}`,
    label: ref,
    color: commit.graph.currentColor || commit.branchColor,
    title: `${ref} is a merged local branch pointer already reachable from the current branch.`,
    icon: "branch" as const,
    modifierClassName: "is-merged-ref",
  }));
  const detachedWorktreePills = detachedWorktrees.length
    ? [
        {
          key: "detached-worktree-head",
          label: detachedWorktreePanelLabel(detachedWorktrees),
          color: commit.graph.currentColor || commit.branchColor,
          title: detachedWorktreeTitle(detachedWorktrees) ?? "Detached HEAD",
          icon: "worktree" as const,
          modifierClassName: "is-detached-worktree",
        },
      ]
    : [];
  const refPills = [...branchPills, ...mergedRefPills, ...detachedWorktreePills];

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
    hashSectionClassName: "commit-hover-section commit-hover-hash-section",
    headerClassName: "commit-hover-header",
    authorClassName: "commit-hover-author",
    timeClassName: "commit-hover-time",
    titleClassName: "commit-hover-title",
    statsClassName: "commit-hover-stats",
    refsClassName: "commit-hover-refs",
    refPillClassName: "ref-pill commit-hover-ref-pill",
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
    hash: commit.hash,
    fullHash: commit.fullHash || commit.hash,
  };
}
