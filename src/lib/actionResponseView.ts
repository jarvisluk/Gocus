import type { ActionResponse, GitSnapshot } from "../types";

export const defaultActionFailureNotice = "Action failed.";

export function actionResponseNotice(
  response: ActionResponse,
  fallbackNotice: string,
  failureNotice = defaultActionFailureNotice,
) {
  if (response.ok) return response.message ?? fallbackNotice;
  if (response.canceled) return null;
  return response.error ?? failureNotice;
}

export function actionResponseSnapshot(response: ActionResponse): GitSnapshot | null {
  return response.snapshot ?? null;
}
