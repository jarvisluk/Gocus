import type { ReactNode } from "react";
import { iconButtonView } from "../lib/iconButtonView";

export function IconButton({
  label,
  onClick,
  children,
  active,
  busy,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const view = iconButtonView({ active, busy, label });

  return (
    <button
      className={view.className}
      type="button"
      aria-label={view.ariaLabel}
      aria-busy={view.ariaBusy}
      aria-pressed={view.ariaPressed}
      title={view.title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
