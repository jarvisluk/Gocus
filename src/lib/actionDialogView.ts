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
  return branches
    .filter((branch) => branch.type === "local" && branch.name)
    .map((branch) => ({
      name: branch.name,
      current: branch.current || branch.name === currentBranchName,
    }))
    .sort((left, right) => Number(right.current) - Number(left.current) || left.name.localeCompare(right.name));
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

export function actionDialogView(dialog: ActionDialogState) {
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
      className: "ui-layer-panel ui-code-block action-dialog-error",
      id: actionDialogErrorId,
      role: "alert" as const,
      message: actionErrorMessage,
    },
    showActionError: Boolean(actionErrorMessage),
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
