import { useEffect, useState } from "react";
import { commitInfoWindowView } from "../lib/commitInfoSelection";
import { logBridgeWarning } from "../lib/errorMessages";
import { applyPreferences, defaultPreferences, mergePreferences } from "../lib/preferences";
import type { CommitInfoPayload, UiPreferences } from "../types";
import { CommitInfoPanel } from "./CommitInfoPanel";
import { SideWindowShell } from "./SideWindowShell";

export function CommitInfoWindow() {
  const [payload, setPayload] = useState<CommitInfoPayload>(null);
  const [preferences, setPreferences] = useState<UiPreferences>(defaultPreferences);
  const view = commitInfoWindowView(payload);

  useEffect(() => {
    window.gocus
      ?.getCommitInfoPayload()
      .then(setPayload)
      .catch((error) => logBridgeWarning("Unable to load commit info payload.", error));
    return window.gocus?.onCommitInfoPayloadUpdated(setPayload);
  }, []);

  useEffect(() => {
    window.gocus
      ?.getPreferences()
      .then((value) => setPreferences(mergePreferences(value)))
      .catch((error) => logBridgeWarning("Unable to load preferences.", error));
    const unsubscribePreferences = window.gocus?.onPreferencesChanged((value) => setPreferences(mergePreferences(value)));
    return () => {
      unsubscribePreferences?.();
    };
  }, []);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  return (
    <SideWindowShell
      viewportClassName={view.viewport.className}
      panelClassName={view.panel.className}
      panelAriaLabel={view.panel.ariaLabel}
      emptyState={view.emptyState}
    >
      {view.commitPayload ? <CommitInfoPanel commit={view.commitPayload.commit} /> : null}
    </SideWindowShell>
  );
}
