import { useEffect } from "react";
import { appShouldCloseSettingsOnKey, appShouldExitZenOnKey } from "../lib/appShellView";

export function useSettingsEscape({
  settingsOpen,
  zenActive,
  onClose,
}: {
  settingsOpen: boolean;
  zenActive: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!settingsOpen || zenActive) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (appShouldCloseSettingsOnKey({ key: event.key, settingsOpen, zenActive })) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, settingsOpen, zenActive]);
}

export function useZenEscape({ zenActive, onExit }: { zenActive: boolean; onExit: () => void }) {
  useEffect(() => {
    if (!zenActive) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (appShouldExitZenOnKey({ key: event.key, zenActive })) {
        onExit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit, zenActive]);
}
