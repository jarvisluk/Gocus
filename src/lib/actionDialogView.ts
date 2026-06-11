import {
  branchNameMaxLength,
  branchNameValidationMessage,
  branchNameWithPrefix,
  branchPrefixes,
  type BranchPrefix,
} from "./branchNames";
import type { CommitAction, CommitItem, GitBranchRef } from "../types";

export type { BranchPrefix } from "./branchNames";
export type { CommitAction } from "../types";

export const actionBranchErrorId = "action-branch-error";
export const actionBranchPreviewId = "action-branch-preview";
export const actionBranchPrefixMenuId = "action-branch-prefix-menu";
export const actionBranchPrefixTriggerId = "action-branch-prefix-trigger";
export const actionMergeTargetErrorId = "action-merge-target-error";
export const actionMergeTargetMenuId = "action-merge-target-menu";
export const actionMergeTargetTriggerId = "action-merge-target-trigger";
export const actionDialogErrorId = "action-dialog-error";
export const actionDialogTitleId = "action-dialog-title";
export const actionDialogBodyId = "action-dialog-body";

export const branchPrefixOptions: { value: BranchPrefix; label: string }[] = [
  ...branchPrefixes.map((prefix) => ({ value: prefix, label: prefix === "none" ? "None" : prefix })),
];

export interface MergeTargetBranchOption {
  name: string;
  current: boolean;
}

export type ActionDialogGlobalKeyAction = "cancel" | "ignore";
export type ActionDialogBranchNameKeyAction = "confirm" | "block" | "ignore";
export type ActionDialogCopyPromptState = "idle" | "copied" | "failed";
export type ActionDialogCopyPromptIcon = "copy" | "check" | "x";
export type ActionDialogConfirmation =
  | {
      type: "createBranch";
      branchName: string;
      baseHash: string;
      fallbackNotice: string;
      failureNotice: string;
    }
  | {
      type: "checkout";
      ref: string;
      fallbackNotice: string;
      failureNotice: string;
    }
  | {
      type: "merge";
      ref: string;
      targetBranch: string;
      fallbackNotice: string;
      failureNotice: string;
    };

export type ActionDialogState =
  | {
      type: "createBranch";
      title: string;
      body: string;
      branchPrefix: BranchPrefix;
      branchName: string;
      commit?: Pick<CommitItem, "fullHash" | "hash">;
    }
  | {
      type: "checkout";
      title: string;
      body: string;
      ref?: string;
      fallbackNotice?: string;
      failureNotice?: string;
    }
  | {
      type: "merge";
      title: string;
      body: string;
      ref?: string;
      targetBranch: string;
      targetBranches: MergeTargetBranchOption[];
      error?: string;
    };

export function createBranchActionDialog(commit: Pick<CommitItem, "fullHash" | "hash">): ActionDialogState {
  return {
    type: "createBranch",
    title: "Create branch",
    body: `Start a new branch from ${commit.hash}.`,
    branchPrefix: "none",
    branchName: commit.hash,
    commit: {
      fullHash: commit.fullHash,
      hash: commit.hash,
    },
  };
}

export function checkoutCommitActionDialog(commit: Pick<CommitItem, "fullHash" | "hash">): ActionDialogState {
  return {
    type: "checkout",
    title: "Checkout commit",
    body: `Checkout ${commit.hash}. This can detach HEAD.`,
    ref: commit.fullHash,
  };
}

export function mergeTargetBranchOptions(
  branches: readonly Pick<GitBranchRef, "current" | "name" | "type">[],
  currentBranchName = "",
): MergeTargetBranchOption[] {
  const priority = (branch: MergeTargetBranchOption) => {
    if (branch.current) return 0;
    if (branch.name === "main") return 1;
    if (branch.name === "develop") return 2;
    if (branch.name === "master") return 3;
    return 4;
  };

  return branches
    .filter((branch) => branch.type === "local" && branch.name)
    .map((branch) => ({
      name: branch.name,
      current: branch.current || branch.name === currentBranchName,
    }))
    .sort((left, right) => priority(left) - priority(right) || left.name.localeCompare(right.name));
}

export function mergeCommitActionDialog(
  commit: Pick<CommitItem, "fullHash" | "hash">,
  options: { targetBranches?: MergeTargetBranchOption[] } = {},
): ActionDialogState {
  const targetBranches = options.targetBranches ?? [];
  const targetBranch = targetBranches.find((branch) => branch.current)?.name ?? targetBranches[0]?.name ?? "";

  return {
    type: "merge",
    title: "Merge commit",
    body: `Merge ${commit.hash} into the selected target branch. The working folder will end on that branch.`,
    ref: commit.fullHash,
    targetBranch,
    targetBranches,
  };
}

