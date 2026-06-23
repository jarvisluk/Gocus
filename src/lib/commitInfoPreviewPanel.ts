export const commitInfoPreviewCloseDelayMs = 80;

export function commitInfoPreviewShouldCloseForSelection(selectedId: string, previewCommitId: string) {
  return !selectedId || Boolean(previewCommitId && previewCommitId !== selectedId);
}

export function commitInfoPreviewShouldCloseAfterBlur({
  closeToken,
  currentToken,
  commitInfoPanelActive,
}: {
  closeToken: number;
  currentToken: number;
  commitInfoPanelActive: boolean;
}) {
  return closeToken === currentToken && !commitInfoPanelActive;
}
