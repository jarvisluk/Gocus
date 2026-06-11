import { useCallback, useEffect, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ActionDialog } from "./components/ActionDialog";
import { CollapsedRail } from "./components/CollapsedRail";
import { EmptyRepositoryState } from "./components/EmptyRepositoryState";
import { Footer } from "./components/Footer";
import { PanelHeader } from "./components/PanelHeader";
import { RecentCommits } from "./components/RecentCommits";
import { RepositoryControls } from "./components/RepositoryControls";
import { RepositoryStateBanner } from "./components/RepositoryStateBanner";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorktreeContext } from "./components/WorktreeContext";
import { useGitPeekController } from "./app/useGitPeekController";
import { useSettingsEscape, useZenEscape } from "./app/useAppKeyboardShortcuts";
import { useChangedNowPanel } from "./app/useChangedNowPanel";
import {
  appEditorBackdropView,
  appChangedNowCount,
  appNativeDialogBlockerView,
  appPanelContentView,
  appPanelView,
  appPreferencesWithZenMode,
  appShouldCloseSettingsAfterPreferencesChange,
  appScrollRegionView,
  appShouldShowRepositoryControls,
  appViewportView,
  appZenExitButtonView,
} from "./lib/appShellView";
import { collapsedRailHeightForBranchName } from "./lib/collapsedRailView";
import { logBridgeWarning } from "./lib/errorMessages";
import { activeWorkspaceOpenTarget, visibleWorkspaceOpenOptions } from "./lib/workspaceOpenChoices";
import { workspaceOpenOptions } from "./lib/workspaceOpenOptions";
import type { WorkspaceOpenTarget } from "./types";

