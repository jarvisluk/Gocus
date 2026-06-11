import { FolderOpen, GitBranch, PanelRightClose } from "lucide-react";
import type { CSSProperties } from "react";
import {
  collapsedRailBranchSlotHeight,
  collapsedRailHeightForLabel,
  collapsedRailView,
  type CollapsedRailRepositoryIcon,
} from "../lib/collapsedRailView";
import type { GitSnapshot } from "../types";

function collapsedRailRepositoryIcon(icon: CollapsedRailRepositoryIcon) {
  return icon === "branch" ? <GitBranch aria-hidden="true" /> : <FolderOpen aria-hidden="true" />;
}

export function CollapsedRail({
  snapshot,
  changedNowOpen,
  onExpand,
  onOpenChangedNow,
  onDock,
}: {
  snapshot: GitSnapshot | null;
  changedNowOpen: boolean;
  onExpand: () => void;
  onOpenChangedNow: () => void;
  onDock: () => void;
}) {
  const view = collapsedRailView(snapshot, changedNowOpen);
  const railStyle = {
    "--collapsed-rail-height": `${collapsedRailHeightForLabel(view.branch.label)}px`,
    "--collapsed-rail-branch-slot-height": `${collapsedRailBranchSlotHeight(view.branch.label)}px`,
    ...(view.branch.color ? { "--branch-color": view.branch.color } : {}),
  } as CSSProperties;

  function openChangedNow() {
    onOpenChangedNow();
  }

  return (
    <aside className={view.className} aria-label={view.ariaLabel} title={view.title} style={railStyle} onDoubleClick={onDock}>
      <button className={view.expandButton.className} type="button" aria-label={view.expandButton.ariaLabel} onClick={onExpand}>
        <PanelRightClose aria-hidden="true" />
      </button>
      <div className={view.branch.className} title={view.branch.title} aria-label={view.branch.ariaLabel}>
        {collapsedRailRepositoryIcon(view.branch.icon)}
        <span>{view.branch.label}</span>
      </div>
      {view.showChangedNowButton ? (
        <button
          className={view.changedNowButton.className}
          type="button"
          aria-label={view.changedNowButton.ariaLabel}
          aria-pressed={view.changedNowButton.ariaPressed}
          title={view.changedNowButton.title}
          onClick={openChangedNow}
        >
          {view.dirtyCount}
        </button>
      ) : null}
    </aside>
  );
}
