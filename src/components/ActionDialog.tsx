import { Check, ChevronDown, Copy, GitBranch, GitMerge, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  actionBranchPrefixOptionView,
  actionDialogCopyPromptButtonView,
  actionMergeTargetOptionView,
  actionDialogBranchNameKeyAction,
  actionDialogGlobalKeyAction,
  actionDialogView,
  branchPrefixOptions,
  type ActionDialogCopyPromptIcon,
  type ActionDialogCopyPromptState,
  type ActionDialogState,
  type BranchPrefix,
} from "../lib/actionDialogView";
import { copyTextWithFallback } from "../lib/copyText";
import { logBridgeWarning } from "../lib/errorMessages";
import { useDismissableLayer } from "../lib/useDismissableLayer";

const copyPromptStateResetDelayMs = 1400;

function BranchPrefixDropdown({
  value,
  open,
  view,
  onOpenChange,
  onChange,
}: {
  value: BranchPrefix;
  open: boolean;
  view: ReturnType<typeof actionDialogView>["branchFields"];
  onOpenChange: (open: boolean) => void;
  onChange: (branchPrefix: BranchPrefix) => void;
}) {
  const controlRef = useRef<HTMLDivElement>(null);
  const selectedOption = branchPrefixOptions.find((option) => option.value === value) ?? branchPrefixOptions[0];

  useDismissableLayer({
    active: open,
    refs: [controlRef],
    onDismiss: () => onOpenChange(false),
  });

  function selectPrefix(branchPrefix: BranchPrefix) {
    onChange(branchPrefix);
    onOpenChange(false);
  }

  return (
    <div className={view.prefixControlClassName} ref={controlRef}>
      <button
        id={view.prefixTriggerId}
        className={`${view.prefixTriggerClassName}${open ? " is-open" : ""}`}
        type="button"
        aria-label={view.prefixAriaLabel}
        aria-haspopup={view.prefixMenuRole}
        aria-expanded={open}
        aria-controls={view.prefixMenuId}
        onClick={() => onOpenChange(!open)}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div className={view.prefixMenuClassName} id={view.prefixMenuId} role={view.prefixMenuRole} aria-labelledby={view.prefixTriggerId}>
          {branchPrefixOptions.map((option) => {
            const optionView = actionBranchPrefixOptionView(option, value);

            return (
              <button
                className={optionView.className}
                type="button"
                role={optionView.role}
                aria-current={optionView.ariaCurrent}
                key={optionView.key}
                onClick={() => selectPrefix(optionView.value)}
              >
                {optionView.active ? <Check aria-hidden="true" /> : <span aria-hidden="true" />}
                <span>{optionView.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MergeTargetDropdown({
  value,
  open,
  view,
  onOpenChange,
  onChange,
}: {
  value: string;
  open: boolean;
  view: ReturnType<typeof actionDialogView>;
  onOpenChange: (open: boolean) => void;
  onChange: (targetBranch: string) => void;
}) {
  const controlRef = useRef<HTMLDivElement>(null);
  const selectedBranch = view.mergeTargetBranches.find((branch) => branch.name === value);

  useDismissableLayer({
    active: open,
    refs: [controlRef],
    onDismiss: () => onOpenChange(false),
  });

  function selectTarget(targetBranch: string) {
    onChange(targetBranch);
    onOpenChange(false);
  }

  return (
    <div className={view.mergeFields.targetControlClassName} ref={controlRef}>
      <button
        id={view.mergeFields.targetTriggerId}
        className={`${view.mergeFields.targetTriggerClassName}${open ? " is-open" : ""}`}
        type="button"
        aria-label={view.mergeFields.targetAriaLabel}
        aria-haspopup={view.mergeFields.targetMenuRole}
        aria-expanded={open}
        aria-controls={view.mergeFields.targetMenuId}
        disabled={view.mergeTargetBranches.length === 0}
        onClick={() => onOpenChange(!open)}
      >
        <span>{selectedBranch?.name ?? "No local branches"}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={view.mergeFields.targetMenuClassName}
          id={view.mergeFields.targetMenuId}
          role={view.mergeFields.targetMenuRole}
          aria-labelledby={view.mergeFields.targetTriggerId}
        >
          {view.mergeTargetBranches.map((option) => {
            const optionView = actionMergeTargetOptionView(option, value);

            return (
              <button
                className={optionView.className}
                type="button"
                role={optionView.role}
                aria-current={optionView.ariaCurrent}
                title={optionView.title}
                key={optionView.key}
                onClick={() => selectTarget(optionView.branchName)}
              >
                {optionView.active ? <Check aria-hidden="true" /> : <GitBranch aria-hidden="true" />}
                <span>{optionView.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function copyPromptIcon(icon: ActionDialogCopyPromptIcon) {
  if (icon === "check") return <Check aria-hidden="true" />;
  if (icon === "x") return <X aria-hidden="true" />;
  return <Copy aria-hidden="true" />;
}

export function ActionDialog({
  createMergeCommit,
  dialog,
  onBranchPrefixChange,
  onBranchNameChange,
  onMergeTargetChange,
  onCancel,
  onConfirm,
}: {
  createMergeCommit: boolean;
  dialog: ActionDialogState | null;
  onBranchPrefixChange: (branchPrefix: BranchPrefix) => void;
  onBranchNameChange: (branchName: string) => void;
  onMergeTargetChange: (targetBranch: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [prefixMenuOpen, setPrefixMenuOpen] = useState(false);
  const [mergeTargetMenuOpen, setMergeTargetMenuOpen] = useState(false);
  const [copyPromptState, setCopyPromptState] = useState<ActionDialogCopyPromptState>("idle");
  const copyPromptResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dialog) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (actionDialogGlobalKeyAction(event.key) !== "cancel") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (prefixMenuOpen || mergeTargetMenuOpen) {
        setPrefixMenuOpen(false);
        setMergeTargetMenuOpen(false);
        return;
      }
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [dialog, mergeTargetMenuOpen, onCancel, prefixMenuOpen]);

  useEffect(() => {
    setPrefixMenuOpen(false);
    setMergeTargetMenuOpen(false);
    setCopyPromptState("idle");
  }, [dialog]);

  useEffect(
    () => () => {
      if (copyPromptResetTimerRef.current !== null) window.clearTimeout(copyPromptResetTimerRef.current);
    },
    [],
  );

  if (!dialog) return null;
  const view = actionDialogView(dialog, { createMergeCommit });
  const HeadingIcon = dialog.type === "merge" ? GitMerge : GitBranch;
  const copyPromptButton = view.showMergeFailurePrompt ? actionDialogCopyPromptButtonView(copyPromptState) : null;

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    onCancel();
  }

  function setTemporaryCopyPromptState(nextState: ActionDialogCopyPromptState) {
    if (copyPromptResetTimerRef.current !== null) window.clearTimeout(copyPromptResetTimerRef.current);
    setCopyPromptState(nextState);
    copyPromptResetTimerRef.current = window.setTimeout(() => {
      setCopyPromptState("idle");
      copyPromptResetTimerRef.current = null;
    }, copyPromptStateResetDelayMs);
  }

  async function copyMergeFailurePrompt(prompt: string) {
    try {
      await copyTextWithFallback(prompt, { bridge: window.gocus, clipboard: navigator.clipboard });
      setTemporaryCopyPromptState("copied");
    } catch (error) {
      logBridgeWarning("Unable to copy merge failure prompt.", error);
      setTemporaryCopyPromptState("failed");
    }
  }

  return (
    <div className={view.backdrop.className} role={view.backdrop.role} onMouseDown={handleBackdropMouseDown}>
      <section
        className={view.dialog.className}
        role={view.dialog.role}
        aria-modal={view.dialog.ariaModal}
        aria-labelledby={view.dialog.ariaLabelledBy}
        aria-describedby={view.dialog.ariaDescribedBy}
      >
        <div className={view.heading.className}>
          <HeadingIcon aria-hidden="true" />
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
            <div className={view.branchFields.fieldClassName}>
              <span>{view.branchFields.prefixLabel}</span>
              <BranchPrefixDropdown
                value={dialog.branchPrefix}
                open={prefixMenuOpen}
                view={view.branchFields}
                onOpenChange={(open) => {
                  setPrefixMenuOpen(open);
                  if (open) setMergeTargetMenuOpen(false);
                }}
                onChange={onBranchPrefixChange}
              />
            </div>
            <label className={view.branchFields.fieldClassName}>
              <span>{view.branchFields.nameLabel}</span>
              <input
                className={view.branchFields.nameInputClassName}
                value={dialog.branchName}
                onChange={(event) => onBranchNameChange(event.target.value)}
                maxLength={view.branchFields.nameMaxLength}
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
        {view.showMergeFields && dialog.type === "merge" ? (
          <div className={view.mergeFields.containerClassName}>
            <div className={view.mergeFields.fieldClassName}>
              <span>{view.mergeFields.targetLabel}</span>
              <MergeTargetDropdown
                value={dialog.targetBranch}
                open={mergeTargetMenuOpen}
                view={view}
                onOpenChange={(open) => {
                  setMergeTargetMenuOpen(open);
                  if (open) setPrefixMenuOpen(false);
                }}
                onChange={onMergeTargetChange}
              />
            </div>
            {view.showMergeTargetValidationMessage ? (
              <p className={view.mergeFields.errorClassName} id={view.mergeTargetErrorId} role="alert">
                {view.mergeTargetValidationMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        {view.showActionError ? (
          <div className={view.actionError.containerClassName}>
            <pre className={view.actionError.className} id={view.actionError.id} role={view.actionError.role}>
              {view.actionError.message}
            </pre>
            {copyPromptButton ? (
              <button
                className={copyPromptButton.className}
                type="button"
                aria-label={copyPromptButton.label}
                title={copyPromptButton.title}
                onClick={() => copyMergeFailurePrompt(view.mergeFailurePrompt)}
              >
                {copyPromptIcon(copyPromptButton.icon)}
                <span>{copyPromptButton.label}</span>
              </button>
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
