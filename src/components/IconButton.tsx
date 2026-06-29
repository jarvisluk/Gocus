import type { ReactNode } from "react";
import { joinClass } from "../lib/classNames";
import { iconButtonView } from "../lib/iconButtonView";

export function IconButton({
  label,
  onClick,
  children,
  className,
  active,
  busy,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const view = iconButtonView({ active, busy, label });

  return (
    <button
      className={joinClass(view.className, className)}
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
