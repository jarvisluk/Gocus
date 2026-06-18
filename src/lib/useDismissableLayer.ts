import { useEffect, type RefObject } from "react";

type DismissableLayerRef = RefObject<Element | null>;
type DismissableLayerDismissEvent = "pointerdown" | "click";
export type DismissableLayerDismissTiming = "beforeTargetAction" | "afterTargetAction";

function isNodeTarget(target: EventTarget | null): target is Node {
  return Boolean(target && typeof (target as Node).nodeType === "number");
}

export function dismissableLayerContainsTarget(refs: ReadonlyArray<DismissableLayerRef>, target: EventTarget | null) {
  if (!isNodeTarget(target)) return false;
  return refs.some((ref) => ref.current?.contains(target) === true);
}

export function dismissableLayerShouldDismissPointer(refs: ReadonlyArray<DismissableLayerRef>, target: EventTarget | null) {
  return !dismissableLayerContainsTarget(refs, target);
}

export function dismissableLayerShouldDismissKey(key: string) {
  return key === "Escape";
}

export function dismissableLayerEventForTiming(timing: DismissableLayerDismissTiming): DismissableLayerDismissEvent {
  return timing === "afterTargetAction" ? "click" : "pointerdown";
}

export function useDismissableLayer({
  active,
  dismissTiming = "beforeTargetAction",
  refs,
  onDismiss,
}: {
  active: boolean;
  dismissTiming?: DismissableLayerDismissTiming;
  refs: ReadonlyArray<DismissableLayerRef>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!active) return undefined;
    const dismissEvent = dismissableLayerEventForTiming(dismissTiming);

    function handleDismissEvent(event: PointerEvent | MouseEvent) {
      if (!dismissableLayerShouldDismissPointer(refs, event.target)) return;
      onDismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (dismissableLayerShouldDismissKey(event.key)) onDismiss();
    }

    document.addEventListener(dismissEvent, handleDismissEvent);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(dismissEvent, handleDismissEvent);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, dismissTiming, refs, onDismiss]);
}
