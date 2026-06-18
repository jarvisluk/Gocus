import { useRef, type ReactNode, type RefObject } from "react";
import { useDismissableLayer, type DismissableLayerDismissTiming } from "../lib/useDismissableLayer";

export function DropdownMenuHost({
  active,
  children,
  className,
  dismissTiming = "afterTargetAction",
  hostRef,
  onDismiss,
}: {
  active: boolean;
  children: ReactNode;
  className: string;
  dismissTiming?: DismissableLayerDismissTiming;
  hostRef?: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = hostRef ?? internalRef;

  useDismissableLayer({
    active,
    dismissTiming,
    refs: [resolvedRef],
    onDismiss,
  });

  return (
    <div className={className} ref={resolvedRef}>
      {children}
    </div>
  );
}
