import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import {
  changedFileDeltaItems,
  changedFileInfoOpenButtonView,
  changedFileInfoPanelView,
  changedFileRowView,
  type ChangedFileView,
} from "../lib/changedFileView";
import {
  changedNowCopyButtonView,
  changedNowPanelView,
  temporaryCopyPromptFeedback,
  type CopyPromptIcon,
  type CopyPromptState,
  type TemporaryCopyPromptState,
} from "../lib/changedNowView";
import { changedFilesView } from "../lib/changedFilesView";
import { changedFilesCommitPrompt } from "../lib/commitPrompt";
import { copyTextWithFallback } from "../lib/copyText";
import { logBridgeWarning } from "../lib/errorMessages";
import type { WorkspaceOpenOption } from "../lib/workspaceOpenOptions";
import type { ChangedFile, FileFilter, PromptLanguage } from "../types";

function deltaContent(delta: ChangedFileView["delta"]) {
  return (
    <>
      {changedFileDeltaItems(delta).map((item) => (
        <span key={item.key} className={item.className}>
          {item.label}
        </span>
      ))}
    </>
  );
}

function copyPromptIcon(icon: CopyPromptIcon) {
  if (icon === "check") return <Check aria-hidden="true" />;
  if (icon === "x") return <X aria-hidden="true" />;
  return <Copy aria-hidden="true" />;
}

export function ChangedFileInfoPanel({
  file,
  workspaceOpenOption,
  onClose,
  onOpenFile,
}: {
  file: ChangedFile;
  workspaceOpenOption?: WorkspaceOpenOption | null;
  onClose: () => void;
  onOpenFile?: (filePath: string) => void;
}) {
  const view = changedFileInfoPanelView(file);
  const openButton = changedFileInfoOpenButtonView(workspaceOpenOption ?? null);

  return (
    <aside className={view.panel.className} aria-labelledby={view.panel.ariaLabelledBy}>
      <header className={view.header.className}>
        <span className={view.badgeClassName}>{view.file.statusLetter}</span>
        <div>
          <h2 id={view.titleId} title={view.pathTitle}>{view.file.pathLabel}</h2>
          <span>{view.statusLabel}</span>
        </div>
        <div className="changed-side-actions">
          {openButton && onOpenFile ? (
            <button
              className={openButton.className}
              type="button"
              aria-label={openButton.ariaLabel}
              title={openButton.title}
              onClick={() => onOpenFile(file.path)}
            >
              <span className={openButton.iconClassName}>
                <img src={workspaceOpenOption?.iconSrc} alt="" aria-hidden="true" />
              </span>
            </button>
          ) : null}
          <button className={view.closeButton.className} type="button" aria-label={view.closeButton.ariaLabel} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
      </header>
      <dl className={view.factsListClassName}>
        <div>
          <dt>{view.facts.kindLabel}</dt>
          <dd>{view.file.kind}</dd>
        </div>
        <div>
          <dt>{view.facts.gitLabel}</dt>
          <dd>{view.file.gitStatus}</dd>
        </div>
        <div>
          <dt>{view.facts.changesLabel}</dt>
          <dd className={view.deltaClassName}>{deltaContent(view.file.delta)}</dd>
        </div>
        <div className={view.wideFactClassName}>
          <dt>{view.facts.pathLabel}</dt>
          <dd title={view.pathTitle}>{view.pathText}</dd>
        </div>
        {view.showOriginalPath ? (
          <div className={view.wideFactClassName}>
            <dt>{view.facts.originalPathLabel}</dt>
            <dd title={view.originalPathTitle}>{view.file.originalPathLabel}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

export function ChangedNow({
  files,
  filter,
  promptLanguage = "en",
  selectedFileKey,
  onClose,
  onSelectFile,
}: {
  files: ChangedFile[];
  filter: FileFilter;
  promptLanguage?: PromptLanguage;
  selectedFileKey: string;
  onClose?: () => void;
  onSelectFile: (fileKey: string) => void;
}) {
  const [copyState, setCopyState] = useState<CopyPromptState>("idle");
  const copyStateResetTimerRef = useRef<number | null>(null);
  const changedFiles = changedFilesView(files, filter);
  const panelView = changedNowPanelView();
  const copyButton = changedNowCopyButtonView(copyState);

  useEffect(
    () => () => {
      if (copyStateResetTimerRef.current !== null) window.clearTimeout(copyStateResetTimerRef.current);
    },
    [],
  );

  function setTemporaryCopyState(nextCopyState: TemporaryCopyPromptState) {
    const feedback = temporaryCopyPromptFeedback({
      timerActive: copyStateResetTimerRef.current !== null,
      nextState: nextCopyState,
    });

    if (feedback.clearExistingTimer && copyStateResetTimerRef.current !== null) window.clearTimeout(copyStateResetTimerRef.current);
    setCopyState(feedback.nextState);
    copyStateResetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyStateResetTimerRef.current = null;
    }, feedback.resetDelayMs);
  }

  async function copyCommitPrompt() {
    const prompt = changedFilesCommitPrompt(changedFiles.filteredFiles, filter, promptLanguage);

    try {
      await copyTextWithFallback(prompt, { bridge: window.gitPeek, clipboard: navigator.clipboard });
      setTemporaryCopyState("copied");
    } catch (error) {
      logBridgeWarning("Unable to copy prompt.", error);
      setTemporaryCopyState("failed");
    }
  }

  return (
    <section className={panelView.section.className} aria-labelledby={panelView.section.ariaLabelledBy}>
      <div className={panelView.heading.className}>
        <h2 id={panelView.titleId}>{panelView.title}</h2>
        <div className={panelView.tools.className}>
          <span>{changedFiles.filteredCount}</span>
          <button
            type="button"
            aria-label={copyButton.label}
            data-tooltip={copyButton.label}
            title={copyButton.title}
            onClick={copyCommitPrompt}
          >
            {copyPromptIcon(copyButton.icon)}
          </button>
          {onClose ? (
            <button
              type="button"
              aria-label={panelView.closeButton.ariaLabel}
              data-tooltip={panelView.closeButton.tooltip}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      <div className={panelView.fileList.className} id={panelView.fileList.id}>
        {changedFiles.showFiles ? (
          <>
            {changedFiles.visibleFiles.map((file) => {
              const row = changedFileRowView(file, selectedFileKey);

              return (
                <button
                  className={row.className}
                  type="button"
                  key={row.file.key}
                  onClick={() => onSelectFile(row.file.key)}
                  aria-pressed={row.ariaPressed}
                  title={row.title}
                >
                  <span className={row.badgeClassName}>{row.file.statusLetter}</span>
                  <span className={row.copyClassName}>
                    <span className={row.pathClassName} title={row.title}>
                      {row.file.pathLabel}
                    </span>
                    <span className={row.detailClassName}>{row.file.statusDetail}</span>
                  </span>
                  <span className={row.deltaClassName}>{deltaContent(row.file.delta)}</span>
                </button>
              );
            })}
            {changedFiles.showHiddenCount ? (
              <div
                className={changedFiles.hiddenCountView.className}
                role={changedFiles.hiddenCountView.role}
                aria-live={changedFiles.hiddenCountView.ariaLive}
              >
                {changedFiles.hiddenCountLabel}
              </div>
            ) : null}
          </>
        ) : (
          <div
            className={changedFiles.emptyState.className}
            role={changedFiles.emptyState.role}
            aria-live={changedFiles.emptyState.ariaLive}
          >
            {changedFiles.emptyState.message}
          </div>
        )}
      </div>
    </section>
  );
}
