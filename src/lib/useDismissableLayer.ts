import { useEffect, type RefObject } from "react";

type DismissableLayerRef = RefObject<Element | null>;
type DismissableLayerDismissEvent = "pointerdown" | "click";
export type DismissableLayerDismissTiming = "beforeTargetAction" | "afterTargetAction";

let activeDismissableLayerCount = 0;

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

export function dismissableLayerConsumesOutsideInteraction(timing: DismissableLayerDismissTiming) {
  return timing === "beforeTargetAction";
}

export function dismissableLayerTargetsOverlap(first: EventTarget | null, second: EventTarget | null) {
  if (first === second) return true;
  if (!isNodeTarget(first) || !isNodeTarget(second)) return false;
  const firstContains = typeof first.contains === "function" && first.contains(second);
  const secondContains = typeof second.contains === "function" && second.contains(first);
  return firstContains || secondContains;
}

function consumeEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function suppressNextDocumentClick(pointerTarget: EventTarget | null) {
  const controller = new AbortController();

  function handleSuppressedClick(event: MouseEvent) {
    if (dismissableLayerTargetsOverlap(pointerTarget, event.target)) consumeEvent(event);
    controller.abort();
  }

  document.addEventListener("click", handleSuppressedClick, {
    capture: true,
    once: true,
    signal: controller.signal,
  });
  window.setTimeout(() => controller.abort(), 1000);
}

function useDismissableLayerDocumentState(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;

    activeDismissableLayerCount += 1;
    document.documentElement.dataset.dismissableLayerOpen = "true";

    return () => {
      activeDismissableLayerCount = Math.max(0, activeDismissableLayerCount - 1);
      if (activeDismissableLayerCount === 0) delete document.documentElement.dataset.dismissableLayerOpen;
    };
  }, [active]);
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
  useDismissableLayerDocumentState(active);

  useEffect(() => {
    if (!active) return undefined;
    const dismissEvent = dismissableLayerEventForTiming(dismissTiming);
    const consumeOutsideInteraction = dismissableLayerConsumesOutsideInteraction(dismissTiming);

    function handleDismissEvent(event: PointerEvent | MouseEvent) {
      if (!dismissableLayerShouldDismissPointer(refs, event.target)) return;
      if (consumeOutsideInteraction) {
        consumeEvent(event);
        suppressNextDocumentClick(event.target);
      }
      onDismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (dismissableLayerShouldDismissKey(event.key)) onDismiss();
    }

    document.addEventListener(dismissEvent, handleDismissEvent, consumeOutsideInteraction);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(dismissEvent, handleDismissEvent, consumeOutsideInteraction);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, dismissTiming, refs, onDismiss]);
}
