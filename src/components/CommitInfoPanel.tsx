import { Clock3, GitBranch, Hash, UserCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { commitHoverPanelView } from "../lib/commitRowView";
import type { CommitItem } from "../types";

export function CommitInfoPanel({ commit }: { commit: CommitItem }) {
  const view = commitHoverPanelView(commit);

  return (
    <aside className={view.panel.className} role={view.panel.role} aria-label={view.panel.ariaLabel}>
      <div className={view.bodyClassName}>
        <div className={view.primarySectionClassName}>
          <div className={view.headerClassName}>
            <UserCircle aria-hidden="true" />
            <span className={view.authorClassName}>{view.author}</span>
            {view.showTime ? (
              <>
                <Clock3 aria-hidden="true" />
                <span className={view.timeClassName}>{view.timeLabel}</span>
              </>
            ) : null}
          </div>
          <p className={view.titleClassName}>{view.message}</p>
        </div>
        <div className={view.statsSectionClassName}>
          <div className={view.statsClassName}>
            <span>{view.filesChangedLabel}</span>
            <span className="additions">, {view.insertionsLabel}</span>
            <span className="deletions">, {view.deletionsLabel}</span>
          </div>
        </div>
        {view.showRefs ? (
          <div className={view.refsSectionClassName}>
            <div className={view.refsClassName}>
              {view.refs.map((ref) => (
                <span
                  key={ref.key}
                  className={view.refPillClassName}
                  style={{ "--branch-color": ref.color } as CSSProperties}
                  title={ref.label}
                >
                  <GitBranch aria-hidden="true" />
                  <span>{ref.label}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className={view.hashSectionClassName}>
          <div className={view.hashClassName}>
            <Hash aria-hidden="true" />
            <code>{view.hash}</code>
          </div>
        </div>
      </div>
    </aside>
  );
}
