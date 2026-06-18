import { useCallback, useEffect, useState } from "react";
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
import { useGocusController } from "./app/useGocusController";
import { useSettingsEscape } from "./app/useAppKeyboardShortcuts";
import { useChangedNowPanel } from "./app/useChangedNowPanel";
import {
  appEditorBackdropView,
  appChangedNowCount,
  appNativeDialogBlockerView,
  appPanelContentView,
  appPanelView,
  appScrollRegionView,
  appShouldShowRepositoryControls,
  appViewportView,
} from "./lib/appShellView";
import { collapsedRailHeightForBranchName } from "./lib/collapsedRailView";
import { logBridgeWarning } from "./lib/errorMessages";
import { activeWorkspaceOpenTarget, visibleWorkspaceOpenOptions } from "./lib/workspaceOpenChoices";
import { workspaceOpenOptions } from "./lib/workspaceOpenOptions";
import { defaultWorkspaceOpenTarget } from "./lib/workspaceOpenTargets";
import type { WorkspaceOpenTarget } from "./types";

function commitGraphNodeY(density: "compact" | "comfortable") {
  return density === "comfortable" ? 27 : 22;
}

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
  const controller = useGocusController();
  const [workspaceOpenTarget, setWorkspaceOpenTarget] = useState<WorkspaceOpenTarget>(defaultWorkspaceOpenTarget);
  const panelContent = appPanelContentView({
    snapshot: controller.snapshot,
    settingsOpen: controller.settingsOpen,
  });
  const repositorySnapshot = panelContent.mode === "repository" ? panelContent.snapshot : null;
  const viewportView = appViewportView({ electron: controller.electron, collapsed: controller.collapsed });
  const panelView = appPanelView();
  const commitScrollRegion = appScrollRegionView();
  const nativeDialogBlocker = appNativeDialogBlockerView();
  const changedNowCount = appChangedNowCount(controller.snapshot);
  const showRepositoryControls = appShouldShowRepositoryControls({ snapshot: repositorySnapshot });
  const graphNodeY = commitGraphNodeY(controller.preferences.density);
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
  });

  const closeSettings = useCallback(() => {
    controller.setSettingsOpen(false);
  }, [controller.setSettingsOpen]);

  useSettingsEscape({
    settingsOpen: controller.settingsOpen,
    onClose: closeSettings,
  });
  useEffect(() => {
    const height = collapsedRailHeightForBranchName(controller.snapshot?.branch.name);
    const syncHeight = window.gocus?.setCollapsedRailHeight?.(height);
    if (syncHeight) {
      void syncHeight.catch((error) => {
        console.warn("[Gocus] Unable to update collapsed rail height.", error);
      });
    }
  }, [controller.snapshot?.branch.name]);

  useEffect(() => {
    window.gocus
      ?.getActiveWorkspaceTarget()
      .then(setWorkspaceOpenTarget)
      .catch((error) => logBridgeWarning("Unable to load active workspace target.", error));
    return window.gocus?.onActiveWorkspaceTargetChanged(setWorkspaceOpenTarget);
  }, []);

  function updatePreferences(nextPreferences: typeof controller.preferences) {
    controller.setPreferences(nextPreferences);
  }

  function updateWorkspaceOpenTarget(target: WorkspaceOpenTarget) {
    setWorkspaceOpenTarget(target);
    window.gocus?.setActiveWorkspaceTarget(target).catch((error) => logBridgeWarning("Unable to save active workspace target.", error));
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
          {panelContent.mode === "settings" ? (
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
                  <WorktreeContext
                    worktrees={panelContent.snapshot.worktrees}
                    onOpenWorktree={controller.openWorktree}
                    onCleanupWorktrees={controller.cleanupWorktrees}
                  />
                  <div className={commitScrollRegion.className}>
                    <RecentCommits
                      commits={panelContent.snapshot.commits}
                      selectedId={controller.selectedCommitId}
                      graphStyle={controller.preferences.graphStyle}
                      graphNodeY={graphNodeY}
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
                onOpenSettings={() => controller.setSettingsOpen(true)}
                onOpenWorkspace={controller.openWorkspace}
                activeWorkspaceTarget={workspaceOpenTarget}
                onActiveWorkspaceTargetChange={updateWorkspaceOpenTarget}
                hasRepository={Boolean(controller.snapshot)}
                changedNowOpen={changedNowWindowOpen}
                changedNowCount={changedNowCount}
                preferences={controller.preferences}
                availableWorkspaceTargets={controller.availableWorkspaceTargets}
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
