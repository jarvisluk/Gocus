import { GitBranch, X } from "lucide-react";

export type BranchPrefix = "none" | "feat" | "fix" | "chore" | "docs" | "refactor" | "test";

const branchPrefixOptions: { value: BranchPrefix; label: string }[] = [
  { value: "none", label: "None" },
  { value: "feat", label: "feat" },
  { value: "fix", label: "fix" },
  { value: "chore", label: "chore" },
  { value: "docs", label: "docs" },
  { value: "refactor", label: "refactor" },
  { value: "test", label: "test" },
];

export function branchNameWithPrefix(prefix: BranchPrefix, branchName: string) {
  const trimmedName = branchName.trim().replace(/^\/+/, "");
  if (!trimmedName || prefix === "none" || trimmedName.startsWith(`${prefix}/`)) return trimmedName;
  return `${prefix}/${trimmedName}`;
}

export type ActionDialogState =
  | {
      type: "createBranch";
      title: string;
      body: string;
      branchPrefix: BranchPrefix;
      branchName: string;
    }
  | {
      type: "checkout";
      title: string;
      body: string;
    };

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
  if (!dialog) return null;
  const resolvedBranchName = dialog.type === "createBranch" ? branchNameWithPrefix(dialog.branchPrefix, dialog.branchName) : "";

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
          <div className="action-branch-fields">
            <label className="action-branch-field">
              <span>Prefix</span>
              <div className="ui-select-frame">
                <select
                  className="ui-select"
                  value={dialog.branchPrefix}
                  onChange={(event) => onBranchPrefixChange(event.target.value as BranchPrefix)}
                  aria-label="Branch prefix"
                >
                  {branchPrefixOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="action-branch-field">
              <span>Name</span>
              <input className="ui-input" value={dialog.branchName} onChange={(event) => onBranchNameChange(event.target.value)} autoFocus aria-label="Branch name" />
            </label>
            {resolvedBranchName ? <code className="action-branch-preview">{resolvedBranchName}</code> : null}
          </div>
        ) : null}
        <div className="ui-dialog-actions action-dialog-actions">
          <button className="ui-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="ui-button primary" type="button" onClick={onConfirm} disabled={dialog.type === "createBranch" && !resolvedBranchName}>
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
}
