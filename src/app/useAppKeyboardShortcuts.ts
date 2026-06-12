import { useEffect } from "react";
import { appShouldCloseSettingsOnKey } from "../lib/appShellView";

export function useSettingsEscape({
  settingsOpen,
  onClose,
}: {
  settingsOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!settingsOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (appShouldCloseSettingsOnKey({ key: event.key, settingsOpen })) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, settingsOpen]);
}
