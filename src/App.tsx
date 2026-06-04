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

  return (
    <main className={joinClass("app-viewport", controller.electron && "is-electron", controller.collapsed && "is-collapsed", controller.preferences.zenMode && "is-zen")}>
      {!controller.electron ? <EditorBackdrop /> : null}

      {controller.collapsed ? (
        <CollapsedRail snapshot={controller.snapshot} onExpand={() => controller.setCollapsedState(false)} onDock={controller.dockCurrentState} />
      ) : (
        <section className="peek-panel" aria-label="Git Peek side panel">
          <PanelHeader
            snapshot={controller.snapshot}
            pinned={controller.pinned}
            refreshing={controller.refreshing}
            settingsOpen={controller.settingsOpen}
            onOpen={controller.openRepository}
            onRefresh={() => controller.refreshSnapshot()}
            onTogglePinned={controller.togglePinned}
            onToggleSettings={() => controller.setSettingsOpen(!controller.settingsOpen)}
            onCollapse={() => controller.setCollapsedState(true)}
          />

          <ActionDialog
            dialog={controller.actionDialog}
            onBranchNameChange={controller.updateActionBranchName}
            onCancel={controller.cancelActionDialog}
            onConfirm={controller.confirmActionDialog}
          />

          {controller.settingsOpen ? (
            <SettingsPanel preferences={controller.preferences} onChange={controller.setPreferences} onReset={controller.resetPreferences} />
          ) : null}

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
                  onCheckoutRef={controller.checkoutRef}
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
                <ChangedNow files={controller.snapshot.changedFiles} filter={controller.fileFilter} onClearFilter={() => controller.setFileFilter("all")} />
              ) : null}
            </>
          ) : (
            <EmptyRepositoryState loading={controller.loading} notice={controller.notice} onOpen={controller.openRepository} />
          )}

          <div className="notice-line" role="status">
            {controller.notice}
          </div>

          {!controller.preferences.zenMode ? (
            <Footer
              onOpenRepo={controller.openRepository}
              onOpenWorkspace={controller.openWorkspace}
              hasRepository={Boolean(controller.snapshot)}
            />
          ) : null}
        </section>
      )}
    </main>
  );
}
