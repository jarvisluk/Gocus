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
    <div className="action-dialog-backdrop" role="presentation">
      <section className="action-dialog" role="dialog" aria-modal="true" aria-label={dialog.title}>
        <div className="action-dialog-heading">
          <GitBranch aria-hidden="true" />
          <h2>{dialog.title}</h2>
          <button type="button" aria-label="Close dialog" onClick={onCancel}>
            <X aria-hidden="true" />
          </button>
        </div>
        <p>{dialog.body}</p>
        {dialog.type === "createBranch" ? (
          <input value={dialog.branchName} onChange={(event) => onBranchNameChange(event.target.value)} autoFocus aria-label="Branch name" />
        ) : null}
        <div className="action-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" type="button" onClick={onConfirm} disabled={dialog.type === "createBranch" && !dialog.branchName.trim()}>
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
}
