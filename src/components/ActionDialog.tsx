import { GitBranch, X } from "lucide-react";
import { useEffect } from "react";
import {
  actionDialogBranchNameKeyAction,
  actionDialogGlobalKeyAction,
  actionDialogView,
  branchPrefixOptions,
  type ActionDialogState,
  type BranchPrefix,
} from "../lib/actionDialogView";

export function ActionDialog({
  dialog,
  onBranchPrefixChange,
  onBranchNameChange,
  onCancel,
  onConfirm,
}: {
  dialog: ActionDialogState | null;
  onBranchPrefixChange: (branchPrefix: BranchPrefix) => void;
  onBranchNameChange: (branchName: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!dialog) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (actionDialogGlobalKeyAction(event.key) !== "cancel") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [dialog, onCancel]);

  if (!dialog) return null;
  const view = actionDialogView(dialog);

  return (
    <div className={view.backdrop.className} role={view.backdrop.role}>
      <section
        className={view.dialog.className}
        role={view.dialog.role}
        aria-modal={view.dialog.ariaModal}
        aria-labelledby={view.dialog.ariaLabelledBy}
        aria-describedby={view.dialog.ariaDescribedBy}
      >
        <div className={view.heading.className}>
          <GitBranch aria-hidden="true" />
          <h2 id={view.heading.id}>{dialog.title}</h2>
          <button className={view.closeButton.className} type="button" aria-label={view.closeButton.ariaLabel} onClick={onCancel}>
            <X aria-hidden="true" />
          </button>
        </div>
        <p className={view.body.className} id={view.body.id}>
          {dialog.body}
        </p>
        {view.showBranchFields && dialog.type === "createBranch" ? (
          <div className={view.branchFields.containerClassName}>
            <label className={view.branchFields.fieldClassName}>
              <span>{view.branchFields.prefixLabel}</span>
              <div className={view.branchFields.selectFrameClassName}>
                <select
                  className={view.branchFields.prefixSelectClassName}
                  value={dialog.branchPrefix}
                  onChange={(event) => onBranchPrefixChange(event.target.value as BranchPrefix)}
                  aria-label={view.branchFields.prefixAriaLabel}
                >
                  {branchPrefixOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className={view.branchFields.fieldClassName}>
              <span>{view.branchFields.nameLabel}</span>
              <input
                className={view.branchFields.nameInputClassName}
                value={dialog.branchName}
                onChange={(event) => onBranchNameChange(event.target.value)}
                onKeyDown={(event) => {
                  const keyAction = actionDialogBranchNameKeyAction(event.key, view.confirmDisabled);
                  if (keyAction === "ignore") return;
                  event.preventDefault();
                  if (keyAction === "confirm") onConfirm();
                }}
                autoFocus
                aria-label={view.branchFields.nameAriaLabel}
                aria-invalid={view.branchInputAriaInvalid}
                aria-describedby={view.branchInputDescribedBy}
              />
            </label>
            {view.showResolvedBranchName ? (
              <code className={view.branchFields.previewClassName} id={view.branchFields.previewId}>
                {view.resolvedBranchName}
              </code>
            ) : null}
            {view.showBranchValidationMessage ? (
              <p className={view.branchFields.errorClassName} id={view.branchErrorId} role="alert">
                {view.branchValidationMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className={view.actions.className}>
          <button className={view.cancelButton.className} type="button" onClick={onCancel} autoFocus={view.cancelButton.autoFocus}>
            {view.cancelButton.label}
          </button>
          <button className={view.confirmButton.className} type="button" onClick={onConfirm} disabled={view.confirmButton.disabled}>
            {view.confirmButton.label}
          </button>
        </div>
      </section>
    </div>
  );
}
