import { useEffect, type RefObject } from "react";

type DismissableLayerRef = RefObject<Element | null>;

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

export function useDismissableLayer({
  active,
  refs,
  onDismiss,
}: {
  active: boolean;
  refs: ReadonlyArray<DismissableLayerRef>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!active) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!dismissableLayerShouldDismissPointer(refs, event.target)) return;
      onDismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (dismissableLayerShouldDismissKey(event.key)) onDismiss();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, refs, onDismiss]);
}
