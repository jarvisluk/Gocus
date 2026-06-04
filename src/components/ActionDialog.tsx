import { GitBranch, X } from "lucide-react";

export type ActionDialogState =
  | {
      type: "createBranch";
      title: string;
      body: string;
      branchName: string;
    }
  | {
      type: "checkout";
      title: string;
      body: string;
    };

export function ActionDialog({
  dialog,
  onBranchNameChange,
  onCancel,
  onConfirm,
}: {
  dialog: ActionDialogState | null;
  onBranchNameChange: (branchName: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!dialog) return null;

  return (
    <div className="ui-dialog-backdrop action-dialog-backdrop" role="presentation">
      <section className="ui-dialog action-dialog" role="dialog" aria-modal="true" aria-label={dialog.title}>
        <div className="ui-dialog-heading action-dialog-heading">
          <GitBranch aria-hidden="true" />
          <h2>{dialog.title}</h2>
          <button className="ui-icon-button" type="button" aria-label="Close dialog" onClick={onCancel}>
            <X aria-hidden="true" />
          </button>
        </div>
        <p className="ui-dialog-body">{dialog.body}</p>
        {dialog.type === "createBranch" ? (
          <input className="ui-input" value={dialog.branchName} onChange={(event) => onBranchNameChange(event.target.value)} autoFocus aria-label="Branch name" />
        ) : null}
        <div className="ui-dialog-actions action-dialog-actions">
          <button className="ui-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="ui-button primary" type="button" onClick={onConfirm} disabled={dialog.type === "createBranch" && !dialog.branchName.trim()}>
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
}
