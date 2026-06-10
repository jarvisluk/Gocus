export function politeStatusView<T extends object>(view: T) {
  return {
    ...view,
    role: "status" as const,
    ariaLive: "polite" as const,
  };
}
