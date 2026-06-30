import type { UiPreferences } from "../types";

const autoRefreshIntervals: Record<UiPreferences["autoRefreshInterval"], number> = {
  off: 0,
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
};

const maxAutoRefreshTickMs = 30_000;

export function autoRefreshIntervalMs(interval: UiPreferences["autoRefreshInterval"]) {
  return autoRefreshIntervals[interval];
}

export function autoRefreshTickMs(intervalMs: number) {
  return intervalMs > 0 ? Math.min(intervalMs, maxAutoRefreshTickMs) : 0;
}

export function autoRefreshEnabled({
  intervalMs,
  electron,
  hasSnapshot,
  actionDialogOpen,
  repositoryDialogOpen,
  collapsed = false,
  automaticGitRefresh = true,
}: {
  intervalMs: number;
  electron: boolean;
  hasSnapshot: boolean;
  actionDialogOpen: boolean;
  repositoryDialogOpen: boolean;
  collapsed?: boolean;
  automaticGitRefresh?: boolean;
}) {
  return Boolean(intervalMs && electron && hasSnapshot && !actionDialogOpen && !repositoryDialogOpen && !collapsed && automaticGitRefresh);
}

export function autoRefreshSchedule({
  interval,
  electron,
  hasSnapshot,
  actionDialogOpen,
  repositoryDialogOpen,
  collapsed = false,
  automaticGitRefresh = true,
}: {
  interval: UiPreferences["autoRefreshInterval"];
  electron: boolean;
  hasSnapshot: boolean;
  actionDialogOpen: boolean;
  repositoryDialogOpen: boolean;
  collapsed?: boolean;
  automaticGitRefresh?: boolean;
}) {
  const intervalMs = autoRefreshIntervalMs(interval);
  const enabled = autoRefreshEnabled({
    intervalMs,
    electron,
    hasSnapshot,
    actionDialogOpen,
    repositoryDialogOpen,
    collapsed,
    automaticGitRefresh,
  });

  return {
    enabled,
    intervalMs,
    tickMs: enabled ? autoRefreshTickMs(intervalMs) : 0,
  };
}

export function shouldRunAutoRefreshTick({
  bridgeAvailable,
  inFlight,
  refreshing,
  lastGitRequestAt,
  now,
  intervalMs,
}: {
  bridgeAvailable: boolean;
  inFlight: boolean;
  refreshing: boolean;
  lastGitRequestAt: number;
  now: number;
  intervalMs: number;
}) {
  if (!bridgeAvailable || inFlight || refreshing) return false;
  return now - lastGitRequestAt >= intervalMs;
}
