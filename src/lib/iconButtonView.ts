import { joinClass } from "./classNames";

export function iconButtonView({ active, busy, label }: { active?: boolean; busy?: boolean; label: string }) {
  return {
    className: joinClass("icon-button", active && "is-active"),
    ariaLabel: label,
    ariaBusy: busy || undefined,
    ariaPressed: active,
    title: label,
  };
}
