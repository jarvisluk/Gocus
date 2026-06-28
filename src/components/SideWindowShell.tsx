import { useEffect, useRef, type ReactNode } from "react";
import { logBridgeWarning } from "../lib/errorMessages";

type SideWindowEmptyState = {
  className: string;
  ariaLabel: string;
  role: "status";
  ariaLive: "polite";
  message: string;
};

type SideWindowShellProps = {
  viewportClassName: string;
  panelClassName: string;
  panelAriaLabel?: string;
  panelAriaLabelledBy?: string;
  children?: ReactNode;
  emptyState?: SideWindowEmptyState;
  onPanelHeightChange?: (height: number) => Promise<unknown> | void;
  resizeWarning?: string;
};

export function SideWindowShell({
  viewportClassName,
  panelClassName,
  panelAriaLabel,
  panelAriaLabelledBy,
  children,
  emptyState,
  onPanelHeightChange,
  resizeWarning = "Unable to resize side window.",
}: SideWindowShellProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const reportedHeightRef = useRef<number | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !onPanelHeightChange) return undefined;

    let frameId: number | null = null;
    const reportHeight = () => {
      frameId = null;
      const rectHeight = panel.getBoundingClientRect().height;
      const nextHeight = Math.ceil(Math.max(panel.scrollHeight, rectHeight));
      if (nextHeight <= 0 || nextHeight === reportedHeightRef.current) return;

      reportedHeightRef.current = nextHeight;
      void Promise.resolve(onPanelHeightChange(nextHeight)).catch((error) => logBridgeWarning(resizeWarning, error));
    };
    const scheduleReportHeight = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(reportHeight);
    };

    scheduleReportHeight();
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleReportHeight) : null;
    const mutationObserver = typeof MutationObserver === "function" ? new MutationObserver(scheduleReportHeight) : null;
    resizeObserver?.observe(panel);
    mutationObserver?.observe(panel, { attributes: true, childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", scheduleReportHeight);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleReportHeight);
    };
  }, [onPanelHeightChange, resizeWarning]);

  return (
    <main className={viewportClassName}>
      {children ? (
        <section ref={panelRef} className={panelClassName} aria-label={panelAriaLabel} aria-labelledby={panelAriaLabelledBy}>
          {children}
        </section>
      ) : emptyState ? (
        <section className={emptyState.className} aria-label={emptyState.ariaLabel} role={emptyState.role} aria-live={emptyState.ariaLive}>
          {emptyState.message}
        </section>
      ) : null}
    </main>
  );
}
