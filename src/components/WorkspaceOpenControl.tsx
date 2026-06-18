import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownMenuHost } from "./DropdownMenuHost";
import {
  footerWorkspaceMenuItemView,
  footerWorkspaceMenuOpenAfterToggle,
  footerWorkspaceMenuToggleView,
  footerWorkspaceMenuView,
  footerWorkspaceOpenButtonView,
  footerWorkspaceSelection,
  footerWorkspaceView,
} from "../lib/footerWorkspaceView";
import { joinClass } from "../lib/classNames";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { WorkspaceOpenMenuAnchorBounds, WorkspaceOpenTarget } from "../types";

export function WorkspaceOpenControl({
  activeWorkspaceTarget,
  availableWorkspaceTargets,
  enabledWorkspaceTargets,
  hasRepository = true,
  menuPlacement = "above",
  fallback = null,
  onActiveWorkspaceTargetChange,
  onOpenExternalMenu,
  onOpenTarget,
}: {
  activeWorkspaceTarget: WorkspaceOpenTarget;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  enabledWorkspaceTargets: WorkspaceOpenTarget[];
  hasRepository?: boolean;
  menuPlacement?: "above" | "below";
  fallback?: ReactNode;
  onActiveWorkspaceTargetChange: (target: WorkspaceOpenTarget) => void;
  onOpenExternalMenu?: (anchorBounds: WorkspaceOpenMenuAnchorBounds, itemCount: number) => void;
  onOpenTarget: (target: WorkspaceOpenTarget) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const workspaceControlRef = useRef<HTMLDivElement>(null);
  const workspaceView = footerWorkspaceView({
    options: workspaceOpenOptions,
    availableTargets: availableWorkspaceTargets,
    enabledTargets: enabledWorkspaceTargets,
    activeTarget: activeWorkspaceTarget,
    hasRepository,
  });
  const workspaceMenuToggle = footerWorkspaceMenuToggleView(menuOpen);
  const workspaceOpenButton = workspaceView.activeOption ? footerWorkspaceOpenButtonView(workspaceView.activeOption) : null;
  const workspaceMenu = footerWorkspaceMenuView();

  useEffect(() => {
    if (workspaceView.shouldCloseMenu) setMenuOpen(false);
  }, [workspaceView.shouldCloseMenu]);

  function openTarget(target: WorkspaceOpenTarget) {
    const selection = footerWorkspaceSelection(target);
    onActiveWorkspaceTargetChange(selection.activeTarget);
    setMenuOpen(selection.menuOpen);
    onOpenTarget(selection.openTarget);
  }

  function toggleMenu() {
    if (onOpenExternalMenu) {
      if (!workspaceView.canToggleMenu) return;
      const bounds = workspaceControlRef.current?.getBoundingClientRect();
      if (!bounds) return;
      onOpenExternalMenu(
        {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        },
        workspaceView.visibleOptions.length,
      );
      return;
    }

    setMenuOpen((current) => footerWorkspaceMenuOpenAfterToggle(current, workspaceView.canToggleMenu));
  }

  if (!workspaceView.activeOption) return <>{fallback}</>;

  return (
    <DropdownMenuHost
      active={menuOpen}
      className={joinClass(workspaceView.control.className, menuPlacement === "below" && "opens-below")}
      hostRef={workspaceControlRef}
      onDismiss={() => setMenuOpen(false)}
    >
      <button
        className={workspaceOpenButton?.className}
        type="button"
        aria-label={workspaceOpenButton?.ariaLabel}
        title={workspaceOpenButton?.title}
        onClick={() => openTarget(workspaceView.activeOption.target)}
        disabled={workspaceView.controlsDisabled}
      >
        <span className={workspaceView.control.iconClassName}>
          <img src={workspaceView.activeOption.iconSrc} alt="" aria-hidden="true" />
        </span>
      </button>
      <button
        id={workspaceMenuToggle.id}
        className={workspaceMenuToggle.className}
        type="button"
        aria-label={workspaceMenuToggle.ariaLabel}
        aria-haspopup={workspaceMenuToggle.ariaHasPopup}
        aria-expanded={workspaceMenuToggle.ariaExpanded}
        aria-controls={workspaceMenuToggle.ariaControls}
        title={workspaceMenuToggle.title}
        onClick={toggleMenu}
        disabled={workspaceView.controlsDisabled}
      >
        <ChevronDown aria-hidden="true" />
      </button>
      {menuOpen ? (
        <div
          className={workspaceMenu.className}
          id={workspaceMenu.id}
          role={workspaceMenu.role}
          aria-labelledby={workspaceMenu.ariaLabelledBy}
        >
          {workspaceView.visibleOptions.map((option) => {
            const itemView = footerWorkspaceMenuItemView(option, workspaceView.activeMenuTarget);

            return (
              <button
                className={itemView.className}
                type="button"
                role={itemView.role}
                aria-current={itemView.ariaCurrent}
                key={option.target}
                onClick={() => openTarget(option.target)}
              >
                <span className={itemView.iconClassName}>
                  <img src={option.iconSrc} alt="" aria-hidden="true" />
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </DropdownMenuHost>
  );
}
