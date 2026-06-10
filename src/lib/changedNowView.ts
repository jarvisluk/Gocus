export type CopyPromptState = "idle" | "copied" | "failed";
export type CopyPromptIcon = "copy" | "check" | "x";
export type TemporaryCopyPromptState = Exclude<CopyPromptState, "idle">;

export const copyPromptStateResetDelayMs = 1400;
export const changedNowTitleId = "changed-now-title";

export function temporaryCopyPromptFeedback({
  timerActive,
  nextState,
}: {
  timerActive: boolean;
  nextState: TemporaryCopyPromptState;
}) {
  return {
    clearExistingTimer: timerActive,
    nextState,
    resetDelayMs: copyPromptStateResetDelayMs,
  };
}

export function changedNowPanelView() {
  return {
    section: {
      className: "changed-section",
      ariaLabelledBy: changedNowTitleId,
    },
    heading: {
      className: "section-heading compact",
    },
    titleId: changedNowTitleId,
    title: "Changed now",
    tools: {
      className: "heading-tools",
    },
    fileList: {
      className: "file-list",
      id: "changed-now-file-list",
    },
    closeButton: {
      ariaLabel: "Close changed files window",
      tooltip: "Close window",
    },
  };
}

export function changedNowCopyButtonView(copyState: CopyPromptState) {
  if (copyState === "copied") {
    return {
      label: "Copied prompt",
      title: "Copied",
      icon: "check" as CopyPromptIcon,
    };
  }

  if (copyState === "failed") {
    return {
      label: "Copy failed",
      title: "Copy failed",
      icon: "x" as CopyPromptIcon,
    };
  }

  return {
    label: "Copy prompt to commit changes",
    title: "Copy prompt to commit changes",
    icon: "copy" as CopyPromptIcon,
  };
}
