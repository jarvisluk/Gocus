import { Check, Clock3, Copy, GitBranch, GitFork, Hash, UserCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { commitHoverPanelView } from "../lib/commitRowView";
import { copyTextWithFallback } from "../lib/copyText";
import { logBridgeWarning } from "../lib/errorMessages";
import type { CommitItem } from "../types";

type CopyHashState = "idle" | "copied" | "failed";

const copyHashStateResetDelayMs = 1400;

function commitInfoRefIcon(icon: "branch" | "worktree") {
  if (icon === "worktree") return <GitFork aria-hidden="true" />;
  return <GitBranch aria-hidden="true" />;
}

function commitHashCopyLabel(state: CopyHashState) {
  if (state === "copied") return "Copied commit hash";
  if (state === "failed") return "Copy failed";
  return "Copy commit hash";
}

function commitHashCopyIcon(state: CopyHashState) {
  if (state === "copied") return <Check aria-hidden="true" />;
  if (state === "failed") return <X aria-hidden="true" />;
  return <Copy aria-hidden="true" />;
}

export function CommitInfoPanel({ commit }: { commit: CommitItem }) {
  const [copyHashState, setCopyHashState] = useState<CopyHashState>("idle");
  const copyHashResetTimerRef = useRef<number | null>(null);
  const view = commitHoverPanelView(commit);
  const copyHashLabel = commitHashCopyLabel(copyHashState);

  useEffect(
    () => () => {
      if (copyHashResetTimerRef.current !== null) window.clearTimeout(copyHashResetTimerRef.current);
    },
    [],
  );

  function setTemporaryCopyHashState(nextState: CopyHashState) {
    if (copyHashResetTimerRef.current !== null) window.clearTimeout(copyHashResetTimerRef.current);
    setCopyHashState(nextState);
    copyHashResetTimerRef.current = window.setTimeout(() => {
      setCopyHashState("idle");
      copyHashResetTimerRef.current = null;
    }, copyHashStateResetDelayMs);
  }

  async function copyCommitHash() {
    try {
      await copyTextWithFallback(view.fullHash, { bridge: window.gitPeek, clipboard: navigator.clipboard });
      setTemporaryCopyHashState("copied");
    } catch (error) {
      logBridgeWarning("Unable to copy commit hash.", error);
      setTemporaryCopyHashState("failed");
    }
  }

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
                  className={[view.refPillClassName, ref.modifierClassName].filter(Boolean).join(" ")}
                  style={{ "--branch-color": ref.color } as CSSProperties}
                  title={ref.title}
                >
                  {commitInfoRefIcon(ref.icon)}
                  <span>{ref.label}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className={view.hashSectionClassName}>
          <div className={view.hashClassName}>
            <Hash aria-hidden="true" />
            <code title={view.fullHash}>{view.hash}</code>
            <button
              className="commit-hover-hash-copy"
              type="button"
              aria-label={copyHashLabel}
              title={copyHashLabel}
              onClick={copyCommitHash}
            >
              {commitHashCopyIcon(copyHashState)}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
