import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, GitBranch, Pin, PinOff, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { DropdownMenuHost } from "./DropdownMenuHost";
import { IconButton } from "./IconButton";
import {
  panelHeaderActionsView,
  panelHeaderFunctionMenuButtonView,
  panelHeaderView,
  panelRepositoryMenuOpenAfterToggle,
  panelRepositoryMenuItemView,
  panelRepositorySelection,
  panelRepositoryMenuView,
  panelRepositoryTriggerView,
  type PanelHeaderActionIcon,
  type PanelHeaderBranchPillIcon,
} from "../lib/panelHeaderView";
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
  functionMenuOpen,
  onOpenFunctionMenu,
  onSwitchRepository,
  onRemoveRecentRepository,
  onRefresh,
  onTogglePinned,
  onCollapse,
}: {
  snapshot: GitSnapshot | null;
  recentRepositories: RecentRepository[];
  pinned: boolean;
  refreshing: boolean;
  functionMenuOpen: boolean;
  onOpenFunctionMenu: () => void;
  onSwitchRepository: (repositoryPath: string) => void;
  onRemoveRecentRepository: (repository: RecentRepository) => void;
  onRefresh: () => void;
  onTogglePinned: () => void;
  onCollapse: () => void;
}) {
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [pendingRemoveRepositoryKey, setPendingRemoveRepositoryKey] = useState("");
  const panelView = panelHeaderView(snapshot, recentRepositories);
  const {
    branchPill,
    currentRepository,
    recentRepositoryOptions,
    canSwitchRepository,
    repositoryPathLabel,
    repositoryTitle,
  } = panelView;
  const functionMenuButton = panelHeaderFunctionMenuButtonView(functionMenuOpen);
  const repositoryTrigger = panelRepositoryTriggerView({ canSwitchRepository, repoMenuOpen });
  const repositoryMenu = panelRepositoryMenuView();
  const actionsView = panelHeaderActionsView({ pinned, refreshing, hasRepository: Boolean(snapshot) });

  function switchRepository(repositoryPath: string) {
    const selection = panelRepositorySelection(snapshot, repositoryPath);
    setRepoMenuOpen(selection.menuOpen);
    setPendingRemoveRepositoryKey("");
    if (selection.switchRepositoryPath) onSwitchRepository(selection.switchRepositoryPath);
  }

  function removeRecentRepository(repository: RecentRepository) {
    const repositoryKey = repository.repositoryKey || repository.path;
    if (pendingRemoveRepositoryKey !== repositoryKey) {
      setPendingRemoveRepositoryKey(repositoryKey);
      return;
    }

    onRemoveRecentRepository(repository);
    setPendingRemoveRepositoryKey("");
    setRepoMenuOpen(recentRepositoryOptions.length > 2);
  }

  function dismissRepositoryMenu() {
    setRepoMenuOpen(false);
    setPendingRemoveRepositoryKey("");
  }

  return (
    <header className={panelView.header.className}>
      <IconButton
        className="function-menu-trigger"
        label={functionMenuButton.label}
        active={functionMenuButton.active}
        onClick={onOpenFunctionMenu}
      >
        <SlidersHorizontal aria-hidden="true" />
      </IconButton>
      <DropdownMenuHost
        active={repoMenuOpen}
        className={panelView.repoSwitcher.className}
        onDismiss={dismissRepositoryMenu}
      >
        {canSwitchRepository ? (
          <button
            id={repositoryTrigger.id}
            className={repositoryTrigger.className}
            type="button"
            aria-label={repositoryTrigger.ariaLabel}
            aria-haspopup={repositoryTrigger.ariaHasPopup}
            aria-expanded={repositoryTrigger.ariaExpanded}
            aria-controls={repositoryTrigger.ariaControls}
            onClick={() => {
              setPendingRemoveRepositoryKey("");
              setRepoMenuOpen((current) => panelRepositoryMenuOpenAfterToggle(current, canSwitchRepository));
            }}
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
              const repositoryKey = repository.repositoryKey || repository.path;
              const itemView = panelRepositoryMenuItemView(repository, currentRepository, pendingRemoveRepositoryKey === repositoryKey);

              return (
                <div className={itemView.rowClassName} role="none" key={itemView.key}>
                  <button
                    className={itemView.className}
                    type="button"
                    role={itemView.role}
                    aria-current={itemView.ariaCurrent}
                    title={itemView.title}
                    onClick={() => switchRepository(itemView.path)}
                  >
                    <span className={itemView.checkClassName}>{itemView.showCheck ? <Check aria-hidden="true" /> : null}</span>
                    <span className={itemView.textClassName}>
                      <strong>{itemView.label}</strong>
                      <code>{itemView.path}</code>
                    </span>
                  </button>
                  {itemView.showRemove ? (
                    <button
                      className={itemView.removeClassName}
                      type="button"
                      aria-label={itemView.removeAriaLabel}
                      title={itemView.removeTitle}
                      onClick={() => removeRecentRepository(itemView.repository)}
                    >
                      {itemView.confirmRemove ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </DropdownMenuHost>
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
