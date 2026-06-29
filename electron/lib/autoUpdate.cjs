const defaultUpdateRepository = "jarvisluk/gocus";
const defaultUpdateServer = "https://update.electronjs.org";
const defaultUpdateChannel = "stable";
const defaultChannelSwitchVersion = "0.0.0";
const updateChannelValues = ["stable", "develop"];
const defaultCheckIntervalMs = 4 * 60 * 60 * 1000;
const defaultStartupDelayMs = 15 * 1000;
const windowsPortableUnsupportedDetail =
  "Windows portable builds do not support automatic updates. " +
  "Install Gocus with the Windows Setup package to receive automatic updates.";

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

function normalizeUpdateChannel(channel, fallback = defaultUpdateChannel) {
  const normalized = typeof channel === "string" ? channel.trim().toLowerCase() : "";
  return updateChannelValues.includes(normalized) ? normalized : fallback;
}

function normalizeConfiguredUpdateChannel(channel) {
  return normalizeUpdateChannel(channel, "");
}

function readUpdateChannelMap(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizedUpdateChannelMap(value) {
  const channels = {};
  const source = readUpdateChannelMap(value);

  for (const [channel, repository] of Object.entries(source)) {
    const normalizedChannel = normalizeConfiguredUpdateChannel(channel);
    const normalizedRepository = normalizeUpdateRepository(repository);
    if (normalizedChannel && normalizedRepository) channels[normalizedChannel] = normalizedRepository;
  }

  return channels;
}

function updateRepositoryFromPackage(packageMetadata = {}) {
  return normalizeUpdateRepository(
    process.env.GOCUS_UPDATE_REPO ||
      packageMetadata.updateRepository ||
      packageMetadata.repository ||
      defaultUpdateRepository,
  );
}

function updateChannelFromPackage(packageMetadata = {}) {
  return normalizeUpdateChannel(process.env.GOCUS_UPDATE_CHANNEL || packageMetadata.updateChannel || defaultUpdateChannel);
}

function updateChannelsFromPackage(packageMetadata = {}) {
  const channels = {
    stable: normalizeUpdateRepository(packageMetadata.updateRepository || packageMetadata.repository || defaultUpdateRepository),
  };

  Object.assign(channels, normalizedUpdateChannelMap(packageMetadata.updateChannels));
  Object.assign(channels, normalizedUpdateChannelMap(process.env.GOCUS_UPDATE_CHANNELS));

  const stableRepository = normalizeUpdateRepository(process.env.GOCUS_UPDATE_STABLE_REPO || process.env.GOCUS_UPDATE_REPO);
  if (stableRepository) channels.stable = stableRepository;

  const developRepository = normalizeUpdateRepository(process.env.GOCUS_UPDATE_DEVELOP_REPO);
  if (developRepository) channels.develop = developRepository;

  return channels;
}

function updateRepositoryForChannel(packageMetadata = {}, channel = defaultUpdateChannel) {
  return updateChannelsFromPackage(packageMetadata)[normalizeUpdateChannel(channel)] || "";
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

function buildWindowsUpdateFeedConfig({ repository = defaultUpdateRepository } = {}) {
  const normalizedRepository = normalizeUpdateRepository(repository);
  if (!normalizedRepository) return null;

  const [owner, repo] = normalizedRepository.split("/");
  return {
    provider: "github",
    owner,
    repo,
  };
}

function buildUpdateFeedConfig({
  repository = defaultUpdateRepository,
  platform = process.platform,
  arch = process.arch,
  version,
  server = process.env.GOCUS_UPDATE_SERVER || defaultUpdateServer,
} = {}) {
  if (platform === "win32") return buildWindowsUpdateFeedConfig({ repository });

  const url = buildUpdateFeedUrl({
    repository,
    platform,
    arch,
    version,
    server,
  });
  return url ? { url } : null;
}

function releaseUrlForRepository(repository = defaultUpdateRepository) {
  const normalizedRepository = normalizeUpdateRepository(repository);
  if (!normalizedRepository) return "";

  const [owner, repo] = normalizedRepository.split("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
}

function autoUpdateSupportReason({
  platform = process.platform,
  isPackaged,
  isDevRuntime,
  isPortableRuntime,
  repository,
  hasAutoUpdater = true,
} = {}) {
  if (isDevRuntime) return "dev_runtime";
  if (!isPackaged) return "unpackaged";
  if (!normalizeUpdateRepository(repository)) return "missing_repository";
  if (platform !== "darwin" && platform !== "win32") return "unsupported_platform";
  if (!hasAutoUpdater) return "missing_updater";
  if (platform === "win32" && isPortableRuntime) return "portable";
  return "";
}

function createAutoUpdateController({
  app,
  autoUpdater,
  dialog,
  logger = console,
  packageMetadata = {},
  isDevRuntime = false,
  isPortableRuntime = false,
  platform = process.platform,
  arch = process.arch,
  checkIntervalMs = defaultCheckIntervalMs,
  startupDelayMs = defaultStartupDelayMs,
  prepareForInstall = () => {},
  initialPreferences = {},
} = {}) {
  const defaultChannel = updateChannelFromPackage(packageMetadata);
  const updateChannels = updateChannelsFromPackage(packageMetadata);
  let initialized = false;
  let checking = false;
  let manualCheckPending = false;
  let updateTimer = null;
  let feedUrl = "";
  let feedConfigKey = "";
  let preferences = initialPreferences && typeof initialPreferences === "object" ? initialPreferences : {};

  function updateChannel() {
    return normalizeUpdateChannel(preferences.autoUpdateChannel, defaultChannel);
  }

  function updateRepository() {
    return updateChannels[updateChannel()] || "";
  }

  function isSwitchingChannels() {
    return updateChannel() !== defaultChannel;
  }

  function updateFeedVersion() {
    return isSwitchingChannels() ? defaultChannelSwitchVersion : app.getVersion();
  }

  function supportReason() {
    return autoUpdateSupportReason({
      platform,
      isPackaged: Boolean(app?.isPackaged),
      isDevRuntime,
      isPortableRuntime,
      repository: updateRepository(),
      hasAutoUpdater: Boolean(autoUpdater),
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

  function syncUpdaterOptions() {
    if (!autoUpdater) return;
    if (platform === "win32" && "allowDowngrade" in autoUpdater) {
      autoUpdater.allowDowngrade = isSwitchingChannels();
    }
  }

  function configureFeed() {
    if (!isSupported()) {
      feedUrl = "";
      feedConfigKey = "";
      return false;
    }

    const nextFeedConfig = buildUpdateFeedConfig({
      repository: updateRepository(),
      platform,
      arch,
      version: updateFeedVersion(),
    });
    if (!nextFeedConfig) {
      feedUrl = "";
      feedConfigKey = "";
      return false;
    }

    syncUpdaterOptions();
    const nextFeedConfigKey = JSON.stringify(nextFeedConfig);
    if (feedConfigKey !== nextFeedConfigKey) {
      autoUpdater.setFeedURL(nextFeedConfig);
      feedConfigKey = nextFeedConfigKey;
      feedUrl = nextFeedConfig.url || releaseUrlForRepository(updateRepository());
    }

    return true;
  }

  function normalizeDownloadedUpdate(args) {
    if (platform === "win32") {
      const info = args.find((value) => value && typeof value === "object" && !("sender" in value)) || {};
      return {
        releaseName: info.releaseName || (info.version ? `Gocus ${info.version}` : ""),
        releaseNotes: info.releaseNotes || "",
      };
    }

    return {
      releaseNotes: args[1],
      releaseName: args[2],
    };
  }

  function handleCheckError(error, manual = manualCheckPending) {
    checking = false;
    if (manual) {
      showManualMessage("Unable to check for updates.", error?.message || "GitHub Release update feed is unavailable.");
    } else {
      logger.warn("[Gocus] Auto-update check failed.", error);
    }
    manualCheckPending = false;
  }

  function initialize() {
    if (!configureFeed()) return false;
    if (initialized) return true;

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
    autoUpdater.on("update-downloaded", (...args) => {
      checking = false;
      const { releaseNotes, releaseName } = normalizeDownloadedUpdate(args);
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
      handleCheckError(error);
    });

    initialized = true;
    return true;
  }

  function manualUnsupportedDetail() {
    const reason = supportReason();
    if (reason === "missing_repository") {
      return `The ${updateChannel()} update channel has no GitHub Releases feed configured for this build.`;
    }
    if (reason === "missing_updater") return "Windows automatic updates require the installer build.";
    if (reason === "portable") return windowsPortableUnsupportedDetail;
    if (platform === "win32") return "Windows automatic updates require the installer build.";
    return "Gocus can check GitHub Releases only from a packaged macOS or Windows installer build.";
  }

  function checkForUpdates({ manual = false } = {}) {
    if (!initialize()) {
      if (manual) {
        showManualMessage(
          "Updates are unavailable in this build.",
          manualUnsupportedDetail(),
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
      const result = autoUpdater.checkForUpdates();
      if (result && typeof result.catch === "function") {
        result.catch((error) => handleCheckError(error, Boolean(manual)));
      }
      return true;
    } catch (error) {
      handleCheckError(error, Boolean(manual));
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
    if (initialized && !checking) configureFeed();
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
    updateFeedVersion,
    updateChannel,
    updateChannels: () => ({ ...updateChannels }),
    updateRepository,
  };
}

module.exports = {
  autoUpdateSupportReason,
  buildUpdateFeedConfig,
  buildUpdateFeedUrl,
  buildWindowsUpdateFeedConfig,
  createAutoUpdateController,
  defaultCheckIntervalMs,
  defaultChannelSwitchVersion,
  defaultStartupDelayMs,
  defaultUpdateChannel,
  defaultUpdateRepository,
  defaultUpdateServer,
  normalizeUpdateRepository,
  normalizeUpdateChannel,
  releaseUrlForRepository,
  updateChannelFromPackage,
  updateChannelsFromPackage,
  updateRepositoryForChannel,
  updateRepositoryFromPackage,
};