function EditorBackdrop() {
  const backdrop = appEditorBackdropView();

  return (
    <div className={backdrop.className} aria-hidden={backdrop.ariaHidden}>
      <div className={backdrop.tabs.className}>
        {backdrop.tabs.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <pre>{backdrop.previewCode}</pre>
    </div>
  );
}

export default function App() {
  const controller = useGitPeekController();
  const [workspaceOpenTarget, setWorkspaceOpenTarget] = useState<WorkspaceOpenTarget>("cursor");
  const panelContent = appPanelContentView({
    snapshot: controller.snapshot,
    settingsOpen: controller.settingsOpen,
    zenMode: controller.preferences.zenMode,
  });
  const zenActive = panelContent.mode === "zen";
  const repositorySnapshot = panelContent.mode === "repository" ? panelContent.snapshot : null;
  const viewportView = appViewportView({ electron: controller.electron, collapsed: controller.collapsed, zenActive });
  const panelView = appPanelView(zenActive);
  const zenExitButton = appZenExitButtonView();
  const zenScrollRegion = appScrollRegionView(true);
  const commitScrollRegion = appScrollRegionView(false);
  const nativeDialogBlocker = appNativeDialogBlockerView();
  const changedNowCount = appChangedNowCount(controller.snapshot);
  const showRepositoryControls = appShouldShowRepositoryControls({ snapshot: repositorySnapshot, zenActive });
  const syncedWorkspaceOpenTarget = activeWorkspaceOpenTarget(
    visibleWorkspaceOpenOptions(
      workspaceOpenOptions,
      controller.availableWorkspaceTargets,
      controller.preferences.workspaceOpenTargets,
    ),
    workspaceOpenTarget,
  );
  const {
    changedNowWindowOpen,
    collapsedRailChangedNowOpen,
    toggleChangedNowWindow,
    toggleChangedNowFromCollapsedRail,
  } = useChangedNowPanel({
    snapshot: controller.snapshot,
    collapsed: controller.collapsed,
    settingsOpen: controller.settingsOpen,
    workspaceOpenTarget: syncedWorkspaceOpenTarget,
    zenActive,
  });

  const exitZenMode = useCallback(() => {
    controller.setPreferences(appPreferencesWithZenMode(controller.preferences, false));
  }, [controller.preferences, controller.setPreferences]);
  const closeSettings = useCallback(() => {
    controller.setSettingsOpen(false);
  }, [controller.setSettingsOpen]);

  useSettingsEscape({
    settingsOpen: controller.settingsOpen,
    zenActive,
    onClose: closeSettings,
  });
  useZenEscape({ zenActive, onExit: exitZenMode });
  useEffect(() => {
    const height = collapsedRailHeightForBranchName(controller.snapshot?.branch.name);
    const syncHeight = window.gitPeek?.setCollapsedRailHeight?.(height);
    if (syncHeight) {
      void syncHeight.catch((error) => {
        console.warn("[Git Peek] Unable to update collapsed rail height.", error);
      });
    }
  }, [controller.snapshot?.branch.name]);

  useEffect(() => {
    window.gitPeek
      ?.getActiveWorkspaceTarget()
      .then(setWorkspaceOpenTarget)
      .catch((error) => logBridgeWarning("Unable to load active workspace target.", error));
    return window.gitPeek?.onActiveWorkspaceTargetChanged(setWorkspaceOpenTarget);
  }, []);

  function updatePreferences(nextPreferences: typeof controller.preferences) {
    controller.setPreferences(nextPreferences);
    if (appShouldCloseSettingsAfterPreferencesChange({ settingsOpen: controller.settingsOpen, nextZenMode: nextPreferences.zenMode })) {
      controller.setSettingsOpen(false);
    }
  }

  function updateWorkspaceOpenTarget(target: WorkspaceOpenTarget) {
    setWorkspaceOpenTarget(target);
    window.gitPeek?.setActiveWorkspaceTarget(target).catch((error) => logBridgeWarning("Unable to save active workspace target.", error));
  }

  return (
    <main className={viewportView.className}>
      {!controller.electron ? <EditorBackdrop /> : null}

      {controller.collapsed ? (
        <CollapsedRail
          snapshot={controller.snapshot}
          changedNowOpen={collapsedRailChangedNowOpen}
          onExpand={() => controller.setCollapsedState(false)}
          onOpenChangedNow={toggleChangedNowFromCollapsedRail}
          onDock={controller.dockCurrentState}
        />
      ) : (
        <section className={panelView.className} aria-label={panelView.ariaLabel}>
          {panelContent.mode === "zen" ? (
            <>
              <ActionDialog
                createMergeCommit={controller.preferences.createMergeCommit}
                dialog={controller.actionDialog}
                onBranchPrefixChange={controller.updateActionBranchPrefix}
                onBranchNameChange={controller.updateActionBranchName}
                onMergeTargetChange={controller.updateActionMergeTarget}
                onCancel={controller.cancelActionDialog}
                onConfirm={controller.confirmActionDialog}
              />
              <button
                className={zenExitButton.className}
                type="button"
                aria-label={zenExitButton.ariaLabel}
                title={zenExitButton.title}
                onClick={exitZenMode}
              >
                <Minimize2 aria-hidden="true" />
              </button>
              <div className={zenScrollRegion.className}>
                <RecentCommits
                  commits={panelContent.snapshot.commits}
                  selectedId={controller.selectedCommitId}
                  expandSelectedMessage
                  onSelect={controller.selectCommit}
                  onAction={controller.handleCommitAction}
                />
              </div>
            </>
          ) : panelContent.mode === "settings" ? (
            <SettingsPanel
              preferences={controller.preferences}
              availableWorkspaceTargets={controller.availableWorkspaceTargets}
              onChange={updatePreferences}
              onBack={() => controller.setSettingsOpen(false)}
              onReset={controller.resetPreferences}
            />
          ) : (
            <>
              <PanelHeader
                snapshot={controller.snapshot}
                recentRepositories={controller.recentRepositories}
                pinned={controller.pinned}
                refreshing={controller.refreshing}
                onOpen={controller.openRepository}
                onSwitchRepository={controller.switchRepository}
                onRefresh={() => controller.refreshSnapshot()}
                onTogglePinned={controller.togglePinned}
                onCollapse={() => controller.setCollapsedState(true)}
              />

              <ActionDialog
                createMergeCommit={controller.preferences.createMergeCommit}
                dialog={controller.actionDialog}
                onBranchPrefixChange={controller.updateActionBranchPrefix}
                onBranchNameChange={controller.updateActionBranchName}
                onMergeTargetChange={controller.updateActionMergeTarget}
                onCancel={controller.cancelActionDialog}
                onConfirm={controller.confirmActionDialog}
              />

              {panelContent.mode === "repository" ? (
                <>
                  <RepositoryStateBanner state={panelContent.snapshot.repositoryState} />
                  {showRepositoryControls ? (
                    <RepositoryControls
                      snapshot={panelContent.snapshot}
                      view={controller.commitView}
                      onChangeView={controller.changeCommitView}
                      onSwitchBranch={controller.switchBranch}
                    />
                  ) : null}
                  <WorktreeContext worktrees={panelContent.snapshot.worktrees} onOpenWorktree={controller.openWorktree} />
                  <div className={commitScrollRegion.className}>
                    <RecentCommits
                      commits={panelContent.snapshot.commits}
                      selectedId={controller.selectedCommitId}
                      onSelect={controller.selectCommit}
                      onAction={controller.handleCommitAction}
                    />
                  </div>

                </>
              ) : (
                <EmptyRepositoryState
                  loading={controller.loading}
                  notice={controller.notice}
                  folderWithoutGit={controller.folderWithoutGit}
                  initializingRepository={controller.initializingRepository}
                  recentRepositories={controller.recentRepositories}
                  onOpen={controller.openRepository}
                  onInitializeRepository={controller.initializeRepository}
                  onSwitchRepository={controller.switchRepository}
                />
              )}

              <Footer
                onOpenRepo={controller.openRepository}
                onEnterZen={() => updatePreferences(appPreferencesWithZenMode(controller.preferences, true))}
                onOpenSettings={() => controller.setSettingsOpen(true)}
                onOpenWorkspace={controller.openWorkspace}
                activeWorkspaceTarget={workspaceOpenTarget}
                onActiveWorkspaceTargetChange={updateWorkspaceOpenTarget}
                hasRepository={Boolean(controller.snapshot)}
                changedNowOpen={changedNowWindowOpen}
                changedNowCount={changedNowCount}
                preferences={controller.preferences}
                availableWorkspaceTargets={controller.availableWorkspaceTargets}
                showZenEntry={controller.preferences.showZenEntry}
                notice={controller.notice}
                onOpenChangedNow={toggleChangedNowWindow}
              />
            </>
          )}
        </section>
      )}
      {controller.repositoryDialogOpen ? (
        <div className={nativeDialogBlocker.className} aria-hidden={nativeDialogBlocker.ariaHidden} />
      ) : null}
    </main>
  );
}
