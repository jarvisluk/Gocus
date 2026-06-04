import { useCallback, useEffect, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ActionDialog } from "./components/ActionDialog";
import { ChangedNow } from "./components/ChangedNow";
import { CollapsedRail } from "./components/CollapsedRail";
import { EmptyRepositoryState } from "./components/EmptyRepositoryState";
import { Footer } from "./components/Footer";
import { PanelHeader } from "./components/PanelHeader";
import { RecentCommits } from "./components/RecentCommits";
import { RepositoryControls } from "./components/RepositoryControls";
import { SettingsPanel } from "./components/SettingsPanel";
import { SummaryChips } from "./components/SummaryChips";
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
  const [changedNowCollapsed, setChangedNowCollapsed] = useState(false);
  const zenActive = Boolean(controller.snapshot && controller.preferences.zenMode);

  const exitZenMode = useCallback(() => {
    controller.setPreferences({ ...controller.preferences, zenMode: false });
  }, [controller.preferences, controller.setPreferences]);

  function updatePreferences(nextPreferences: typeof controller.preferences) {
    controller.setPreferences(nextPreferences);
    if (nextPreferences.zenMode) controller.setSettingsOpen(false);
  }

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

  return (
    <main className={joinClass("app-viewport", controller.electron && "is-electron", controller.collapsed && "is-collapsed", zenActive && "is-zen")}>
      {!controller.electron ? <EditorBackdrop /> : null}

      {controller.collapsed ? (
        <CollapsedRail snapshot={controller.snapshot} onExpand={() => controller.setCollapsedState(false)} onDock={controller.dockCurrentState} />
      ) : (
        <section className={joinClass("peek-panel", zenActive && "is-zen-panel")} aria-label={zenActive ? "Git Peek zen commit view" : "Git Peek side panel"}>
          {zenActive ? (
            <>
              <ActionDialog
                dialog={controller.actionDialog}
                onBranchNameChange={controller.updateActionBranchName}
                onCancel={controller.cancelActionDialog}
                onConfirm={controller.confirmActionDialog}
              />
              <button className="zen-exit-button" type="button" aria-label="Exit Zen mode" title="Exit Zen mode" onClick={exitZenMode}>
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
              onChange={updatePreferences}
              onBack={() => controller.setSettingsOpen(false)}
              onReset={controller.resetPreferences}
            />
          ) : (
            <>
              <PanelHeader
                snapshot={controller.snapshot}
                pinned={controller.pinned}
                refreshing={controller.refreshing}
                onOpen={controller.openRepository}
                onRefresh={() => controller.refreshSnapshot()}
                onTogglePinned={controller.togglePinned}
                onCollapse={() => controller.setCollapsedState(true)}
              />

              <ActionDialog
                dialog={controller.actionDialog}
                onBranchNameChange={controller.updateActionBranchName}
                onCancel={controller.cancelActionDialog}
                onConfirm={controller.confirmActionDialog}
              />

              {controller.snapshot && !controller.preferences.zenMode ? (
                <SummaryChips snapshot={controller.snapshot} activeFilter={controller.fileFilter} onFilter={controller.setFileFilter} />
              ) : null}

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

                  {!controller.preferences.zenMode ? (
                    <ChangedNow
                      files={controller.snapshot.changedFiles}
                      filter={controller.fileFilter}
                      collapsed={changedNowCollapsed}
                      onToggleCollapsed={() => setChangedNowCollapsed((current) => !current)}
                    />
                  ) : null}
                </>
              ) : (
                <EmptyRepositoryState loading={controller.loading} notice={controller.notice} onOpen={controller.openRepository} />
              )}

              <Footer
                onOpenRepo={controller.openRepository}
                onEnterZen={() => updatePreferences({ ...controller.preferences, zenMode: true })}
                onOpenSettings={() => controller.setSettingsOpen(true)}
                onOpenWorkspace={controller.openWorkspace}
                hasRepository={Boolean(controller.snapshot)}
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}
