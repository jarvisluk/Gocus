import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileDiff, Focus, FolderOpen, Settings } from "lucide-react";
import {
  footerActionsView,
  footerNoticeView,
  footerWorkspaceMenuOpenAfterToggle,
  footerWorkspaceMenuItemView,
  footerWorkspaceMenuToggleView,
  footerWorkspaceMenuView,
  footerWorkspaceOpenButtonView,
  footerWorkspaceSelection,
  footerWorkspaceView,
} from "../lib/footerWorkspaceView";
import { useDismissableLayer } from "../lib/useDismissableLayer";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { UiPreferences, WorkspaceOpenTarget } from "../types";

export function Footer({
  onOpenRepo,
  onOpenChangedNow,
  onEnterZen,
  onOpenSettings,
  onOpenWorkspace,
  hasRepository,
  changedNowOpen,
  changedNowCount,
  preferences,
  availableWorkspaceTargets,
  showZenEntry,
  notice,
}: {
  onOpenRepo: () => void;
  onOpenChangedNow: () => void;
  onEnterZen: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: (target: WorkspaceOpenTarget) => void;
  hasRepository: boolean;
  changedNowOpen: boolean;
  changedNowCount: number;
  preferences: UiPreferences;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  showZenEntry: boolean;
  notice: string;
}) {
  const [activeTarget, setActiveTarget] = useState<WorkspaceOpenTarget>("cursor");
  const [menuOpen, setMenuOpen] = useState(false);
  const workspaceControlRef = useRef<HTMLDivElement>(null);
  const actionsView = footerActionsView({ changedNowOpen, hasRepository, showZenEntry });
  const noticeView = footerNoticeView({ hasRepository, notice });
  const workspaceView = footerWorkspaceView({
    options: workspaceOpenOptions,
    availableTargets: availableWorkspaceTargets,
    enabledTargets: preferences.workspaceOpenTargets,
    activeTarget,
    hasRepository,
  });
  const workspaceMenuToggle = footerWorkspaceMenuToggleView(menuOpen);
  const workspaceOpenButton = workspaceView.activeOption ? footerWorkspaceOpenButtonView(workspaceView.activeOption) : null;
  const workspaceMenu = footerWorkspaceMenuView();

  useEffect(() => {
    if (workspaceView.shouldCloseMenu) setMenuOpen(false);
  }, [workspaceView.shouldCloseMenu]);

  useDismissableLayer({ active: menuOpen, refs: [workspaceControlRef], onDismiss: () => setMenuOpen(false) });

  function openWorkspace(target: WorkspaceOpenTarget) {
    const selection = footerWorkspaceSelection(target);
    setActiveTarget(selection.activeTarget);
    setMenuOpen(selection.menuOpen);
    onOpenWorkspace(selection.openTarget);
  }

  function toggleMenu() {
    setMenuOpen((current) => footerWorkspaceMenuOpenAfterToggle(current, workspaceView.canToggleMenu));
  }

  return (
    <>
      {noticeView ? (
        <div className={noticeView.className} role={noticeView.role} aria-live={noticeView.ariaLive}>
          {noticeView.message}
        </div>
      ) : null}
      <footer className={actionsView.className}>
        <button
          className={actionsView.settingsButton.className}
          type="button"
          aria-label={actionsView.settingsButton.ariaLabel}
          title={actionsView.settingsButton.title}
          onClick={onOpenSettings}
        >
          <Settings aria-hidden="true" />
        </button>
        {actionsView.showOpenRepositoryButton ? (
          <button className={actionsView.openRepositoryButton.className} type="button" onClick={onOpenRepo}>
            <FolderOpen aria-hidden="true" />
            {actionsView.openRepositoryButton.label}
          </button>
        ) : (
          <button
            className={actionsView.changedNowButton.className}
            type="button"
            aria-label={actionsView.changedNowButton.ariaLabel}
            aria-pressed={actionsView.changedNowButton.ariaPressed}
            title={actionsView.changedNowButton.title}
            onClick={onOpenChangedNow}
          >
            <FileDiff aria-hidden="true" />
            <span>{changedNowCount}</span>
          </button>
        )}
        {actionsView.showZenButton ? (
          <button
            className={actionsView.zenButton.className}
            type="button"
            aria-label={actionsView.zenButton.ariaLabel}
            title={actionsView.zenButton.title}
            onClick={onEnterZen}
            disabled={actionsView.zenButton.disabled}
          >
            <Focus aria-hidden="true" />
          </button>
        ) : null}
        {workspaceView.activeOption ? (
          <div className={workspaceView.control.className} ref={workspaceControlRef}>
            <button
              className={workspaceOpenButton?.className}
              type="button"
              aria-label={workspaceOpenButton?.ariaLabel}
              title={workspaceOpenButton?.title}
              onClick={() => openWorkspace(workspaceView.activeOption.target)}
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
                      onClick={() => openWorkspace(option.target)}
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
          </div>
        ) : (
          <span aria-hidden="true" />
        )}
      </footer>
    </>
  );
}
