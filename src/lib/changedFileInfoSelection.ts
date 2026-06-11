import type { ChangedFileInfoPayload } from "../types";
import { politeStatusView } from "./statusView";

export function changedFileInfoWindowView(payload: ChangedFileInfoPayload) {
  return {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: "peek-panel temporary-info-panel is-changed-file",
      ariaLabel: "Changed file details window",
    },
    emptyState: politeStatusView({
      className: "temporary-info-empty",
      ariaLabel: "Changed file details",
      message: "No file selected.",
    }),
    changedFilePayload: payload,
    showChangedFile: Boolean(payload),
  };
}
