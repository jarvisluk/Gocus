export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function logBridgeWarning(context: string, error: unknown) {
  console.warn(`[Git Peek] ${context}`, errorMessage(error, context));
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value && typeof (value as { then?: unknown }).then === "function");
}

export function runBridgeSideEffect(context: string, request: () => Promise<unknown> | void | undefined) {
  try {
    const result = request();
    if (isPromiseLike(result)) {
      Promise.resolve(result).catch((error) => logBridgeWarning(context, error));
    }
  } catch (error) {
    logBridgeWarning(context, error);
  }
}