export function commitActionDialog(
  action: CommitAction,
  commit: Pick<CommitItem, "fullHash" | "hash">,
  options: { targetBranches?: MergeTargetBranchOption[] } = {},
): ActionDialogState {
  if (action === "branch") return createBranchActionDialog(commit);
  if (action === "merge") return mergeCommitActionDialog(commit, options);
  return checkoutCommitActionDialog(commit);
}

export function checkoutRefActionDialog(ref: string): ActionDialogState {
  return {
    type: "checkout",
    title: "Switch branch",
    body: `Switch the working folder to ${ref}.`,
    ref,
    fallbackNotice: `Switched to ${ref}.`,
    failureNotice: "Unable to switch branch.",
  };
}

export function actionDialogGlobalKeyAction(key: string): ActionDialogGlobalKeyAction {
  return key === "Escape" ? "cancel" : "ignore";
}

export function actionDialogBranchNameKeyAction(key: string, confirmDisabled: boolean): ActionDialogBranchNameKeyAction {
  if (key !== "Enter") return "ignore";
  return confirmDisabled ? "block" : "confirm";
}

export function actionBranchPrefixOptionView(option: { value: BranchPrefix; label: string }, activePrefix: BranchPrefix) {
  return {
    key: option.value,
    value: option.value,
    label: option.label,
    active: option.value === activePrefix,
    className: option.value === activePrefix ? "ui-menu-item action-prefix-menu-item is-active" : "ui-menu-item action-prefix-menu-item",
    role: "menuitem" as const,
    ariaCurrent: option.value === activePrefix ? ("true" as const) : undefined,
  };
}

export function actionMergeTargetOptionView(option: MergeTargetBranchOption, activeBranch: string) {
  return {
    key: option.name,
    branchName: option.name,
    label: option.current ? `${option.name} current` : option.name,
    active: option.name === activeBranch,
    className:
      option.name === activeBranch ? "ui-menu-item action-merge-target-menu-item is-active" : "ui-menu-item action-merge-target-menu-item",
    role: "menuitem" as const,
    ariaCurrent: option.name === activeBranch ? ("true" as const) : undefined,
    title: option.name,
  };
}

export function actionDialogAfterBranchNameChange(dialog: ActionDialogState | null, branchName: string): ActionDialogState | null {
  return dialog?.type === "createBranch" ? { ...dialog, branchName } : dialog;
}

export function actionDialogAfterBranchPrefixChange(
  dialog: ActionDialogState | null,
  branchPrefix: BranchPrefix,
): ActionDialogState | null {
  return dialog?.type === "createBranch" ? { ...dialog, branchPrefix } : dialog;
}

export function actionDialogAfterMergeTargetChange(dialog: ActionDialogState | null, targetBranch: string): ActionDialogState | null {
  return dialog?.type === "merge" ? { ...dialog, targetBranch, error: "" } : dialog;
}

export function actionDialogAfterMergeError(dialog: ActionDialogState | null, error: string): ActionDialogState | null {
  return dialog?.type === "merge" ? { ...dialog, error } : dialog;
}

function mergePromptSubjectPart(value: string, fallback: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  if (/^[0-9a-f]{12,}$/i.test(clean)) return clean.slice(0, 7);
  return clean;
}

export function mergeFailureAgentPrompt({
  createMergeCommit,
  error,
  ref,
  targetBranch,
}: {
  createMergeCommit?: boolean;
  error: string;
  ref?: string;
  targetBranch: string;
}) {
  const sourceRef = ref?.trim() || "unknown";
  const target = targetBranch.trim() || "unknown";
  const errorText = error.trim() || "No error output was captured.";
  const fallbackMergeSubject = [
    "chore: merge",
    mergePromptSubjectPart(sourceRef, "ref"),
    "into",
    mergePromptSubjectPart(target, "current branch"),
  ].join(" ");
  const mergeInstructions = [
    [
      "Please inspect the current repository state with git status, resolve the merge conflict or blocker,",
      "keep unrelated worktree changes intact, run the relevant tests/build, and leave a concise summary of what changed.",
      "If a merge is already in progress, continue from that state instead of starting over.",
    ].join(" "),
    [
      "After switching to the target/current branch, if git status shows uncommitted changes, first check whether each change",
      "is already represented by the source ref/commit or the current merge result.",
      "Do not stash changes that are already done;",
      "stash or move only unrelated local changes that would otherwise block checkout or merge.",
    ].join(" "),
    [
      "Before creating or finalizing the merge commit, check for documented commit-message rules;",
      "if none are present, use Conventional Commits.",
      `For this attempted merge, a valid fallback subject is \`${fallbackMergeSubject}\`;`,
      "do not use Git's default `Merge branch ...` or `Merge commit ...` subject.",
    ].join(" "),
  ];

  if (createMergeCommit) {
    mergeInstructions.push(
      [
        "No-fast-forward merges are enabled in Settings, so do not complete this as a fast-forward merge;",
        "preserve an explicit merge commit when retrying or finishing the merge.",
      ].join(" "),
    );
  }

  return [
    "A Git merge failed in this repository. Please handle it end to end.",
    "",
    "Attempted merge:",
    `- Source ref/commit: ${sourceRef}`,
    `- Target branch: ${target}`,
    "",
    "Failure output:",
    "```text",
    errorText,
    "```",
    "",
    ...mergeInstructions,
  ].join("\n");
}

