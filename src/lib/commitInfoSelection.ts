import type { CommitInfoPayload } from "../types";
import { politeStatusView } from "./statusView";

export function commitInfoWindowView(payload: CommitInfoPayload) {
  return {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: "peek-panel temporary-info-panel is-commit",
      ariaLabel: "Commit details window",
    },
    emptyState: politeStatusView({
      className: "temporary-info-empty",
      ariaLabel: "Commit details",
      message: "No commit selected.",
    }),
    commitPayload: payload,
    showCommit: Boolean(payload),
  };
}
