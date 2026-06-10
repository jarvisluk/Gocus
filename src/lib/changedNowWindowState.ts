import type { TemporaryInfoPanelBridgeAction } from "./temporaryInfoPanelBridge";

export type ChangedNowWindowState = {
  windowOpen: boolean;
  collapsedRailOpen: boolean;
};

export type ChangedNowWindowAction = "toggleFromPanel" | "toggleFromCollapsedRail" | "close" | "expandPanel";

export type ChangedNowToggleSource = "panel" | "collapsedRail";
export type ChangedNowTemporaryInfoPanelAction = Extract<TemporaryInfoPanelBridgeAction, "open" | "close"> | null;

export interface ChangedNowToggleResult {
  windowAction: ChangedNowWindowAction;
  temporaryInfoPanelAction: ChangedNowTemporaryInfoPanelAction;
}

export const closedChangedNowWindowState: ChangedNowWindowState = {
  windowOpen: false,
  collapsedRailOpen: false,
};

export function changedNowWindowState(current: ChangedNowWindowState, action: ChangedNowWindowAction): ChangedNowWindowState {
  if (action === "toggleFromPanel") {
    return current.windowOpen
      ? closedChangedNowWindowState
      : {
          windowOpen: true,
          collapsedRailOpen: false,
        };
  }

  if (action === "toggleFromCollapsedRail") {
    return current.windowOpen
      ? closedChangedNowWindowState
      : {
          windowOpen: true,
          collapsedRailOpen: true,
        };
  }

  if (action === "expandPanel") {
    return current.collapsedRailOpen
      ? {
          ...current,
          collapsedRailOpen: false,
        }
      : current;
  }

  return closedChangedNowWindowState;
}

export function changedNowToggleResult({
  source,
  windowOpen,
  hasTemporaryInfoPayload,
}: {
  source: ChangedNowToggleSource;
  windowOpen: boolean;
  hasTemporaryInfoPayload: boolean;
}): ChangedNowToggleResult {
  if (windowOpen) {
    return {
      windowAction: "close",
      temporaryInfoPanelAction: "close",
    };
  }

  return {
    windowAction: source === "panel" ? "toggleFromPanel" : "toggleFromCollapsedRail",
    temporaryInfoPanelAction: source === "panel" && hasTemporaryInfoPayload ? "open" : null,
  };
}
