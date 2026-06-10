import { runBridgeSideEffect } from "./errorMessages";
import type { CommitInfoPayload } from "../types";

export type CommitInfoPanelBridgeAction = "close" | "open" | "update" | "clear";
export type CommitInfoPanelBridgeSetter = (payload: CommitInfoPayload) => Promise<unknown> | void;

export interface CommitInfoPanelBridgeRequest {
  failureNotice: string;
  payload: CommitInfoPayload;
}

export function commitInfoPanelBridgeRequest(
  action: CommitInfoPanelBridgeAction,
  payload: CommitInfoPayload = null,
): CommitInfoPanelBridgeRequest | null {
  if (action === "open") {
    if (!payload) return null;

    return {
      failureNotice: "Unable to open commit info panel.",
      payload,
    };
  }

  if (action === "update") {
    return {
      failureNotice: "Unable to update commit info panel.",
      payload,
    };
  }

  if (action === "close") {
    return {
      failureNotice: "Unable to close commit info panel.",
      payload: null,
    };
  }

  return {
    failureNotice: "Unable to clear commit info panel.",
    payload: null,
  };
}

export function runCommitInfoPanelBridgeSideEffect(
  action: CommitInfoPanelBridgeAction,
  setCommitInfoPanel: CommitInfoPanelBridgeSetter | undefined,
  payload: CommitInfoPayload = null,
): boolean {
  const request = commitInfoPanelBridgeRequest(action, payload);
  if (!request) return false;

  runBridgeSideEffect(request.failureNotice, () => setCommitInfoPanel?.(request.payload));
  return true;
}
