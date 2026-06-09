import { useCallback, useEffect, useMemo, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ActionDialog } from "./components/ActionDialog";
import { CollapsedRail } from "./components/CollapsedRail";
import { EmptyRepositoryState } from "./components/EmptyRepositoryState";
import { Footer } from "./components/Footer";
import { PanelHeader } from "./components/PanelHeader";
import { RecentCommits } from "./components/RecentCommits";
import { RepositoryControls } from "./components/RepositoryControls";
import { SettingsPanel } from "./components/SettingsPanel";
import { useGitPeekController } from "./app/useGitPeekController";
import { joinClass } from "./lib/classNames";

function EditorBackdrop() {
  return (
    <div className="editor-backdrop" aria-hidden="true">
      <div className="editor-tabs">
        <span>Menu.tsx</span>
        <span>shortcuts.ts</span>
      </div>
      <pre>{`export function Menu({ items }) {
  return (
    <nav className="menu">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => item.onClick()}
          className="menu-item"
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}`}</pre>
    </div>
  );
}

export default function App() {
  const controller = useGitPeekController();
  const [changedNowWindowOpen, setChangedNowWindowOpen] = useState(true);
  const zenActive = Boolean(controller.snapshot && controller.preferences.zenMode);
  const changedNowCount = useMemo(() => {
    return controller.snapshot?.changedFiles.length ?? 0;
  }, [controller.snapshot]);
  const temporaryInfoPayload = useMemo(
    () =>
      controller.snapshot && changedNowWindowOpen && !controller.collapsed && !controller.settingsOpen && !zenActive
        ? {
            kind: "changed-files" as const,
            files: controller.snapshot.changedFiles,
            filter: "all" as const,
            selectedFileKey: "",
          }
        : null,
    [changedNowWindowOpen, controller.collapsed, controller.settingsOpen, controller.snapshot, zenActive],
  );

  const exitZenMode = useCallback(() => {
    controller.setPreferences({ ...controller.preferences, zenMode: false });
  }, [controller.preferences, controller.setPreferences]);

  function updatePreferences(nextPreferences: typeof controller.preferences) {
    controller.setPreferences(nextPreferences);
    if (nextPreferences.zenMode) controller.setSettingsOpen(false);
  }

  const openChangedNowWindow = useCallback(() => {
    setChangedNowWindowOpen(true);
    if (temporaryInfoPayload) window.gitPeek?.setTemporaryInfoPanel(temporaryInfoPayload);
  }, [temporaryInfoPayload]);

  const openChangedNowFromCollapsedRail = useCallback(() => {
    setChangedNowWindowOpen(true);
    controller.setCollapsedState(false);
  }, [controller.setCollapsedState]);

  const closeChangedNowWindow = useCallback(() => {
    setChangedNowWindowOpen(false);
    window.gitPeek?.setTemporaryInfoPanel(null);
  }, []);

  useEffect(() => {
    if (!controller.settingsOpen || zenActive) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        controller.setSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controller.setSettingsOpen, controller.settingsOpen, zenActive]);

  useEffect(() => {
    if (!zenActive) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        exitZenMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitZenMode, zenActive]);

  useEffect(() => {
    window.gitPeek?.setTemporaryInfoPanel(temporaryInfoPayload);
  }, [temporaryInfoPayload]);

  useEffect(() => {
    if (!temporaryInfoPayload) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".footer-changed-now")) return;
      closeChangedNowWindow();
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [closeChangedNowWindow, temporaryInfoPayload]);

  useEffect(
    () => () => {
      window.gitPeek?.setTemporaryInfoPanel(null);
    },
    [],
  );

  useEffect(
    () =>
      window.gitPeek?.onTemporaryInfoPanelClosed(() => {
        setChangedNowWindowOpen(false);
      }),
    [],
  );

  return (
    <main className={joinClass("app-viewport", controller.electron && "is-electron", controller.collapsed && "is-collapsed", zenActive && "is-zen")}>
      {!controller.electron ? <EditorBackdrop /> : null}

      {controller.collapsed ? (
        <CollapsedRail
          snapshot={controller.snapshot}
          onExpand={() => controller.setCollapsedState(false)}
          onOpenChangedNow={openChangedNowFromCollapsedRail}
          onDock={controller.dockCurrentState}
        />
      ) : (
        <section className={joinClass("peek-panel", zenActive && "is-zen-panel")} aria-label={zenActive ? "Git Peek zen commit view" : "Git Peek side panel"}>
          {zenActive ? (
            <>
              <ActionDialog
                dialog={controller.actionDialog}
                onBranchPrefixChange={controller.updateActionBranchPrefix}
                onBranchNameChange={controller.updateActionBranchName}
                onCancel={controller.cancelActionDialog}
                onConfirm={controller.confirmActionDialog}
              />
              <button className="ui-icon-button zen-exit-button" type="button" aria-label="Exit Zen mode" title="Exit Zen mode" onClick={exitZenMode}>
                <Minimize2 aria-hidden="true" />
              </button>
              <div className="scroll-region zen-scroll-region">
                <RecentCommits
                  commits={controller.snapshot!.commits}
                  selectedId={controller.selectedCommitId}
                  expandSelectedMessage
                  onSelect={controller.selectCommit}
                  onAction={controller.handleCommitAction}
                />
              </div>
            </>
          ) : controller.settingsOpen ? (
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
                dialog={controller.actionDialog}
                onBranchPrefixChange={controller.updateActionBranchPrefix}
                onBranchNameChange={controller.updateActionBranchName}
                onCancel={controller.cancelActionDialog}
                onConfirm={controller.confirmActionDialog}
              />

              {controller.snapshot ? (
                <>
                  {!controller.preferences.zenMode ? (
                    <RepositoryControls
                      snapshot={controller.snapshot}
                      view={controller.commitView}
                      onChangeView={controller.changeCommitView}
                      onOpenWorktree={controller.openWorktree}
                    />
                  ) : null}
                  <div className="scroll-region">
                    <RecentCommits
                      commits={controller.snapshot.commits}
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
                onEnterZen={() => updatePreferences({ ...controller.preferences, zenMode: true })}
                onOpenSettings={() => controller.setSettingsOpen(true)}
                onOpenWorkspace={controller.openWorkspace}
                hasRepository={Boolean(controller.snapshot)}
                changedNowCount={changedNowCount}
                preferences={controller.preferences}
                availableWorkspaceTargets={controller.availableWorkspaceTargets}
                showZenEntry={controller.preferences.showZenEntry}
                onOpenChangedNow={openChangedNowWindow}
              />
            </>
          )}
        </section>
      )}
      {controller.repositoryDialogOpen ? <div className="native-dialog-blocker" aria-hidden="true" /> : null}
    </main>
  );
}
