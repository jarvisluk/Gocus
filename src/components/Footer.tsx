import { useEffect, useRef, useState } from "react";
import { ChevronDown, Focus, FolderOpen, Settings } from "lucide-react";
import { joinClass } from "../lib/classNames";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { UiPreferences, WorkspaceOpenTarget } from "../types";

export function Footer({
  onOpenRepo,
  onEnterZen,
  onOpenSettings,
  onOpenWorkspace,
  hasRepository,
  preferences,
  availableWorkspaceTargets,
  showZenEntry,
}: {
  onOpenRepo: () => void;
  onEnterZen: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: (target: WorkspaceOpenTarget) => void;
  hasRepository: boolean;
  preferences: UiPreferences;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  showZenEntry: boolean;
}) {
  const [activeTarget, setActiveTarget] = useState<WorkspaceOpenTarget>("cursor");
  const [menuOpen, setMenuOpen] = useState(false);
  const workspaceControlRef = useRef<HTMLDivElement>(null);
  const enabledTargets = new Set(preferences.workspaceOpenTargets);
  const availableTargets = new Set(availableWorkspaceTargets);
  const visibleOptions = workspaceOpenOptions.filter((option) => enabledTargets.has(option.target) && availableTargets.has(option.target));
  const activeOption = visibleOptions.find((option) => option.target === activeTarget) ?? visibleOptions[0] ?? null;

  useEffect(() => {
    if (!hasRepository || visibleOptions.length === 0) setMenuOpen(false);
  }, [hasRepository, visibleOptions.length]);

  useEffect(() => {
    if (activeOption && activeOption.target !== activeTarget) {
      setActiveTarget(activeOption.target);
    }
  }, [activeOption, activeTarget]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (workspaceControlRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function openWorkspace(target: WorkspaceOpenTarget) {
    setActiveTarget(target);
    setMenuOpen(false);
    onOpenWorkspace(target);
  }

  function toggleMenu() {
    if (!hasRepository || visibleOptions.length === 0) return;
    setMenuOpen((current) => !current);
  }

  return (
    <footer className={joinClass("peek-footer", showZenEntry && "has-zen-entry")}>
      {showZenEntry ? (
        <button className="ui-icon-button footer-icon footer-zen" type="button" aria-label="Enter Zen mode" title="Zen mode" onClick={onEnterZen} disabled={!hasRepository}>
          <Focus aria-hidden="true" />
        </button>
      ) : null}
      <button className="ui-icon-button footer-icon footer-settings" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
        <Settings aria-hidden="true" />
      </button>
      {!hasRepository ? (
        <button className="footer-primary" type="button" onClick={onOpenRepo}>
          <FolderOpen aria-hidden="true" />
          Open folder
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      {activeOption ? (
        <div className="workspace-open-control" ref={workspaceControlRef}>
          <button
            className="workspace-open-trigger"
            type="button"
            aria-label={`Open in ${activeOption.label}`}
            title={`Open in ${activeOption.label}`}
            onClick={() => openWorkspace(activeOption.target)}
            disabled={!hasRepository}
          >
            <span className="external-app-icon">
              <img src={activeOption.iconSrc} alt="" aria-hidden="true" />
            </span>
          </button>
          <button
            className={joinClass("workspace-open-menu-toggle", menuOpen && "is-open")}
            type="button"
            aria-label="Choose external app"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="workspace-open-menu"
            title="Choose external app"
            onClick={toggleMenu}
            disabled={!hasRepository}
          >
            <ChevronDown aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className="ui-menu workspace-open-menu" id="workspace-open-menu" role="menu">
              {visibleOptions.map((option) => {
                return (
                  <button
                    className={joinClass("ui-menu-item", "workspace-open-menu-item", option.target === activeTarget && "is-active")}
                    type="button"
                    role="menuitem"
                    aria-current={option.target === activeTarget ? "true" : undefined}
                    key={option.target}
                    onClick={() => openWorkspace(option.target)}
                  >
                    <span className="external-app-icon">
                      <img src={option.iconSrc} alt="" aria-hidden="true" />
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <span aria-hidden="true" />
      )}
    </footer>
  );
}
