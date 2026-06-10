const ignorableOutputErrorCodes = new Set(["EIO", "EPIPE", "ERR_STREAM_DESTROYED"]);

function isIgnorableOutputError(error) {
  return Boolean(error && ignorableOutputErrorCodes.has(error.code));
}

function ignoreBrokenOutputStream(error) {
  if (isIgnorableOutputError(error)) return;
}

function handleUncaughtOutputError(error) {
  if (isIgnorableOutputError(error)) return;
  process.removeListener("uncaughtException", handleUncaughtOutputError);
  throw error;
}

function installOutputErrorGuard() {
  for (const method of ["debug", "log", "info", "warn", "error"]) {
    if (typeof console[method] !== "function") continue;
    const original = console[method].bind(console);
    console[method] = (...args) => {
      try {
        original(...args);
      } catch (error) {
        if (!isIgnorableOutputError(error)) throw error;
      }
    };
  }

  for (const stream of [process.stdout, process.stderr]) {
    if (stream && typeof stream.on === "function") {
      stream.on("error", ignoreBrokenOutputStream);
    }
  }

  process.on("uncaughtException", handleUncaughtOutputError);
}

module.exports = {
  installOutputErrorGuard,
  isIgnorableOutputError,
};
