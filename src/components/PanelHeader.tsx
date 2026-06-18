import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, GitBranch, Pin, PinOff, RefreshCw, Route } from "lucide-react";
import { IconButton } from "./IconButton";
import {
  panelHeaderActionsView,
  panelHeaderOpenRepositoryButtonView,
  panelHeaderView,
  panelRepositoryMenuOpenAfterToggle,
  panelRepositoryMenuItemView,
  panelRepositorySelection,
  panelRepositoryMenuView,
  panelRepositoryTriggerView,
  type PanelHeaderActionIcon,
  type PanelHeaderBranchPillIcon,
} from "../lib/panelHeaderView";
import { useDismissableLayer } from "../lib/useDismissableLayer";
import type { GitSnapshot, RecentRepository } from "../types";

function panelHeaderActionIcon(icon: PanelHeaderActionIcon, className = "") {
  if (icon === "pin-off") return <PinOff aria-hidden="true" />;
  if (icon === "pin") return <Pin aria-hidden="true" />;
  if (icon === "refresh") return <RefreshCw className={className} aria-hidden="true" />;
  return <ChevronLeft aria-hidden="true" />;
}

function panelHeaderBranchPillIcon(icon: PanelHeaderBranchPillIcon) {
  if (icon === "branch") return <GitBranch aria-hidden="true" />;
  return null;
}

export function PanelHeader({
  snapshot,
  recentRepositories,
  pinned,
  refreshing,
  onOpen,
  onSwitchRepository,
  onRefresh,
  onTogglePinned,
  onCollapse,
}: {
  snapshot: GitSnapshot | null;
  recentRepositories: RecentRepository[];
  pinned: boolean;
  refreshing: boolean;
  onOpen: () => void;
  onSwitchRepository: (repositoryPath: string) => void;
  onRefresh: () => void;
  onTogglePinned: () => void;
  onCollapse: () => void;
}) {
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const repoSwitcherRef = useRef<HTMLDivElement>(null);
  const panelView = panelHeaderView(snapshot, recentRepositories);
  const {
    branchPill,
    currentRepository,
    recentRepositoryOptions,
    canSwitchRepository,
    repositoryPathLabel,
    repositoryTitle,
  } = panelView;
  const openRepositoryButton = panelHeaderOpenRepositoryButtonView();
  const repositoryTrigger = panelRepositoryTriggerView({ canSwitchRepository, repoMenuOpen });
  const repositoryMenu = panelRepositoryMenuView();
  const actionsView = panelHeaderActionsView({ pinned, refreshing, hasRepository: Boolean(snapshot) });

  useDismissableLayer({
    active: repoMenuOpen,
    dismissTiming: "afterTargetAction",
    refs: [repoSwitcherRef],
    onDismiss: () => setRepoMenuOpen(false),
  });

  function switchRepository(repositoryPath: string) {
    const selection = panelRepositorySelection(snapshot, repositoryPath);
    setRepoMenuOpen(selection.menuOpen);
    if (selection.switchRepositoryPath) onSwitchRepository(selection.switchRepositoryPath);
  }

  return (
    <header className={panelView.header.className}>
      <IconButton label={openRepositoryButton.label} onClick={onOpen}>
        <Route aria-hidden="true" />
      </IconButton>
      <div className={panelView.repoSwitcher.className} ref={repoSwitcherRef}>
        {canSwitchRepository ? (
          <button
            id={repositoryTrigger.id}
            className={repositoryTrigger.className}
            type="button"
            aria-label={repositoryTrigger.ariaLabel}
            aria-haspopup={repositoryTrigger.ariaHasPopup}
            aria-expanded={repositoryTrigger.ariaExpanded}
            aria-controls={repositoryTrigger.ariaControls}
            onClick={() => setRepoMenuOpen((current) => panelRepositoryMenuOpenAfterToggle(current, canSwitchRepository))}
          >
            <span className={panelView.repositoryTitleCopy.className}>
              <strong>{repositoryTitle}</strong>
              <span>{repositoryPathLabel}</span>
            </span>
            <ChevronDown aria-hidden="true" />
          </button>
        ) : (
          <div className={panelView.staticRepositoryTitle.className}>
            <strong>{repositoryTitle}</strong>
            <span>{repositoryPathLabel}</span>
          </div>
        )}
        {repoMenuOpen && snapshot ? (
          <div
            className={repositoryMenu.className}
            id={repositoryMenu.id}
            role={repositoryMenu.role}
            aria-labelledby={repositoryMenu.ariaLabelledBy}
          >
            {recentRepositoryOptions.map((repository) => {
              const itemView = panelRepositoryMenuItemView(repository, currentRepository);

              return (
                <button
                  className={itemView.className}
                  type="button"
                  role={itemView.role}
                  aria-current={itemView.ariaCurrent}
                  title={itemView.title}
                  key={itemView.key}
                  onClick={() => switchRepository(itemView.path)}
                >
                  <span className={itemView.checkClassName}>{itemView.showCheck ? <Check aria-hidden="true" /> : null}</span>
                  <span className={itemView.textClassName}>
                    <strong>{itemView.label}</strong>
                    <code>{itemView.path}</code>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {branchPill ? (
        <span className={branchPill.className} title={branchPill.title}>
          {panelHeaderBranchPillIcon(branchPill.icon)}
          {branchPill.label}
        </span>
      ) : null}
      <div className={actionsView.className}>
        <IconButton label={actionsView.pinButton.label} active={actionsView.pinButton.active} onClick={onTogglePinned}>
          {panelHeaderActionIcon(actionsView.pinButton.icon)}
        </IconButton>
        <IconButton
          label={actionsView.refreshButton.label}
          busy={actionsView.refreshButton.busy}
          onClick={onRefresh}
          disabled={actionsView.refreshButton.disabled}
        >
          {panelHeaderActionIcon(actionsView.refreshButton.icon, actionsView.refreshButton.iconClassName)}
        </IconButton>
        <IconButton label={actionsView.collapseButton.label} onClick={onCollapse}>
          {panelHeaderActionIcon(actionsView.collapseButton.icon)}
        </IconButton>
      </div>
    </header>
  );
}
