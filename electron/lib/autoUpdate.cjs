const defaultUpdateRepository = "jarvisluk/gocus";
const defaultUpdateServer = "https://update.electronjs.org";
const defaultCheckIntervalMs = 4 * 60 * 60 * 1000;
const defaultStartupDelayMs = 15 * 1000;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function normalizeUpdateRepository(repository) {
  if (repository && typeof repository === "object") return normalizeUpdateRepository(repository.url);
  if (typeof repository !== "string") return "";

  const trimmed = repository.trim();
  if (!trimmed) return "";

  const shorthandMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthandMatch) return `${shorthandMatch[1]}/${shorthandMatch[2]}`;

  const sshMatch = trimmed.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

  const normalizedUrl = trimmed.replace(/^git\+/, "").replace(/\.git$/, "");
  try {
    const url = new URL(normalizedUrl);
    if (url.hostname !== "github.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return "";
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return "";
  }
}

function updateRepositoryFromPackage(packageMetadata = {}) {
  return normalizeUpdateRepository(
    process.env.GOCUS_UPDATE_REPO ||
      packageMetadata.updateRepository ||
      packageMetadata.repository ||
      defaultUpdateRepository,
  );
}

function buildUpdateFeedUrl({
  repository = defaultUpdateRepository,
  platform = process.platform,
  arch = process.arch,
  version,
  server = process.env.GOCUS_UPDATE_SERVER || defaultUpdateServer,
} = {}) {
  const normalizedRepository = normalizeUpdateRepository(repository);
  if (!normalizedRepository || !platform || !arch || !version || !server) return "";

  const [owner, repo] = normalizedRepository.split("/");
  return [
    trimTrailingSlash(server),
    encodeURIComponent(owner),
    encodeURIComponent(repo),
    `${encodeURIComponent(platform)}-${encodeURIComponent(arch)}`,
    encodeURIComponent(version),
  ].join("/");
}

function autoUpdateSupportReason({ platform = process.platform, isPackaged, isDevRuntime, repository } = {}) {
  if (platform !== "darwin") return "unsupported_platform";
  if (isDevRuntime) return "dev_runtime";
  if (!isPackaged) return "unpackaged";
  if (!normalizeUpdateRepository(repository)) return "missing_repository";
  return "";
}

