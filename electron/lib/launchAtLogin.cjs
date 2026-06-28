function createLaunchAtLoginController(app, hiddenLaunchArg, options = {}) {
  const platform = options.platform ?? process.platform;
  const execPath = options.execPath ?? process.execPath;
  const argv = options.argv ?? process.argv;

  function windowsLoginItemArgs() {
    return app.isPackaged ? [hiddenLaunchArg] : [app.getAppPath(), hiddenLaunchArg];
  }

  function loginItemSettings(openAtLogin) {
    const settings = { openAtLogin };
    if (platform === "darwin") settings.openAsHidden = openAtLogin;
    if (platform === "win32") {
      if (!app.isPackaged) settings.path = execPath;
      settings.args = windowsLoginItemArgs();
    }
    return settings;
  }

  function loginItemMatchOptions() {
    if (platform !== "win32") return {};
    const matchOptions = { args: windowsLoginItemArgs() };
    if (!app.isPackaged) matchOptions.path = execPath;

    return matchOptions;
  }

  function readLaunchAtLoginEnabled(fallback = false) {
    if (platform !== "darwin" && platform !== "win32") return false;

    try {
      return app.getLoginItemSettings(loginItemMatchOptions()).openAtLogin;
    } catch (error) {
      console.warn("[Gocus] Unable to read launch-at-login state.", error);
      return fallback;
    }
  }

  function syncLaunchAtLogin(preferences) {
    if (platform !== "darwin" && platform !== "win32") return;

    try {
      app.setLoginItemSettings(loginItemSettings(Boolean(preferences?.launchAtLogin)));
    } catch (error) {
      console.warn("[Gocus] Unable to update launch-at-login state.", error);
    }
  }

  function shouldStartCollapsedAtLogin(preferences) {
    if (!preferences?.launchAtLogin && !argv.includes(hiddenLaunchArg)) return false;
    if (argv.includes(hiddenLaunchArg)) return true;
    if (platform !== "darwin" && platform !== "win32") return false;

    try {
      const settings = app.getLoginItemSettings(loginItemMatchOptions());
      if (settings.wasOpenedAtLogin || settings.wasOpenedAsHidden) return true;
      if (platform !== "win32") return false;

      const legacySettings = app.getLoginItemSettings();
      return legacySettings.wasOpenedAtLogin || legacySettings.wasOpenedAsHidden;
    } catch {
      return false;
    }
  }

  return {
    readLaunchAtLoginEnabled,
    shouldStartCollapsedAtLogin,
    syncLaunchAtLogin,
  };
}

module.exports = {
  createLaunchAtLoginController,
};
