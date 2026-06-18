import { useCallback, useEffect, useMemo, useState } from "react";
import { appShouldCloseTemporaryInfoOnPointer, appTemporaryInfoDismissView } from "../lib/appShellView";
import { changedFilesTemporaryInfoPayload } from "../lib/changedFilesTemporaryInfo";
import {
  changedNowToggleResult,
  changedNowWindowState,
  closedChangedNowWindowState,
  type ChangedNowToggleSource,
} from "../lib/changedNowWindowState";
import { runTemporaryInfoPanelBridgeSideEffect, type TemporaryInfoPanelBridgeAction } from "../lib/temporaryInfoPanelBridge";
import type { GitSnapshot, TemporaryInfoPayload, WorkspaceOpenTarget } from "../types";

export function useChangedNowPanel({
  snapshot,
  collapsed,
  settingsOpen,
  workspaceOpenTarget,
}: {
  snapshot: GitSnapshot | null;
  collapsed: boolean;
  settingsOpen: boolean;
  workspaceOpenTarget: WorkspaceOpenTarget | "";
}) {
  const [changedNowState, setChangedNowState] = useState(closedChangedNowWindowState);
  const { collapsedRailOpen: collapsedRailChangedNowOpen, windowOpen: changedNowWindowOpen } = changedNowState;
  const temporaryInfoDismiss = useMemo(() => appTemporaryInfoDismissView(), []);
  const temporaryInfoPayload = useMemo(
    () =>
      changedFilesTemporaryInfoPayload({
        snapshot,
        changedNowWindowOpen,
        collapsed,
        collapsedRailChangedNowOpen,
        settingsOpen,
        workspaceOpenTarget,
      }),
    [changedNowWindowOpen, collapsed, collapsedRailChangedNowOpen, settingsOpen, snapshot, workspaceOpenTarget],
  );

  const runTemporaryInfoPanelBridgeAction = useCallback((action: TemporaryInfoPanelBridgeAction, payload: TemporaryInfoPayload = null) => {
    runTemporaryInfoPanelBridgeSideEffect(action, (nextPayload) => window.gocus?.setTemporaryInfoPanel(nextPayload), payload);
  }, []);

  const closeChangedNowWindow = useCallback(() => {
    setChangedNowState(closedChangedNowWindowState);
    runTemporaryInfoPanelBridgeAction("close");
  }, [runTemporaryInfoPanelBridgeAction]);

  const toggleChangedNow = useCallback(
    (source: ChangedNowToggleSource) => {
      const result = changedNowToggleResult({
        source,
        windowOpen: changedNowWindowOpen,
        hasTemporaryInfoPayload: Boolean(temporaryInfoPayload),
      });

      setChangedNowState((current) => changedNowWindowState(current, result.windowAction));
      if (result.temporaryInfoPanelAction) {
        runTemporaryInfoPanelBridgeAction(result.temporaryInfoPanelAction, temporaryInfoPayload);
      }
    },
    [changedNowWindowOpen, runTemporaryInfoPanelBridgeAction, temporaryInfoPayload],
  );
  const toggleChangedNowWindow = useCallback(() => {
    toggleChangedNow("panel");
  }, [toggleChangedNow]);
  const toggleChangedNowFromCollapsedRail = useCallback(() => {
    toggleChangedNow("collapsedRail");
  }, [toggleChangedNow]);

  useEffect(() => {
    runTemporaryInfoPanelBridgeAction("update", temporaryInfoPayload);
  }, [runTemporaryInfoPanelBridgeAction, temporaryInfoPayload]);

  useEffect(() => {
    if (!temporaryInfoPayload) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!appShouldCloseTemporaryInfoOnPointer(event.target, temporaryInfoDismiss.exemptSelector)) return;
      closeChangedNowWindow();
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [closeChangedNowWindow, temporaryInfoDismiss.exemptSelector, temporaryInfoPayload]);

  useEffect(() => {
    if (!collapsed && collapsedRailChangedNowOpen) {
      setChangedNowState((current) => changedNowWindowState(current, "expandPanel"));
    }
  }, [collapsedRailChangedNowOpen, collapsed]);

  useEffect(
    () => () => {
      runTemporaryInfoPanelBridgeAction("clear");
    },
    [runTemporaryInfoPanelBridgeAction],
  );

  useEffect(
    () =>
      window.gocus?.onTemporaryInfoPanelClosed(() => {
        setChangedNowState(closedChangedNowWindowState);
      }),
    [],
  );

  return {
    changedNowWindowOpen,
    collapsedRailChangedNowOpen,
    toggleChangedNowWindow,
    toggleChangedNowFromCollapsedRail,
  };
}
