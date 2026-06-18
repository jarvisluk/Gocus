function createLaunchAtLoginController(app, hiddenLaunchArg) {
  function loginItemSettings(openAtLogin) {
    const settings = { openAtLogin };
    if (process.platform === "darwin") settings.openAsHidden = openAtLogin;
    if (process.platform === "win32" && !app.isPackaged) {
      settings.path = process.execPath;
      settings.args = [app.getAppPath(), hiddenLaunchArg];
    }
    return settings;
  }

  function loginItemMatchOptions() {
    if (process.platform === "win32" && !app.isPackaged) {
      return {
        path: process.execPath,
        args: [app.getAppPath(), hiddenLaunchArg],
      };
    }

    return {};
  }

  function readLaunchAtLoginEnabled(fallback = false) {
    if (process.platform !== "darwin" && process.platform !== "win32") return false;

    try {
      return app.getLoginItemSettings(loginItemMatchOptions()).openAtLogin;
    } catch (error) {
      console.warn("[Gocus] Unable to read launch-at-login state.", error);
      return fallback;
    }
  }

  function syncLaunchAtLogin(preferences) {
    if (process.platform !== "darwin" && process.platform !== "win32") return;

    try {
      app.setLoginItemSettings(loginItemSettings(Boolean(preferences?.launchAtLogin)));
    } catch (error) {
      console.warn("[Gocus] Unable to update launch-at-login state.", error);
    }
  }

  function shouldStartInMenuBar(preferences) {
    if (!preferences?.launchAtLogin && !process.argv.includes(hiddenLaunchArg)) return false;
    if (process.argv.includes(hiddenLaunchArg)) return true;
    if (process.platform !== "darwin") return false;

    try {
      const settings = app.getLoginItemSettings();
      return settings.wasOpenedAtLogin || settings.wasOpenedAsHidden;
    } catch {
      return false;
    }
  }

  return {
    readLaunchAtLoginEnabled,
    shouldStartInMenuBar,
    syncLaunchAtLogin,
  };
}

module.exports = {
  createLaunchAtLoginController,
};
