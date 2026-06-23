import { useCallback, useEffect, useRef } from "react";
import { runCommitInfoPanelBridgeSideEffect } from "./commitInfoPanelBridge";
import {
  commitInfoPreviewCloseDelayMs,
  commitInfoPreviewShouldCloseAfterBlur,
  commitInfoPreviewShouldCloseForSelection,
} from "./commitInfoPreviewPanel";
import type { CommitInfoAnchorBounds, CommitItem } from "../types";

export function useCommitInfoPreviewPanel({ selectedId }: { selectedId: string }) {
  const commitPreviewOpenRef = useRef(false);
  const commitPreviewCommitIdRef = useRef("");
  const commitPreviewCloseTokenRef = useRef(0);

  const closeCommitPreview = useCallback(() => {
    commitPreviewCloseTokenRef.current += 1;
    if (!commitPreviewOpenRef.current) return;
    commitPreviewOpenRef.current = false;
    commitPreviewCommitIdRef.current = "";
    runCommitInfoPanelBridgeSideEffect("close", (payload) => window.gocus?.setCommitInfoPanel(payload));
  }, []);

  const previewCommit = useCallback((commit: CommitItem, anchorBounds: CommitInfoAnchorBounds) => {
    if (commitPreviewOpenRef.current && commitPreviewCommitIdRef.current === commit.id) return;

    commitPreviewCloseTokenRef.current += 1;
    const opened = runCommitInfoPanelBridgeSideEffect(
      "open",
      (payload) => window.gocus?.setCommitInfoPanel(payload),
      { kind: "commit", commit, anchorBounds },
    );
    commitPreviewOpenRef.current = opened;
    commitPreviewCommitIdRef.current = opened ? commit.id : "";
  }, []);

  const scheduleCommitPreviewCloseAfterBlur = useCallback(() => {
    const closeToken = (commitPreviewCloseTokenRef.current += 1);
    window.setTimeout(() => {
      const isCommitInfoPanelActive = window.gocus?.isCommitInfoPanelActive;
      void Promise.resolve(isCommitInfoPanelActive ? isCommitInfoPanelActive() : false)
        .catch(() => false)
        .then((commitInfoPanelActive) => {
          if (
            !commitInfoPreviewShouldCloseAfterBlur({
              closeToken,
              currentToken: commitPreviewCloseTokenRef.current,
              commitInfoPanelActive,
            })
          ) {
            return;
          }

          closeCommitPreview();
        });
    }, commitInfoPreviewCloseDelayMs);
  }, [closeCommitPreview]);

  useEffect(() => {
    if (commitInfoPreviewShouldCloseForSelection(selectedId, commitPreviewCommitIdRef.current)) {
      closeCommitPreview();
    }
  }, [closeCommitPreview, selectedId]);

  useEffect(
    () => () => {
      closeCommitPreview();
    },
    [closeCommitPreview],
  );

  return {
    previewCommit,
    closeCommitPreview,
    scheduleCommitPreviewCloseAfterBlur,
  };
}
