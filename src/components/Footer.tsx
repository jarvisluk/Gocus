import { useEffect, useRef, useState } from "react";
import { ChevronDown, Focus, FolderOpen, Settings } from "lucide-react";
import cursorIcon from "../assets/external-app-icons/cursor.png";
import finderIcon from "../assets/external-app-icons/finder.png";
import terminalIcon from "../assets/external-app-icons/terminal.png";
import vscodeIcon from "../assets/external-app-icons/vscode.png";
import xcodeIcon from "../assets/external-app-icons/xcode.png";
import { joinClass } from "../lib/classNames";
import type { WorkspaceOpenTarget } from "../types";

const workspaceOpenOptions: {
  target: WorkspaceOpenTarget;
  label: string;
  iconSrc: string;
}[] = [
  { target: "vscode", label: "VS Code", iconSrc: vscodeIcon },
  { target: "cursor", label: "Cursor", iconSrc: cursorIcon },
  { target: "finder", label: "Finder", iconSrc: finderIcon },
  { target: "terminal", label: "Terminal", iconSrc: terminalIcon },
  { target: "xcode", label: "Xcode", iconSrc: xcodeIcon },
];

export function Footer({
  onOpenRepo,
  onEnterZen,
  onOpenSettings,
  onOpenWorkspace,
  hasRepository,
}: {
  onOpenRepo: () => void;
  onEnterZen: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: (target: WorkspaceOpenTarget) => void;
  hasRepository: boolean;
}) {
  const [activeTarget, setActiveTarget] = useState<WorkspaceOpenTarget>("cursor");
  const [menuOpen, setMenuOpen] = useState(false);
  const workspaceControlRef = useRef<HTMLDivElement>(null);
  const activeOption = workspaceOpenOptions.find((option) => option.target === activeTarget) ?? workspaceOpenOptions[0];

  useEffect(() => {
    if (!hasRepository) setMenuOpen(false);
  }, [hasRepository]);

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
    if (!hasRepository) return;
    setMenuOpen((current) => !current);
  }

  return (
    <footer className="peek-footer">
      <button className="footer-icon footer-zen" type="button" aria-label="Enter Zen mode" title="Zen mode" onClick={onEnterZen} disabled={!hasRepository}>
        <Focus aria-hidden="true" />
      </button>
      <button className="footer-icon footer-settings" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
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
      <div className="workspace-open-control" ref={workspaceControlRef}>
        <button
          className="workspace-open-trigger"
          type="button"
          aria-label={`Open in ${activeOption.label}`}
          title={`Open in ${activeOption.label}`}
          onClick={() => openWorkspace(activeTarget)}
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
            {workspaceOpenOptions.map((option) => {
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
    </footer>
  );
}
