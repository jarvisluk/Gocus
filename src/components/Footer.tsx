import { FileDiff, FolderOpen, Settings } from "lucide-react";
import {
  footerActionsView,
  footerNoticeView,
} from "../lib/footerWorkspaceView";
import type { UiPreferences, WorkspaceOpenTarget } from "../types";
import { WorkspaceOpenControl } from "./WorkspaceOpenControl";

export function Footer({
  onOpenRepo,
  onOpenChangedNow,
  onOpenSettings,
  onOpenWorkspace,
  activeWorkspaceTarget,
  onActiveWorkspaceTargetChange,
  hasRepository,
  changedNowOpen,
  changedNowCount,
  preferences,
  availableWorkspaceTargets,
  notice,
}: {
  onOpenRepo: () => void;
  onOpenChangedNow: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: (target: WorkspaceOpenTarget) => void;
  activeWorkspaceTarget: WorkspaceOpenTarget;
  onActiveWorkspaceTargetChange: (target: WorkspaceOpenTarget) => void;
  hasRepository: boolean;
  changedNowOpen: boolean;
  changedNowCount: number;
  preferences: UiPreferences;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  notice: string;
}) {
  const actionsView = footerActionsView({ changedNowOpen, hasRepository });
  const noticeView = footerNoticeView({ hasRepository, notice });

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
        <WorkspaceOpenControl
          activeWorkspaceTarget={activeWorkspaceTarget}
          availableWorkspaceTargets={availableWorkspaceTargets}
          enabledWorkspaceTargets={preferences.workspaceOpenTargets}
          hasRepository={hasRepository}
          fallback={<span aria-hidden="true" />}
          onActiveWorkspaceTargetChange={onActiveWorkspaceTargetChange}
          onOpenTarget={onOpenWorkspace}
        />
      </footer>
    </>
  );
}