export function actionDialogCopyPromptButtonView(copyState: ActionDialogCopyPromptState) {
  if (copyState === "copied") {
    return {
      className: "ui-button action-dialog-copy-prompt",
      label: "Copied prompt",
      title: "Copied prompt",
      icon: "check" as ActionDialogCopyPromptIcon,
    };
  }

  if (copyState === "failed") {
    return {
      className: "ui-button action-dialog-copy-prompt",
      label: "Copy failed",
      title: "Copy failed",
      icon: "x" as ActionDialogCopyPromptIcon,
    };
  }

  return {
    className: "ui-button action-dialog-copy-prompt",
    label: "Copy agent prompt",
    title: "Copy agent prompt",
    icon: "copy" as ActionDialogCopyPromptIcon,
  };
}

export function actionDialogConfirmation(dialog: ActionDialogState | null): ActionDialogConfirmation | null {
  if (!dialog) return null;

  if (dialog.type === "createBranch" && dialog.commit) {
    const { branchValidationMessage, resolvedBranchName } = actionDialogView(dialog);
    if (branchValidationMessage) return null;

    return {
      type: "createBranch",
      branchName: resolvedBranchName,
      baseHash: dialog.commit.fullHash,
      fallbackNotice: `Created ${resolvedBranchName}.`,
      failureNotice: "Unable to create branch.",
    };
  }

  if (dialog.type === "checkout" && dialog.ref) {
    return {
      type: "checkout",
      ref: dialog.ref,
      fallbackNotice: dialog.fallbackNotice ?? "Checkout complete.",
      failureNotice: dialog.failureNotice ?? "Unable to checkout ref.",
    };
  }

  if (dialog.type === "merge" && dialog.ref && dialog.targetBranch) {
    return {
      type: "merge",
      ref: dialog.ref,
      targetBranch: dialog.targetBranch,
      fallbackNotice: `Merged into ${dialog.targetBranch}.`,
      failureNotice: "Unable to merge ref.",
    };
  }

  return null;
}

