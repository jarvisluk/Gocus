import { useEffect, useState } from "react";
import type { TemporaryInfoPayload } from "../types";
import { ChangedNow } from "./ChangedNow";

export function TemporaryInfoWindow() {
  const [payload, setPayload] = useState<TemporaryInfoPayload>(null);
  const [selectedFileKey, setSelectedFileKey] = useState("");

  useEffect(() => {
    window.gitPeek?.getTemporaryInfoPayload().then(setPayload);
    return window.gitPeek?.onTemporaryInfoPayloadUpdated(setPayload);
  }, []);

  useEffect(() => {
    if (payload?.kind === "changed-files") setSelectedFileKey(payload.selectedFileKey);
  }, [payload]);

  return (
    <main className="temporary-info-viewport">
      {payload?.kind === "changed-files" ? (
        <ChangedNow
          files={payload.files}
          filter={payload.filter}
          collapsed={false}
          selectedFileKey={selectedFileKey}
          onToggleCollapsed={() => window.gitPeek?.setTemporaryInfoPanel(null)}
          onSelectFile={setSelectedFileKey}
        />
      ) : (
        <section className="temporary-info-empty" aria-label="Temporary information">
          No file selected.
        </section>
      )}
    </main>
  );
}
