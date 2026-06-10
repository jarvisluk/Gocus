import { branchNameValidationMessage, branchNameWithPrefix, branchPrefixes, type BranchPrefix } from "./branchNames";
import type { CommitAction, CommitItem } from "../types";

export type { BranchPrefix } from "./branchNames";
export type { CommitAction } from "../types";

export const actionBranchErrorId = "action-branch-error";
export const actionBranchPreviewId = "action-branch-preview";
export const actionDialogTitleId = "action-dialog-title";
export const actionDialogBodyId = "action-dialog-body";

export const branchPrefixOptions: { value: BranchPrefix; label: string }[] = [
  ...branchPrefixes.map((prefix) => ({ value: prefix, label: prefix === "none" ? "None" : prefix })),
];

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

export function commitActionDialog(
  action: CommitAction,
  commit: Pick<CommitItem, "fullHash" | "hash">,
): ActionDialogState {
  return action === "branch" ? createBranchActionDialog(commit) : checkoutCommitActionDialog(commit);
}

export function checkoutRefActionDialog(ref: string): ActionDialogState {
  return {
    type: "checkout",
    title: "Checkout branch",
    body: `Switch the working folder to ${ref}.`,
    ref,
  };
}

export function actionDialogGlobalKeyAction(key: string): ActionDialogGlobalKeyAction {
  return key === "Escape" ? "cancel" : "ignore";
}

export function actionDialogBranchNameKeyAction(key: string, confirmDisabled: boolean): ActionDialogBranchNameKeyAction {
  if (key !== "Enter") return "ignore";
  return confirmDisabled ? "block" : "confirm";
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
      fallbackNotice: "Checkout complete.",
      failureNotice: "Unable to checkout ref.",
    };
  }

  return null;
}

export function actionDialogView(dialog: ActionDialogState) {
  const isCreateBranch = dialog.type === "createBranch";
  const resolvedBranchName = isCreateBranch ? branchNameWithPrefix(dialog.branchPrefix, dialog.branchName) : "";
  const branchValidationMessage = isCreateBranch ? branchNameValidationMessage(resolvedBranchName) : "";
  const confirmDisabled = Boolean(isCreateBranch && branchValidationMessage);
  const showResolvedBranchName = Boolean(resolvedBranchName);
  const branchErrorId = branchValidationMessage ? actionBranchErrorId : undefined;
  const branchInputDescriptionIds = [showResolvedBranchName ? actionBranchPreviewId : undefined, branchErrorId].filter(Boolean);

  return {
    isCreateBranch,
    backdrop: {
      className: "ui-dialog-backdrop action-dialog-backdrop",
      role: "presentation" as const,
    },
    dialog: {
      className: "ui-dialog ui-layer-panel action-dialog",
      role: "dialog" as const,
      ariaModal: true,
      ariaLabelledBy: actionDialogTitleId,
      ariaDescribedBy: actionDialogBodyId,
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
      selectFrameClassName: "ui-select-frame",
      prefixSelectClassName: "ui-select",
      prefixAriaLabel: "Branch prefix",
      nameLabel: "Name",
      nameInputClassName: "ui-input",
      nameAriaLabel: "Branch name",
      previewClassName: "action-branch-preview",
      previewId: actionBranchPreviewId,
      errorClassName: "action-branch-error",
    },
    resolvedBranchName,
    showResolvedBranchName,
    branchValidationMessage,
    showBranchValidationMessage: Boolean(branchValidationMessage),
    branchErrorId,
    branchInputInvalid: Boolean(branchValidationMessage),
    branchInputAriaInvalid: branchValidationMessage ? (true as const) : undefined,
    branchInputDescribedBy: branchInputDescriptionIds.length > 0 ? branchInputDescriptionIds.join(" ") : undefined,
    confirmDisabled,
    cancelAutoFocus: dialog.type === "checkout",
    actions: {
      className: "ui-dialog-actions action-dialog-actions",
    },
    cancelButton: {
      className: "ui-button",
      label: "Cancel",
      autoFocus: dialog.type === "checkout",
    },
    confirmButton: {
      className: "ui-button primary",
      label: "Confirm",
      disabled: confirmDisabled,
    },
  };
}