function createAutoUpdateController({
  app,
  autoUpdater,
  dialog,
  logger = console,
  packageMetadata = {},
  isDevRuntime = false,
  platform = process.platform,
  arch = process.arch,
  checkIntervalMs = defaultCheckIntervalMs,
  startupDelayMs = defaultStartupDelayMs,
  prepareForInstall = () => {},
  initialPreferences = {},
} = {}) {
  const updateRepository = updateRepositoryFromPackage(packageMetadata);
  let initialized = false;
  let checking = false;
  let manualCheckPending = false;
  let updateTimer = null;
  let feedUrl = "";
  let preferences = initialPreferences && typeof initialPreferences === "object" ? initialPreferences : {};

  function supportReason() {
    return autoUpdateSupportReason({
      platform,
      isPackaged: Boolean(app?.isPackaged),
      isDevRuntime,
      repository: updateRepository,
    });
  }

  function isSupported() {
    return supportReason() === "";
  }

  function manualDialogOptions(message, detail = "") {
    return {
      type: "info",
      buttons: ["OK"],
      defaultId: 0,
      message,
      detail,
    };
  }

  function showManualMessage(message, detail = "") {
    if (!dialog || typeof dialog.showMessageBox !== "function") return Promise.resolve({ response: 0 });
    return dialog.showMessageBox(manualDialogOptions(message, detail));
  }

  function shouldCheckAutomatically() {
    return preferences.autoUpdateChecks !== false;
  }

  function shouldInstallAutomatically() {
    return preferences.autoUpdateInstall === true;
  }

  function installUpdate() {
    prepareForInstall();
    autoUpdater.quitAndInstall();
  }

  function initialize() {
    if (initialized) return isSupported();
    if (!isSupported()) return false;

    feedUrl = buildUpdateFeedUrl({
      repository: updateRepository,
      platform,
      arch,
      version: app.getVersion(),
    });

    autoUpdater.setFeedURL({ url: feedUrl });
    autoUpdater.on("checking-for-update", () => {
      checking = true;
    });
    autoUpdater.on("update-available", () => {
      logger.info("[Gocus] Update available.");
    });
    autoUpdater.on("update-not-available", () => {
      checking = false;
      if (manualCheckPending) {
        showManualMessage("Gocus is up to date.", `Current version: ${app.getVersion()}`);
      }
      manualCheckPending = false;
    });
    autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
      checking = false;
      const versionLabel = releaseName || "the latest version";
      if (shouldInstallAutomatically()) {
        installUpdate();
        manualCheckPending = false;
        return;
      }
      if (!dialog || typeof dialog.showMessageBox !== "function") {
        logger.info("[Gocus] Update downloaded, but the install prompt is unavailable.");
        manualCheckPending = false;
        return;
      }

      dialog
        .showMessageBox({
          type: "info",
          buttons: ["Install and Relaunch", "Later"],
          defaultId: 0,
          cancelId: 1,
          message: `${versionLabel} is ready to install.`,
          detail: releaseNotes ? String(releaseNotes) : "Gocus will relaunch after installing the update.",
        })
        .then((result) => {
          if (result.response !== 0) return;
          installUpdate();
        })
        .catch((error) => logger.warn("[Gocus] Unable to show update install prompt.", error));
      manualCheckPending = false;
    });
    autoUpdater.on("error", (error) => {
      checking = false;
      if (manualCheckPending) {
        showManualMessage("Unable to check for updates.", error?.message || "GitHub Release update feed is unavailable.");
      } else {
        logger.warn("[Gocus] Auto-update check failed.", error);
      }
      manualCheckPending = false;
    });

    initialized = true;
    return true;
  }

  function checkForUpdates({ manual = false } = {}) {
    if (!initialize()) {
      if (manual) {
        showManualMessage(
          "Updates are unavailable in this build.",
          "Gocus can check GitHub Releases only from a packaged macOS app.",
        );
      }
      return false;
    }

    if (checking) {
      if (manual) showManualMessage("Gocus is already checking for updates.");
      return false;
    }

    manualCheckPending = Boolean(manual);
    checking = true;
    try {
      autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      checking = false;
      if (manual) {
        showManualMessage("Unable to check for updates.", error?.message || "GitHub Release update feed is unavailable.");
      } else {
        logger.warn("[Gocus] Auto-update check failed.", error);
      }
      manualCheckPending = false;
      return false;
    }
  }

  function start() {
    if (!shouldCheckAutomatically()) {
      stop();
      return false;
    }
    if (!initialize()) return false;
    if (updateTimer) clearTimeout(updateTimer);

    updateTimer = setTimeout(() => {
      checkForUpdates();
      updateTimer = setInterval(() => checkForUpdates(), checkIntervalMs);
    }, startupDelayMs);
    return true;
  }

  function stop() {
    if (!updateTimer) return;
    clearTimeout(updateTimer);
    clearInterval(updateTimer);
    updateTimer = null;
  }

  function setPreferences(nextPreferences = {}) {
    preferences = nextPreferences && typeof nextPreferences === "object" ? nextPreferences : {};
  }

  return {
    checkForUpdates,
    feedUrl: () => feedUrl,
    isChecking: () => checking,
    isStarted: () => Boolean(updateTimer),
    isSupported,
    setPreferences,
    start,
    stop,
    supportReason,
    updateRepository: () => updateRepository,
  };
}

module.exports = {
  autoUpdateSupportReason,
  buildUpdateFeedUrl,
  createAutoUpdateController,
  defaultCheckIntervalMs,
  defaultStartupDelayMs,
  defaultUpdateRepository,
  defaultUpdateServer,
  normalizeUpdateRepository,
  updateRepositoryFromPackage,
};