export function actionDialogView(dialog: ActionDialogState, { createMergeCommit = false }: { createMergeCommit?: boolean } = {}) {
  const isCreateBranch = dialog.type === "createBranch";
  const isMerge = dialog.type === "merge";
  const resolvedBranchName = isCreateBranch ? branchNameWithPrefix(dialog.branchPrefix, dialog.branchName) : "";
  const branchPrefixLength =
    isCreateBranch && dialog.branchPrefix !== "none" && !dialog.branchName.trim().startsWith(`${dialog.branchPrefix}/`)
      ? dialog.branchPrefix.length + 1
      : 0;
  const branchInputMaxLength = Math.max(0, branchNameMaxLength - branchPrefixLength);
  const branchValidationMessage = isCreateBranch ? branchNameValidationMessage(resolvedBranchName) : "";
  const mergeTargetValidationMessage =
    isMerge && dialog.targetBranches.length === 0
      ? "No local branches available."
      : isMerge && !dialog.targetBranch
        ? "Choose a target branch."
        : "";
  const confirmDisabled = Boolean((isCreateBranch && branchValidationMessage) || mergeTargetValidationMessage);
  const showResolvedBranchName = Boolean(resolvedBranchName);
  const branchErrorId = branchValidationMessage ? actionBranchErrorId : undefined;
  const actionErrorMessage = isMerge ? dialog.error?.trim() ?? "" : "";
  const actionErrorId = actionErrorMessage ? actionDialogErrorId : undefined;
  const mergeFailurePrompt =
    isMerge && actionErrorMessage
      ? mergeFailureAgentPrompt({
          createMergeCommit,
          error: actionErrorMessage,
          ref: dialog.ref,
          targetBranch: dialog.targetBranch,
        })
      : "";
  const branchInputDescriptionIds = [showResolvedBranchName ? actionBranchPreviewId : undefined, branchErrorId].filter(Boolean);
  const dialogDescriptionIds = [actionDialogBodyId, actionErrorId].filter(Boolean);

  return {
    isCreateBranch,
    isMerge,
    backdrop: {
      className: "ui-dialog-backdrop action-dialog-backdrop",
      role: "presentation" as const,
    },
    dialog: {
      className: "ui-dialog ui-layer-panel action-dialog",
      role: "dialog" as const,
      ariaModal: true,
      ariaLabelledBy: actionDialogTitleId,
      ariaDescribedBy: dialogDescriptionIds.join(" "),
    },
    heading: {
      className: "ui-dialog-heading action-dialog-heading",
      id: actionDialogTitleId,
    },
    closeButton: {
      className: "ui-icon-button",
      ariaLabel: "Close dialog",
    },
    body: {
      className: "ui-dialog-body",
      id: actionDialogBodyId,
    },
    showBranchFields: isCreateBranch,
    branchFields: {
      containerClassName: "action-branch-fields",
      fieldClassName: "action-branch-field",
      prefixLabel: "Prefix",
      prefixControlClassName: "action-prefix-control",
      prefixTriggerId: actionBranchPrefixTriggerId,
      prefixTriggerClassName: "action-prefix-trigger ui-disclosure-button",
      prefixAriaLabel: "Branch prefix",
      prefixMenuId: actionBranchPrefixMenuId,
      prefixMenuClassName: "ui-menu action-prefix-menu",
      prefixMenuRole: "menu" as const,
      nameLabel: "Name",
      nameInputClassName: "ui-input",
      nameMaxLength: branchInputMaxLength,
      nameAriaLabel: "Branch name",
      previewClassName: "action-branch-preview",
      previewId: actionBranchPreviewId,
      errorClassName: "action-branch-error",
    },
    showMergeFields: isMerge,
    mergeFields: {
      containerClassName: "action-merge-fields",
      fieldClassName: "action-branch-field",
      targetLabel: "Target",
      targetControlClassName: "action-merge-target-control",
      targetTriggerId: actionMergeTargetTriggerId,
      targetTriggerClassName: "action-merge-target-trigger ui-disclosure-button",
      targetAriaLabel: "Merge target branch",
      targetMenuId: actionMergeTargetMenuId,
      targetMenuClassName: "ui-menu action-merge-target-menu",
      targetMenuRole: "menu" as const,
      errorClassName: "action-branch-error",
    },
    mergeTargetBranch: isMerge ? dialog.targetBranch : "",
    mergeTargetBranches: isMerge ? dialog.targetBranches : [],
    mergeTargetValidationMessage,
    showMergeTargetValidationMessage: Boolean(mergeTargetValidationMessage),
    mergeTargetErrorId: mergeTargetValidationMessage ? actionMergeTargetErrorId : undefined,
    actionError: {
      containerClassName: "action-dialog-error-block",
      className: "ui-layer-panel ui-code-block action-dialog-error",
      id: actionDialogErrorId,
      role: "alert" as const,
      message: actionErrorMessage,
    },
    showActionError: Boolean(actionErrorMessage),
    mergeFailurePrompt,
    showMergeFailurePrompt: Boolean(mergeFailurePrompt),
    resolvedBranchName,
    showResolvedBranchName,
    branchValidationMessage,
    showBranchValidationMessage: Boolean(branchValidationMessage),
    branchErrorId,
    branchInputInvalid: Boolean(branchValidationMessage),
    branchInputAriaInvalid: branchValidationMessage ? (true as const) : undefined,
    branchInputDescribedBy: branchInputDescriptionIds.length > 0 ? branchInputDescriptionIds.join(" ") : undefined,
    confirmDisabled,
    cancelAutoFocus: dialog.type !== "createBranch",
    actions: {
      className: "ui-dialog-actions action-dialog-actions",
    },
    cancelButton: {
      className: "ui-button",
      label: "Cancel",
      autoFocus: dialog.type !== "createBranch",
    },
    confirmButton: {
      className: "ui-button primary",
      label: "Confirm",
      disabled: confirmDisabled,
    },
  };
}
