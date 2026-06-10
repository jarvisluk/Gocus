import { runBridgeSideEffect } from "./errorMessages";
import type { TemporaryInfoPayload } from "../types";

export type TemporaryInfoPanelBridgeAction = "close" | "open" | "update" | "clear";
export type TemporaryInfoPanelBridgeSetter = (payload: TemporaryInfoPayload) => Promise<unknown> | void;

export interface TemporaryInfoPanelBridgeRequest {
  failureNotice: string;
  payload: TemporaryInfoPayload;
}

export function temporaryInfoPanelBridgeRequest(
  action: TemporaryInfoPanelBridgeAction,
  payload: TemporaryInfoPayload = null,
): TemporaryInfoPanelBridgeRequest | null {
  if (action === "open") {
    if (!payload) return null;

    return {
      failureNotice: "Unable to open temporary info panel.",
      payload,
    };
  }

  if (action === "update") {
    return {
      failureNotice: "Unable to update temporary info panel.",
      payload,
    };
  }

  if (action === "close") {
    return {
      failureNotice: "Unable to close temporary info panel.",
      payload: null,
    };
  }

  return {
    failureNotice: "Unable to clear temporary info panel.",
    payload: null,
  };
}

export function runTemporaryInfoPanelBridgeSideEffect(
  action: TemporaryInfoPanelBridgeAction,
  setTemporaryInfoPanel: TemporaryInfoPanelBridgeSetter | undefined,
  payload: TemporaryInfoPayload = null,
): boolean {
  const request = temporaryInfoPanelBridgeRequest(action, payload);
  if (!request) return false;

  runBridgeSideEffect(request.failureNotice, () => setTemporaryInfoPanel?.(request.payload));
  return true;
}
