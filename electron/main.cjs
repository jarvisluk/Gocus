const {
  app,
  autoUpdater: electronAutoUpdater,
  BrowserWindow,
  Menu,
  Tray,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
  shell,
} = require("electron");
const path = require("node:path");
const packageMetadata = require("../package.json");
const { createAutoUpdateController, releaseUrlForRepository } = require("./lib/autoUpdate.cjs");
const { createAssetLoader } = require("./lib/assets.cjs");
const { createConfigStore, defaultActiveWorkspaceOpenTarget } = require("./lib/config.cjs");
const { registerIpcHandlers } = require("./lib/ipcHandlers.cjs");
const { createLaunchAtLoginController } = require("./lib/launchAtLogin.cjs");
const { installOutputErrorGuard } = require("./lib/outputGuard.cjs");
const {
  defaultWindowAnimationDurationMs,
  defaultWindowAnimationFrameMs,
  interpolatedWindowBounds,
  windowBoundsAnimationFrameCount,
} = require("./lib/windowAnimation.cjs");
const {
  changedFileInfoBounds,
  changedFileInfoWindowSize,
  clampCommitInfoWindowHeight,
  clampFunctionMenuWindowHeight,
  collapsedSize,
  commitInfoBounds,
  commitInfoWindowSize,
  expandedMaximumSize,
  expandedMinimumSize,
  expandedSizeFromConfig,
  functionMenuBounds,
  functionMenuWindowSize,
  clampCollapsedRailHeight,
  clampExpandedSize,
  mainWindowBounds,
  rightAlignedWindowBounds,
  temporaryInfoBounds,
  temporaryInfoWindowSize,
  windowBoundsEqual,
} = require("./lib/windowGeometry.cjs");
const {
  checkout,
  cleanupWorktree,
  createBranch,
  fetchRemotes,
  initializeRepository,
  isNotGitRepositoryError,
  merge,
  normalizeView,
  openWorktree,
  pullCurrentBranch,
  pushCurrentBranch,
  readFolderWithoutGit,
  readGitSnapshot,
  repositoryRemoteWebUrl,
} = require("./lib/git.cjs");
const { createRepositoryWatcher } = require("./lib/gitWatcher.cjs");
const { getAvailableWorkspaceTargets, openWorkspace, openWorkspaceFile } = require("./lib/workspace.cjs");

installOutputErrorGuard();

const isDevRuntime = Boolean(process.env.GOCUS_DEV_SERVER_URL);
const isWindowsRuntime = process.platform === "win32";
const enableTrayInDev = process.env.GOCUS_ENABLE_TRAY_IN_DEV === "1";

let mainWindow;
let tray;
let currentRepository = null;
let collapsedState = false;
let collapsedWindowSize = { ...collapsedSize };
let pinnedState = false;
let currentView = { mode: "all" };
let applyingWindowBounds = false;
let applyingWindowBoundsTimer = null;
let windowBoundsAnimationTimer = null;
let expandedWindowSizeSaveTimer = null;
let realQuitRequested = false;
let dockIconHidden = false;
let temporaryInfoWindow = null;
let temporaryInfoPayload = null;
let changedFileInfoWindow = null;
let changedFileInfoPayload = null;
let commitInfoWindow = null;
let commitInfoPayload = null;
let functionMenuWindow = null;
let functionMenuPayload = null;
let functionMenuWindowHeight = functionMenuWindowSize.height;
let commitInfoWindowHeight = commitInfoWindowSize.height;
let commitInfoInteractionHoldUntil = 0;
let activeWorkspaceOpenTarget = defaultActiveWorkspaceOpenTarget;
let workspaceOpenMenuActive = false;
let repositoryWatcher = null;
let refreshRepositoryOnNextResume = false;

const hiddenLaunchArg = "--hidden";
const repositoryWatcherDebounceMs = 2500;
const maxRecursiveWorktreeEntries = 15_000;
const config = createConfigStore(app);
activeWorkspaceOpenTarget = config.readActiveWorkspaceOpenTarget();
const launchAtLogin = createLaunchAtLoginController(app, hiddenLaunchArg);
const assets = createAssetLoader({
  nativeImage,
  resourcesPath: process.resourcesPath,
  electronDir: __dirname,
});
const autoUpdates = createAutoUpdateController({
  app,
  autoUpdater: loadPlatformAutoUpdater(),
  dialog,
  isDevRuntime,
  isPortableRuntime: isWindowsPortableRuntime(),
  packageMetadata,
  prepareForInstall: prepareForUpdateInstall,
});

function isWindowsPortableRuntime() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);
}

function loadPlatformAutoUpdater() {
  if (!isWindowsRuntime) return electronAutoUpdater;

  try {
    return require("electron-updater").autoUpdater;
  } catch (error) {
    console.warn("[Gocus] Windows auto-update runtime is unavailable.", error);
    return null;
  }
}

function applyWindowShadow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed() || typeof targetWindow.setHasShadow !== "function") return;
  targetWindow.setHasShadow(true);
}

function windowBackgroundColor() {
  if (!isWindowsRuntime) return "#00000000";
  return nativeTheme.shouldUseDarkColors ? "#1f1f1f" : "#f7f7f7";
}

function framelessWindowOptions() {
  return {
    frame: false,
    transparent: !isWindowsRuntime,
    backgroundColor: windowBackgroundColor(),
    hasShadow: true,
    roundedCorners: true,
    ...(isWindowsRuntime ? { accentColor: false, thickFrame: true } : {}),
  };
}

function loadAppWindowIcon() {
  return assets.loadImageAsset(isWindowsRuntime ? "app-icon.ico" : "app-icon.png");
}

function syncWindowBackgroundColor(targetWindow) {
  if (!isWindowsRuntime || !targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.setBackgroundColor(windowBackgroundColor());
}

function syncWindowBackgroundColors() {
  for (const win of [mainWindow, temporaryInfoWindow, changedFileInfoWindow, commitInfoWindow, functionMenuWindow]) {
    syncWindowBackgroundColor(win);
  }
}

const workspaceOpenMenuOptions = [
  { target: "vscode", label: "VS Code" },
  { target: "cursor", label: "Cursor" },
  { target: "codex", label: "Codex" },
  { target: "antigravity", label: "Antigravity IDE" },
  { target: "antigravityApp", label: "Antigravity" },
  { target: "finder", label: process.platform === "win32" ? "Explorer" : "Finder" },
  { target: "terminal", label: "Terminal" },
  { target: "xcode", label: "Xcode" },
];

function readPreferences() {
  const preferences = config.readPreferences();
  return {
    ...preferences,
    launchAtLogin: launchAtLogin.readLaunchAtLoginEnabled(Boolean(preferences.launchAtLogin)),
  };
}

function syncLaunchAtLogin(preferences = config.readPreferences()) {
  launchAtLogin.syncLaunchAtLogin(preferences);
}

function syncAutoUpdates(preferences = config.readPreferences()) {
  autoUpdates.setPreferences(preferences);
  if (!shouldRunAutoUpdates(preferences)) {
    autoUpdates.stop();
  } else if (!autoUpdates.isStarted()) {
    autoUpdates.start();
  }
}

function shouldRunAutoUpdates(preferences = config.readPreferences()) {
  if (preferences.autoUpdateChecks === false) return false;
  return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !collapsedState);
}

async function openGitHubReleases() {
  const releaseUrl = releaseUrlForRepository(autoUpdates.updateRepository());
  if (!releaseUrl) throw new Error("GitHub Releases URL is unavailable.");
  await shell.openExternal(releaseUrl);
}

async function openRepositoryRemote(repositoryPath) {
  const remoteUrl = await repositoryRemoteWebUrl(repositoryPath);
  await shell.openExternal(remoteUrl);
  return { ok: true, message: "Opened repository remote." };
}

function shouldStartCollapsedAtLogin() {
  return launchAtLogin.shouldStartCollapsedAtLogin(config.readPreferences());
}

function shouldShowMenuBarIcon(preferences = config.readPreferences()) {
  return preferences.showMenuBarIcon !== false;
}

function shouldShowDockIcon(preferences = config.readPreferences()) {
  if (!shouldUseMenuBarResidency(preferences)) return true;
  return preferences.showDockIcon === true;
}

function shouldUseMenuBarResidency(preferences = config.readPreferences()) {
  return (!isDevRuntime || enableTrayInDev) && shouldShowMenuBarIcon(preferences);
}

function hideDockIcon() {
  if (isWindowsRuntime) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setSkipTaskbar(true);
    return;
  }
  if (process.platform !== "darwin" || !app.dock) return;
  app.dock.hide();
  dockIconHidden = true;
}

function showDockIcon() {
  if (isWindowsRuntime) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setSkipTaskbar(false);
    return;
  }
  if (process.platform !== "darwin" || !app.dock) return;
  if (!dockIconHidden) {
    app.dock.setIcon(assets.loadImageAsset("app-icon.png"));
    return;
  }

  app.dock.show();
  app.dock.setIcon(assets.loadImageAsset("app-icon.png"));
  dockIconHidden = false;
}

function softQuitToMenuBar() {
  const preferences = config.readPreferences();
  if (!shouldUseMenuBarResidency(preferences)) {
    requestRealQuit();
    return;
  }

  closeTemporaryInfoWindow();
  closeChangedFileInfoWindow();
  closeCommitInfoWindow();
  closeFunctionMenuWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveCurrentExpandedWindowSize(mainWindow);
    mainWindow.hide();
  }
  syncDockIcon(preferences);
}

function shouldHideToMenuBarOnClose() {
  return !realQuitRequested && shouldUseMenuBarResidency();
}

function requestRealQuit() {
  realQuitRequested = true;
  app.quit();
}

function prepareForUpdateInstall() {
  realQuitRequested = true;
  stopRepositoryWatcher();
}

function stopRepositoryWatcher() {
  if (!repositoryWatcher) return;
  repositoryWatcher.close();
  repositoryWatcher = null;
}

function shouldRunRepositoryWatcher() {
  const preferences = config.readPreferences();
  return Boolean(
    preferences.realtimeGitRefresh !== false &&
      currentRepository &&
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isVisible() &&
      !collapsedState,
  );
}

function syncRepositoryWatcher() {
  if (!shouldRunRepositoryWatcher()) {
    stopRepositoryWatcher();
    return;
  }

  startRepositoryWatcher(currentRepository);
}

function repositoryWatcherOptions() {
  return {
    logger: console,
    debounceMs: repositoryWatcherDebounceMs,
    maxRecursiveWorktreeEntries,
  };
}

function markRepositoryRefreshPending() {
  if (currentRepository) refreshRepositoryOnNextResume = true;
}

function refreshRepositoryAfterResume() {
  if (!refreshRepositoryOnNextResume || !currentRepository || !shouldRunRepositoryWatcher()) return;

  refreshRepositoryOnNextResume = false;
  refreshAndSendSnapshot().catch((error) => console.warn("[Gocus] Unable to refresh Git data after resuming window.", error));
}

function startRepositoryWatcher(repoPath) {
  if (!repoPath) {
    stopRepositoryWatcher();
    return;
  }

  const requestedPath = path.resolve(repoPath);
  if (repositoryWatcher && path.resolve(repositoryWatcher.repositoryPath) === requestedPath) return;

  stopRepositoryWatcher();

  try {
    let nextWatcher = null;
    nextWatcher = createRepositoryWatcher(
      repoPath,
      async () => {
        const activeRepository = repositoryPathForAction();
        if (!activeRepository || !nextWatcher || path.resolve(activeRepository) !== path.resolve(nextWatcher.repositoryPath)) return;
        const response = await getSnapshotResponse();
        const latestRepository = repositoryPathForAction();
        if (!latestRepository || path.resolve(latestRepository) !== path.resolve(nextWatcher.repositoryPath)) return;
        sendSnapshotResponse(response, "refresh");
      },
      repositoryWatcherOptions(),
    );
    repositoryWatcher = nextWatcher;
    console.info(`[Gocus] Watching repository changes in ${repositoryWatcher.repositoryPath}.`);
  } catch (error) {
    console.warn("[Gocus] Unable to start repository watcher.", error);
  }
}

function saveRepositoryPath(repoPath, repositoryKey) {
  config.saveRepositoryPath(repoPath, repositoryKey);
  currentRepository = repoPath;
  syncRepositoryWatcher();
}

function readSavedRepositoryPath() {
  return config.readRepositoryPath();
}

function clearRepositoryPath() {
  config.clearRepositoryPath();
  currentRepository = null;
  refreshRepositoryOnNextResume = false;
  stopRepositoryWatcher();
}

function readRecentRepositories() {
  return config.readRecentRepositories();
}

function removeRecentRepository(repositoryPath, repositoryKey) {
  return config.removeRecentRepository(repositoryPath, repositoryKey);
}

function noRepositoryResponse() {
  return {
    ok: false,
    reason: "not_configured",
    error: "Choose a working folder to start tracking Git changes.",
  };
}

function errorResponse(error, fallback = "Unable to complete the action.") {
  return {
    ok: false,
    reason: "action_failed",
    error: error?.stderr || error?.message || fallback,
  };
}

async function folderWithoutGitResponse(repositoryPath) {
  try {
    const folder = await readFolderWithoutGit(repositoryPath);
    currentRepository = folder.path;
    stopRepositoryWatcher();
    buildMenus();
    return {
      ok: false,
      reason: "not_git_repository",
      error: "This folder does not have Git initialized yet.",
      folder,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "invalid_repository",
      error: error?.stderr || error?.message || "Unable to read the selected folder.",
    };
  }
}

async function openRepositoryPath(
  repositoryPath,
  view = currentView,
  invalidRepositoryMessage = "Unable to read the saved working folder.",
) {
  if (typeof repositoryPath !== "string" || !repositoryPath.trim()) {
    return {
      ok: false,
      reason: "invalid_repository",
      error: "Choose a working folder to start tracking Git changes.",
    };
  }

  try {
    const snapshot = await readGitSnapshot(repositoryPath, normalizeView(view));
    saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
    currentView = snapshot.view;
    buildMenus();
    return { ok: true, snapshot };
  } catch (error) {
    if (isNotGitRepositoryError(error)) return folderWithoutGitResponse(repositoryPath);
    return {
      ok: false,
      reason: "invalid_repository",
      error: error.stderr || error.message || invalidRepositoryMessage,
    };
  }
}

async function getSnapshotResponse(view = currentView) {
  const nextView = normalizeView(view);
  currentView = nextView;
  if (!currentRepository) currentRepository = readSavedRepositoryPath();
  if (!currentRepository) return noRepositoryResponse();

  try {
    const snapshot = await readGitSnapshot(currentRepository, nextView);
    saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
    buildMenus();
    return { ok: true, snapshot };
  } catch (error) {
    if (isNotGitRepositoryError(error)) return folderWithoutGitResponse(currentRepository);
    return {
      ok: false,
      reason: "invalid_repository",
      error: error.stderr || error.message || "Unable to read the saved working folder.",
    };
  }
}

async function showRepositoryDialog() {
  const previousBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null;
  const wasEnabled = mainWindow && !mainWindow.isDestroyed() ? mainWindow.isEnabled() : true;
  const wasPinned = pinnedState;

  sendRepositoryDialogOpen(true);
  await waitForDialogBlockerFrame();

  if (wasPinned) mainWindow?.setAlwaysOnTop(false);
  mainWindow?.setEnabled(false);

  try {
    const options = {
      title: "Open Working Folder",
      properties: ["openDirectory"],
    };

    if (process.platform === "darwin") {
      const filePaths = dialog.showOpenDialogSync(options) ?? [];
      return { canceled: filePaths.length === 0, filePaths };
    }

    return dialog.showOpenDialog(mainWindow, options);
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (previousBounds) setWindowBounds(mainWindow, previousBounds, false);
      mainWindow.setEnabled(wasEnabled);
      if (wasPinned) mainWindow.setAlwaysOnTop(true, "floating");
    }
    sendRepositoryDialogOpen(false);
  }
}

async function chooseRepository(view = currentView) {
  const result = await showRepositoryDialog();

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, canceled: true };
  }

  return openRepositoryPath(result.filePaths[0], view, "The selected folder is not a readable Git repository.");
}

function snapshotResponseWithSource(response, updateSource) {
  if (!updateSource || !response || typeof response !== "object") return response;
  return { ...response, updateSource };
}

function sendSnapshotResponse(response, updateSource) {
  sendToWindow(mainWindow, "git:snapshotUpdated", snapshotResponseWithSource(response, updateSource));
}

function sendRepositoryDialogOpen(open) {
  sendToWindow(mainWindow, "window:repositoryDialogOpenChanged", open);
}

function sendPinnedChanged() {
  sendToWindow(mainWindow, "window:pinnedChanged", pinnedState);
}

function sendTemporaryInfoPanelClosed() {
  sendToWindow(mainWindow, "window:temporaryInfoPanelClosed");
}

function sendCommitInfoPanelClosed() {
  sendToWindow(mainWindow, "window:commitInfoPanelClosed");
}

function sendChangedFileInfoPanelClosed() {
  sendToWindow(temporaryInfoWindow, "window:changedFileInfoPanelClosed");
}

function waitForDialogBlockerFrame() {
  return new Promise((resolve) => setTimeout(resolve, 32));
}

function sendToWindow(win, channel, ...args) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  try {
    win.webContents.send(channel, ...args);
  } catch (error) {
    console.warn(`[Gocus] Unable to send ${channel} to window.`, error);
  }
}

function isWindowFocused(win) {
  return Boolean(win && !win.isDestroyed() && win.isFocused());
}

function holdCommitInfoPanelInteraction(durationMs = 500) {
  const requestedDurationMs = Number(durationMs);
  const holdDurationMs = Number.isFinite(requestedDurationMs) ? Math.min(Math.max(requestedDurationMs, 0), 2000) : 500;
  commitInfoInteractionHoldUntil = Math.max(commitInfoInteractionHoldUntil, Date.now() + holdDurationMs);
}

function isCommitInfoPanelActive() {
  return isWindowFocused(commitInfoWindow) || Date.now() < commitInfoInteractionHoldUntil;
}

function sendPreferences(preferences = readPreferences()) {
  for (const win of [mainWindow, temporaryInfoWindow, changedFileInfoWindow, commitInfoWindow, functionMenuWindow]) {
    sendToWindow(win, "preferences:changed", preferences);
  }
}

function sendActiveWorkspaceOpenTarget() {
  for (const win of [mainWindow, temporaryInfoWindow, changedFileInfoWindow, commitInfoWindow, functionMenuWindow]) {
    sendToWindow(win, "workspace:activeTargetChanged", activeWorkspaceOpenTarget);
  }
}

function setActiveWorkspaceOpenTarget(target) {
  if (typeof target !== "string" || target.length === 0) return activeWorkspaceOpenTarget;
  const previousTarget = activeWorkspaceOpenTarget;
  config.saveActiveWorkspaceOpenTarget(target);
  activeWorkspaceOpenTarget = config.readActiveWorkspaceOpenTarget();
  if (activeWorkspaceOpenTarget !== previousTarget) sendActiveWorkspaceOpenTarget();
  return activeWorkspaceOpenTarget;
}

async function refreshAndSendSnapshot() {
  const response = await getSnapshotResponse();
  sendSnapshotResponse(response, "refresh");
  return response;
}

function repositoryPathForAction() {
  return currentRepository || readSavedRepositoryPath();
}

function recentRepositoryMenuLabel(repository) {
  const parentName = path.basename(path.dirname(repository.path));
  return parentName ? `${repository.name} - ${parentName}` : repository.name;
}

function normalizeRepositorySwitchView(view) {
  const normalized = normalizeView(view);
  return normalized.mode === "branch" ? { mode: "all" } : normalized;
}

function readExpandedSize(display) {
  return expandedSizeFromConfig(config, display);
}

function finishApplyingWindowBounds(delayMs = 250) {
  clearTimeout(applyingWindowBoundsTimer);
  applyingWindowBoundsTimer = setTimeout(() => {
    applyingWindowBounds = false;
  }, delayMs);
}

function clearWindowBoundsAnimation() {
  if (windowBoundsAnimationTimer === null) return;
  clearInterval(windowBoundsAnimationTimer);
  windowBoundsAnimationTimer = null;
}

function setWindowBounds(win, bounds, animated = true, onComplete = null) {
  applyingWindowBounds = true;
  clearWindowBoundsAnimation();
  clearTimeout(applyingWindowBoundsTimer);

  const startBounds = win.getBounds();
  if (!isWindowsRuntime || !animated || windowBoundsEqual(startBounds, bounds)) {
    win.setBounds(bounds, animated);
    if (typeof onComplete === "function") onComplete();
    finishApplyingWindowBounds();
    return;
  }

  const frameCount = windowBoundsAnimationFrameCount();
  let frame = 0;

  windowBoundsAnimationTimer = setInterval(() => {
    if (!win || win.isDestroyed()) {
      clearWindowBoundsAnimation();
      finishApplyingWindowBounds(0);
      return;
    }

    frame += 1;
    const nextBounds =
      frame >= frameCount ? bounds : interpolatedWindowBounds(startBounds, bounds, frame / frameCount);
    win.setBounds(nextBounds, false);

    if (frame < frameCount) return;
    clearWindowBoundsAnimation();
    if (typeof onComplete === "function") onComplete();
    finishApplyingWindowBounds(defaultWindowAnimationDurationMs + defaultWindowAnimationFrameMs);
  }, defaultWindowAnimationFrameMs);
}

function saveCurrentExpandedWindowSize(win) {
  if (!win || win.isDestroyed() || collapsedState || applyingWindowBounds) return;
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds).workArea;
  config.saveExpandedWindowSize(clampExpandedSize(bounds, display));
}

function scheduleExpandedWindowSizeSave(win) {
  if (!win || win.isDestroyed() || collapsedState || applyingWindowBounds) return;
  clearTimeout(expandedWindowSizeSaveTimer);
  expandedWindowSizeSaveTimer = setTimeout(() => {
    saveCurrentExpandedWindowSize(win);
  }, 250);
}

function positionWindow(win, collapsed = false) {
  if (!win) return;
  const display = screen.getPrimaryDisplay().workArea;
  const nextCollapsedSize = collapsed ? collapsedWindowSize : collapsedSize;
  const maximumExpandedSize = expandedMaximumSize(display);
  if (collapsed) {
    win.setMinimumSize(nextCollapsedSize.width, nextCollapsedSize.height);
    win.setMaximumSize(maximumExpandedSize.width, maximumExpandedSize.height);
  } else {
    win.setMaximumSize(maximumExpandedSize.width, maximumExpandedSize.height);
    win.setMinimumSize(collapsedSize.width, collapsedSize.height);
  }
  setWindowBounds(
    win,
    mainWindowBounds({
      currentBounds: win.getBounds(),
      display,
      collapsed,
      collapsedWindowSize: nextCollapsedSize,
      expandedSize: readExpandedSize(display),
    }),
    true,
    () => {
      if (!win || win.isDestroyed()) return;
      if (collapsed) {
        win.setMaximumSize(nextCollapsedSize.width, nextCollapsedSize.height);
        const currentBounds = win.getBounds();
        const alignedBounds = rightAlignedWindowBounds(currentBounds, display);
        if (!windowBoundsEqual(currentBounds, alignedBounds)) setWindowBounds(win, alignedBounds, false);
        return;
      }

      win.setMinimumSize(expandedMinimumSize.width, expandedMinimumSize.height);
    },
  );
}

function setCollapsedRailHeight(height) {
  const display = screen.getPrimaryDisplay().workArea;
  const nextHeight = clampCollapsedRailHeight(height, display);
  if (collapsedWindowSize.height === nextHeight) return;

  collapsedWindowSize = { ...collapsedSize, height: nextHeight };
  if (collapsedState && mainWindow && !mainWindow.isDestroyed()) positionWindow(mainWindow, true);
}

function setCollapsedWindow(collapsed) {
  if (!mainWindow) return;
  const nextCollapsedState = Boolean(collapsed);
  if (!collapsedState && nextCollapsedState) saveCurrentExpandedWindowSize(mainWindow);
  if (nextCollapsedState) {
    closeTemporaryInfoWindow();
    closeChangedFileInfoWindow();
    closeCommitInfoWindow();
    closeFunctionMenuWindow();
  }
  collapsedState = nextCollapsedState;
  positionWindow(mainWindow, collapsedState);
  if (collapsedState) {
    markRepositoryRefreshPending();
    stopRepositoryWatcher();
  } else {
    syncRepositoryWatcher();
    refreshRepositoryAfterResume();
  }
  syncAutoUpdates();
  sendToWindow(mainWindow, "window:collapsedChanged", collapsedState);
  buildMenus();
}

function dockWindow(collapsed = collapsedState) {
  if (!mainWindow) return;
  if (!collapsed) saveCurrentExpandedWindowSize(mainWindow);
  positionWindow(mainWindow, collapsed);
  positionTemporaryInfoWindow({ animated: true });
  positionChangedFileInfoWindow({ animated: true });
  positionCommitInfoWindow({ animated: true });
  positionFunctionMenuWindow({ animated: true });
}

function rendererWindowUrl(mode = "") {
  if (process.env.GOCUS_DEV_SERVER_URL) {
    const url = new URL(process.env.GOCUS_DEV_SERVER_URL);
    if (mode) url.searchParams.set("window", mode);
    return url.toString();
  }

  return null;
}

function loadRendererWindow(win, mode = "") {
  const url = rendererWindowUrl(mode);
  if (url) {
    win.loadURL(url);
    return;
  }

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"), mode ? { query: { window: mode } } : undefined);
}

function temporaryInfoWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const mainBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(mainBounds).workArea;
  return temporaryInfoBounds({ mainBounds, display, alignTop: collapsedState });
}

function sendTemporaryInfoPayload() {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  sendToWindow(temporaryInfoWindow, "window:temporaryInfoPayload", temporaryInfoPayload);
}

function setTemporaryInfoWindowBounds(bounds, animated = false) {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  if (windowBoundsEqual(temporaryInfoWindow.getBounds(), bounds)) return;
  temporaryInfoWindow.setBounds(bounds, animated);
}

function positionTemporaryInfoWindow({ animated = false } = {}) {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  const bounds = temporaryInfoWindowBounds();
  if (bounds) setTemporaryInfoWindowBounds(bounds, animated);
}

function syncTemporaryInfoWindowLevel() {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  const mainFocused = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
  temporaryInfoWindow.setAlwaysOnTop(pinnedState || mainFocused, "floating");
}

function closeTemporaryInfoWindowIfAppInactive() {
  setTimeout(() => {
    const appFocused =
      isWindowFocused(mainWindow) ||
      isWindowFocused(functionMenuWindow) ||
      isWindowFocused(temporaryInfoWindow) ||
      isWindowFocused(changedFileInfoWindow) ||
      isCommitInfoPanelActive() ||
      workspaceOpenMenuActive;
    if (!appFocused) {
      closeTemporaryInfoWindow();
      closeChangedFileInfoWindow();
      closeCommitInfoWindow();
    }
  }, 80);
}

function closeTemporaryInfoWindow() {
  temporaryInfoPayload = null;
  closeChangedFileInfoWindow();
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  const windowToClose = temporaryInfoWindow;
  temporaryInfoWindow = null;
  sendTemporaryInfoPanelClosed();
  positionCommitInfoWindow();
  windowToClose.close();
}

function ensureTemporaryInfoWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  if (temporaryInfoWindow && !temporaryInfoWindow.isDestroyed()) return temporaryInfoWindow;

  const bounds = temporaryInfoWindowBounds() ?? { ...temporaryInfoWindowSize };
  temporaryInfoWindow = new BrowserWindow({
    ...bounds,
    show: false,
    ...framelessWindowOptions(),
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    acceptFirstMouse: true,
    title: "Gocus Info",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowShadow(temporaryInfoWindow);
  syncTemporaryInfoWindowLevel();
  temporaryInfoWindow.once("ready-to-show", () => {
    applyWindowShadow(temporaryInfoWindow);
    positionTemporaryInfoWindow();
    syncTemporaryInfoWindowLevel();
    temporaryInfoWindow?.showInactive();
    sendTemporaryInfoPayload();
  });
  temporaryInfoWindow.webContents.on("did-finish-load", sendTemporaryInfoPayload);
  temporaryInfoWindow.on("blur", closeTemporaryInfoWindowIfAppInactive);
  temporaryInfoWindow.on("closed", () => {
    temporaryInfoWindow = null;
    temporaryInfoPayload = null;
    closeChangedFileInfoWindow();
    sendTemporaryInfoPanelClosed();
  });
  loadRendererWindow(temporaryInfoWindow, "temporary-info");

  return temporaryInfoWindow;
}

function setTemporaryInfoPanel(payload) {
  if (!payload) {
    closeTemporaryInfoWindow();
    return;
  }

  temporaryInfoPayload = payload;
  const infoWindow = ensureTemporaryInfoWindow();
  if (!infoWindow) return;
  positionTemporaryInfoWindow();
  positionChangedFileInfoWindow();
  sendTemporaryInfoPayload();
  positionCommitInfoWindow();
}

function functionMenuWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const mainBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(mainBounds).workArea;
  const height = clampFunctionMenuWindowHeight(functionMenuWindowHeight, display);
  return functionMenuBounds({ mainBounds, display, size: { ...functionMenuWindowSize, height } });
}

function sendFunctionMenuPayload() {
  if (!functionMenuWindow || functionMenuWindow.isDestroyed()) return;
  sendToWindow(functionMenuWindow, "window:functionMenuPayload", functionMenuPayload);
}

function sendFunctionMenuPanelClosed() {
  sendToWindow(mainWindow, "window:functionMenuPanelClosed");
}

function setFunctionMenuWindowBounds(bounds, animated = false) {
  if (!functionMenuWindow || functionMenuWindow.isDestroyed()) return;
  if (windowBoundsEqual(functionMenuWindow.getBounds(), bounds)) return;
  functionMenuWindow.setBounds(bounds, animated);
}

function positionFunctionMenuWindow({ animated = false } = {}) {
  if (!functionMenuWindow || functionMenuWindow.isDestroyed()) return;
  const bounds = functionMenuWindowBounds();
  if (bounds) setFunctionMenuWindowBounds(bounds, animated);
}

function syncFunctionMenuWindowLevel() {
  if (!functionMenuWindow || functionMenuWindow.isDestroyed()) return;
  const mainFocused = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
  functionMenuWindow.setAlwaysOnTop(pinnedState || mainFocused, "floating");
}

function closeFunctionMenuWindowIfAppInactive() {
  setTimeout(() => {
    const appFocused =
      isWindowFocused(mainWindow) ||
      isWindowFocused(functionMenuWindow) ||
      isWindowFocused(temporaryInfoWindow) ||
      isWindowFocused(changedFileInfoWindow) ||
      isCommitInfoPanelActive() ||
      workspaceOpenMenuActive;
    if (!appFocused) closeFunctionMenuWindow();
  }, 80);
}

function closeFunctionMenuWindow() {
  functionMenuPayload = null;
  functionMenuWindowHeight = functionMenuWindowSize.height;
  if (!functionMenuWindow || functionMenuWindow.isDestroyed()) return;
  const windowToClose = functionMenuWindow;
  functionMenuWindow = null;
  sendFunctionMenuPanelClosed();
  windowToClose.close();
}

function ensureFunctionMenuWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  if (functionMenuWindow && !functionMenuWindow.isDestroyed()) return functionMenuWindow;

  const bounds = functionMenuWindowBounds() ?? { ...functionMenuWindowSize };
  functionMenuWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    acceptFirstMouse: true,
    title: "Gocus Function Menu",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowShadow(functionMenuWindow);
  syncFunctionMenuWindowLevel();
  functionMenuWindow.once("ready-to-show", () => {
    applyWindowShadow(functionMenuWindow);
    positionFunctionMenuWindow();
    syncFunctionMenuWindowLevel();
    functionMenuWindow?.showInactive();
    sendFunctionMenuPayload();
  });
  functionMenuWindow.webContents.on("did-finish-load", sendFunctionMenuPayload);
  functionMenuWindow.on("blur", closeFunctionMenuWindowIfAppInactive);
  functionMenuWindow.on("closed", () => {
    functionMenuWindow = null;
    functionMenuPayload = null;
    functionMenuWindowHeight = functionMenuWindowSize.height;
    sendFunctionMenuPanelClosed();
  });
  loadRendererWindow(functionMenuWindow, "function-menu");

  return functionMenuWindow;
}

function setFunctionMenuPanel(payload) {
  if (!payload) {
    closeFunctionMenuWindow();
    return;
  }

  functionMenuPayload = payload;
  const menuWindow = ensureFunctionMenuWindow();
  if (!menuWindow) return;
  positionFunctionMenuWindow();
  sendFunctionMenuPayload();
}

function setFunctionMenuPanelHeight(height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const mainBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(mainBounds).workArea;
  const nextHeight = clampFunctionMenuWindowHeight(height, display);
  if (nextHeight === functionMenuWindowHeight) return;

  functionMenuWindowHeight = nextHeight;
  positionFunctionMenuWindow({ animated: true });
}

function changedFileInfoWindowBounds() {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return null;

  const temporaryBounds = temporaryInfoWindow.getBounds();
  const display = screen.getDisplayMatching(temporaryBounds).workArea;
  return changedFileInfoBounds({ temporaryInfoBounds: temporaryBounds, display });
}

function sendChangedFileInfoPayload() {
  if (!changedFileInfoWindow || changedFileInfoWindow.isDestroyed()) return;
  sendToWindow(changedFileInfoWindow, "window:changedFileInfoPayload", changedFileInfoPayload);
}

function setChangedFileInfoWindowBounds(bounds, animated = false) {
  if (!changedFileInfoWindow || changedFileInfoWindow.isDestroyed()) return;
  if (windowBoundsEqual(changedFileInfoWindow.getBounds(), bounds)) return;
  changedFileInfoWindow.setBounds(bounds, animated);
}

function positionChangedFileInfoWindow({ animated = false } = {}) {
  if (!changedFileInfoWindow || changedFileInfoWindow.isDestroyed()) return;
  const bounds = changedFileInfoWindowBounds();
  if (bounds) setChangedFileInfoWindowBounds(bounds, animated);
}

function syncChangedFileInfoWindowLevel() {
  if (!changedFileInfoWindow || changedFileInfoWindow.isDestroyed()) return;
  changedFileInfoWindow.setAlwaysOnTop(pinnedState || isWindowFocused(mainWindow), "floating");
}

function closeChangedFileInfoWindowIfAppInactive() {
  setTimeout(() => {
    const appFocused =
      isWindowFocused(mainWindow) ||
      isWindowFocused(functionMenuWindow) ||
      isWindowFocused(temporaryInfoWindow) ||
      isWindowFocused(changedFileInfoWindow) ||
      isCommitInfoPanelActive() ||
      workspaceOpenMenuActive;
    if (!appFocused) {
      closeChangedFileInfoWindow();
      closeTemporaryInfoWindow();
      closeCommitInfoWindow();
    }
  }, 80);
}

function closeChangedFileInfoWindow() {
  changedFileInfoPayload = null;
  if (!changedFileInfoWindow || changedFileInfoWindow.isDestroyed()) return;
  const windowToClose = changedFileInfoWindow;
  changedFileInfoWindow = null;
  sendChangedFileInfoPanelClosed();
  windowToClose.close();
}

function ensureChangedFileInfoWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return null;
  if (changedFileInfoWindow && !changedFileInfoWindow.isDestroyed()) return changedFileInfoWindow;

  const bounds = changedFileInfoWindowBounds() ?? { ...changedFileInfoWindowSize };
  changedFileInfoWindow = new BrowserWindow({
    ...bounds,
    show: false,
    ...framelessWindowOptions(),
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    acceptFirstMouse: true,
    title: "Gocus Changed File Info",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowShadow(changedFileInfoWindow);
  syncChangedFileInfoWindowLevel();
  changedFileInfoWindow.once("ready-to-show", () => {
    applyWindowShadow(changedFileInfoWindow);
    positionChangedFileInfoWindow();
    syncChangedFileInfoWindowLevel();
    changedFileInfoWindow?.showInactive();
    sendChangedFileInfoPayload();
  });
  changedFileInfoWindow.webContents.on("did-finish-load", sendChangedFileInfoPayload);
  changedFileInfoWindow.on("blur", closeChangedFileInfoWindowIfAppInactive);
  changedFileInfoWindow.on("closed", () => {
    changedFileInfoWindow = null;
    changedFileInfoPayload = null;
    sendChangedFileInfoPanelClosed();
  });
  loadRendererWindow(changedFileInfoWindow, "changed-file-info");

  return changedFileInfoWindow;
}

function setChangedFileInfoPanel(payload) {
  if (!payload) {
    closeChangedFileInfoWindow();
    return;
  }

  changedFileInfoPayload = payload;
  const infoWindow = ensureChangedFileInfoWindow();
  if (!infoWindow) return;
  positionChangedFileInfoWindow();
  sendChangedFileInfoPayload();
}

function workspaceOpenMenuVisibleOptions(payload) {
  if (!payload || payload.kind !== "changed-file") return [];
  const availableTargets = new Set(Array.isArray(payload.availableWorkspaceTargets) ? payload.availableWorkspaceTargets : []);
  const enabledTargets = new Set(Array.isArray(payload.enabledWorkspaceTargets) ? payload.enabledWorkspaceTargets : []);
  return workspaceOpenMenuOptions.filter((option) => availableTargets.has(option.target) && enabledTargets.has(option.target));
}

function openWorkspaceFileMenu(sourceWebContents, payload) {
  const sourceWindow = BrowserWindow.fromWebContents(sourceWebContents);
  if (!sourceWindow || sourceWindow.isDestroyed()) return;

  const visibleOptions = workspaceOpenMenuVisibleOptions(payload);
  if (visibleOptions.length === 0) return;

  const checkedTarget = visibleOptions.some((option) => option.target === payload.activeWorkspaceTarget)
    ? payload.activeWorkspaceTarget
    : visibleOptions[0].target;
  const template = visibleOptions.map((option) => ({
    label: option.label,
    type: "checkbox",
    checked: option.target === checkedTarget,
    click: () => {
      setActiveWorkspaceOpenTarget(option.target);
      openWorkspaceFile(repositoryPathForAction(), option.target, payload.filePath)
        .then((response) => {
          if (response && !response.ok) {
            console.warn("[Gocus] Unable to open file in selected app.", response.error ?? response);
          }
        })
        .catch((error) => {
          console.warn("[Gocus] Unable to open file in selected app.", error);
        });
    },
  }));
  const anchorBounds = payload.anchorBounds ?? {};
  const anchorLeft = Number.isFinite(anchorBounds.left) ? anchorBounds.left : 0;
  const anchorTop = Number.isFinite(anchorBounds.top) ? anchorBounds.top : 0;
  const anchorHeight = Number.isFinite(anchorBounds.height) ? anchorBounds.height : 0;

  workspaceOpenMenuActive = true;
  try {
    Menu.buildFromTemplate(template).popup({
      window: sourceWindow,
      x: Math.round(anchorLeft),
      y: Math.round(anchorTop + anchorHeight),
      positioningItem: Math.max(0, visibleOptions.findIndex((option) => option.target === checkedTarget)),
      callback: () => {
        workspaceOpenMenuActive = false;
      },
    });
  } catch (error) {
    workspaceOpenMenuActive = false;
    console.warn("[Gocus] Unable to open workspace app menu.", error);
  }
}

function commitInfoWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const mainBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(mainBounds).workArea;
  const avoidBounds = temporaryInfoWindow && !temporaryInfoWindow.isDestroyed() ? temporaryInfoWindow.getBounds() : null;
  const anchorBounds = commitInfoPayload?.kind === "commit" ? commitInfoPayload.anchorBounds : null;
  const height = clampCommitInfoWindowHeight(commitInfoWindowHeight, display);
  return commitInfoBounds({
    mainBounds,
    display,
    alignTop: collapsedState,
    avoidBounds,
    anchorBounds,
    size: { ...commitInfoWindowSize, height },
  });
}

function sendCommitInfoPayload() {
  if (!commitInfoWindow || commitInfoWindow.isDestroyed()) return;
  sendToWindow(commitInfoWindow, "window:commitInfoPayload", commitInfoPayload);
}

function setCommitInfoWindowBounds(bounds, animated = false) {
  if (!commitInfoWindow || commitInfoWindow.isDestroyed()) return;
  if (windowBoundsEqual(commitInfoWindow.getBounds(), bounds)) return;
  commitInfoWindow.setBounds(bounds, animated);
}

function positionCommitInfoWindow({ animated = false } = {}) {
  if (!commitInfoWindow || commitInfoWindow.isDestroyed()) return;
  const bounds = commitInfoWindowBounds();
  if (bounds) setCommitInfoWindowBounds(bounds, animated);
}

function syncCommitInfoWindowLevel() {
  if (!commitInfoWindow || commitInfoWindow.isDestroyed()) return;
  const mainFocused = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
  commitInfoWindow.setAlwaysOnTop(pinnedState || mainFocused, "floating");
}

function closeCommitInfoWindowIfAppInactive() {
  setTimeout(() => {
    const appFocused =
      isWindowFocused(mainWindow) ||
      isWindowFocused(functionMenuWindow) ||
      isWindowFocused(temporaryInfoWindow) ||
      isWindowFocused(changedFileInfoWindow) ||
      isCommitInfoPanelActive() ||
      workspaceOpenMenuActive;
    if (!appFocused) {
      closeCommitInfoWindow();
      closeChangedFileInfoWindow();
      closeTemporaryInfoWindow();
    }
  }, 80);
}

function closeCommitInfoWindow() {
  commitInfoPayload = null;
  commitInfoWindowHeight = commitInfoWindowSize.height;
  if (!commitInfoWindow || commitInfoWindow.isDestroyed()) return;
  const windowToClose = commitInfoWindow;
  commitInfoWindow = null;
  sendCommitInfoPanelClosed();
  windowToClose.close();
}

function ensureCommitInfoWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  if (commitInfoWindow && !commitInfoWindow.isDestroyed()) return commitInfoWindow;

  const bounds = commitInfoWindowBounds() ?? { ...commitInfoWindowSize };
  commitInfoWindow = new BrowserWindow({
    ...bounds,
    show: false,
    ...framelessWindowOptions(),
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    acceptFirstMouse: true,
    title: "Gocus Commit Info",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowShadow(commitInfoWindow);
  syncCommitInfoWindowLevel();
  commitInfoWindow.once("ready-to-show", () => {
    applyWindowShadow(commitInfoWindow);
    positionCommitInfoWindow();
    syncCommitInfoWindowLevel();
    commitInfoWindow?.showInactive();
    sendCommitInfoPayload();
  });
  commitInfoWindow.webContents.on("did-finish-load", sendCommitInfoPayload);
  commitInfoWindow.on("blur", closeCommitInfoWindowIfAppInactive);
  commitInfoWindow.on("closed", () => {
    commitInfoWindow = null;
    commitInfoPayload = null;
    commitInfoWindowHeight = commitInfoWindowSize.height;
    sendCommitInfoPanelClosed();
  });
  loadRendererWindow(commitInfoWindow, "commit-info");

  return commitInfoWindow;
}

function setCommitInfoPanel(payload) {
  if (!payload) {
    closeCommitInfoWindow();
    return;
  }

  commitInfoPayload = payload;
  const infoWindow = ensureCommitInfoWindow();
  if (!infoWindow) return;
  positionCommitInfoWindow();
  sendCommitInfoPayload();
}

function setCommitInfoPanelHeight(height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const mainBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(mainBounds).workArea;
  const nextHeight = clampCommitInfoWindowHeight(height, display);
  if (nextHeight === commitInfoWindowHeight) return;

  commitInfoWindowHeight = nextHeight;
  positionCommitInfoWindow({ animated: true });
}

function setPinnedWindow(pinned) {
  if (!mainWindow) return;
  pinnedState = Boolean(pinned);
  mainWindow.setAlwaysOnTop(pinnedState, "floating");
  syncTemporaryInfoWindowLevel();
  syncChangedFileInfoWindowLevel();
  syncCommitInfoWindowLevel();
  syncFunctionMenuWindowLevel();
  sendPinnedChanged();
  buildMenus();
}

function showMainWindow() {
  syncDockIcon();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow({ showOnReady: true });
    return;
  }

  mainWindow.show();
  syncRepositoryWatcher();
  mainWindow.focus();
}

function createWindow({ showOnReady = true, collapsed = false } = {}) {
  const appIcon = loadAppWindowIcon();
  const initialExpandedSize = readExpandedSize(screen.getPrimaryDisplay().workArea);
  collapsedState = Boolean(collapsed);

  mainWindow = new BrowserWindow({
    ...initialExpandedSize,
    minWidth: expandedMinimumSize.width,
    minHeight: expandedMinimumSize.height,
    show: false,
    ...framelessWindowOptions(),
    icon: appIcon,
    resizable: true,
    skipTaskbar: isWindowsRuntime ? !shouldShowDockIcon() : false,
    title: "Gocus",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowShadow(mainWindow);
  positionWindow(mainWindow, collapsedState);
  mainWindow.once("ready-to-show", () => {
    applyWindowShadow(mainWindow);
    if (showOnReady) mainWindow.show();
  });
  mainWindow.on("move", () => {
    positionTemporaryInfoWindow();
    positionChangedFileInfoWindow();
    positionCommitInfoWindow();
    positionFunctionMenuWindow();
  });
  mainWindow.on("resize", () => {
    scheduleExpandedWindowSizeSave(mainWindow);
    positionTemporaryInfoWindow();
    positionChangedFileInfoWindow();
    positionCommitInfoWindow();
    positionFunctionMenuWindow();
  });
  mainWindow.on("focus", () => {
    syncTemporaryInfoWindowLevel();
    syncChangedFileInfoWindowLevel();
    syncCommitInfoWindowLevel();
    syncFunctionMenuWindowLevel();
  });
  mainWindow.on("blur", () => {
    syncTemporaryInfoWindowLevel();
    syncChangedFileInfoWindowLevel();
    syncCommitInfoWindowLevel();
    syncFunctionMenuWindowLevel();
    closeTemporaryInfoWindowIfAppInactive();
    closeChangedFileInfoWindowIfAppInactive();
    closeCommitInfoWindowIfAppInactive();
    closeFunctionMenuWindowIfAppInactive();
  });
  mainWindow.on("show", () => {
    syncRepositoryWatcher();
    refreshRepositoryAfterResume();
    syncAutoUpdates();
  });
  mainWindow.on("hide", () => {
    closeTemporaryInfoWindow();
    closeChangedFileInfoWindow();
    closeCommitInfoWindow();
    closeFunctionMenuWindow();
    markRepositoryRefreshPending();
    stopRepositoryWatcher();
    syncAutoUpdates();
  });
  mainWindow.on("close", (event) => {
    closeTemporaryInfoWindow();
    closeChangedFileInfoWindow();
    closeCommitInfoWindow();
    closeFunctionMenuWindow();
    saveCurrentExpandedWindowSize(mainWindow);
    if (shouldHideToMenuBarOnClose()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    closeTemporaryInfoWindow();
    closeChangedFileInfoWindow();
    closeCommitInfoWindow();
    closeFunctionMenuWindow();
    clearWindowBoundsAnimation();
    clearTimeout(applyingWindowBoundsTimer);
    clearTimeout(expandedWindowSizeSaveTimer);
    mainWindow = null;
  });

  loadRendererWindow(mainWindow);
}

function createTray() {
  if (!shouldUseMenuBarResidency()) return;
  if (tray) {
    buildMenus();
    return;
  }

  const trayIconName = process.platform === "win32" ? "app-icon.ico" : "tray-iconTemplate.png";
  const trayIcon = assets.loadImageAsset(trayIconName, { template: process.platform === "darwin" });

  tray = new Tray(trayIcon);
  tray.setToolTip("Gocus");
  if (process.platform === "win32") {
    tray.on("click", showMainWindow);
  }
  if (process.platform === "darwin" && process.env.GOCUS_SHOW_TRAY_TITLE === "1") {
    tray.setTitle("Gocus");
  }
  if (process.env.GOCUS_DEBUG_TRAY === "1") {
    setTimeout(() => {
      console.info(
        "[tray]",
        JSON.stringify({
          asset: trayIconName,
          empty: trayIcon.isEmpty(),
          template: process.platform === "darwin" ? trayIcon.isTemplateImage() : false,
          size1x: trayIcon.getSize(1),
          size2x: trayIcon.getSize(2),
          scales: trayIcon.getScaleFactors(),
          bounds: tray.getBounds(),
          title: process.platform === "darwin" ? tray.getTitle() : "",
        }),
      );
    }, 1000);
  }
  buildMenus();
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function syncMenuBarIcon(preferences = config.readPreferences()) {
  if (shouldUseMenuBarResidency(preferences)) {
    createTray();
  } else {
    destroyTray();
  }

  syncDockIcon(preferences);
  buildMenus();
}

function syncDockIcon(preferences = config.readPreferences()) {
  if (shouldShowDockIcon(preferences)) {
    showDockIcon();
    return;
  }

  hideDockIcon();
}

function buildMenus() {
  if (!app.isReady()) return;

  const activeRepository = repositoryPathForAction();
  const hasRepository = Boolean(activeRepository);
  const recentRepositories = readRecentRepositories();
  const openFolderAction = async () => sendSnapshotResponse(await chooseRepository(), "repository");
  const refreshAction = async () => refreshAndSendSnapshot();
  const openRecentAction = async (repositoryPath) => {
    sendSnapshotResponse(
      await openRepositoryPath(
        repositoryPath,
        normalizeRepositorySwitchView(currentView),
        "Unable to open the recent working folder.",
      ),
      "repository",
    );
  };
  const revealAction = () => {
    const repositoryPath = repositoryPathForAction();
    if (repositoryPath) shell.openPath(repositoryPath);
  };
  const clearAction = () => {
    clearRepositoryPath();
    sendSnapshotResponse(noRepositoryResponse(), "repository");
    buildMenus();
  };
  const updateAction = () => autoUpdates.checkForUpdates({ manual: true });
  const updateMenuItem = () => ({
    label: autoUpdates.isChecking() ? "Checking for Updates..." : "Check for Updates...",
    enabled: autoUpdates.isSupported() && !autoUpdates.isChecking(),
    click: updateAction,
  });
  const menuBarModeEnabled = shouldUseMenuBarResidency();
  const buildRecentRepositorySubmenu = () =>
    recentRepositories.length
      ? recentRepositories.map((repository) => {
          const isActive = repository.path === activeRepository;
          const label = recentRepositoryMenuLabel(repository);

          return {
            label: isActive ? `${label} (Current)` : label,
            enabled: !isActive,
            click: () => openRecentAction(repository.path),
          };
        })
      : [{ label: "No recent working folders", enabled: false }];

  const appMenu = process.platform === "darwin"
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            updateMenuItem(),
            { type: "separator" },
            { label: "Show Gocus", click: showMainWindow },
            { label: "Hide Gocus", click: () => mainWindow?.hide() },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            menuBarModeEnabled
              ? { label: "Hide to Menu Bar", accelerator: "CmdOrCtrl+Q", click: softQuitToMenuBar }
              : { role: "quit" },
          ],
        },
      ]
    : [];

  const template = [
    ...appMenu,
    {
      label: "File",
      submenu: [
        { label: "Open Working Folder...", accelerator: "CmdOrCtrl+O", click: openFolderAction },
        { label: "Open Recent", submenu: buildRecentRepositorySubmenu() },
        { label: "Refresh Git Data", accelerator: "CmdOrCtrl+R", enabled: hasRepository, click: refreshAction },
        { label: "Reveal Working Folder", enabled: hasRepository, click: revealAction },
        { type: "separator" },
        { label: "Clear Working Folder", enabled: hasRepository, click: clearAction },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Expand Gocus", accelerator: "CmdOrCtrl+Shift+E", enabled: collapsedState, click: () => setCollapsedWindow(false) },
        {
          label: "Collapse to Edge Tab",
          accelerator: "CmdOrCtrl+Shift+C",
          enabled: !collapsedState,
          click: () => setCollapsedWindow(true),
        },
        { label: "Dock to Screen Edge", accelerator: "CmdOrCtrl+Shift+D", click: () => dockWindow(collapsedState) },
        { type: "separator" },
        { label: "Always on Top", type: "checkbox", checked: pinnedState, click: (item) => setPinnedWindow(item.checked) },
        ...(app.isPackaged
          ? []
          : [
              { type: "separator" },
              { role: "reload" },
              { role: "toggleDevTools" },
            ]),
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Show Gocus", click: showMainWindow },
        { label: "Hide Gocus", click: () => mainWindow?.hide() },
        { role: "minimize" },
        { role: "close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        updateMenuItem(),
        { type: "separator" },
        { label: "Gocus remembers the last working folder", enabled: false },
        { label: "Git-changing actions ask from the panel before running", enabled: false },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (tray) {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Gocus", click: showMainWindow },
        { label: collapsedState ? "Expand Gocus" : "Collapse to Edge Tab", click: () => setCollapsedWindow(!collapsedState) },
        { label: "Dock to Screen Edge", click: () => dockWindow(collapsedState) },
        { type: "separator" },
        { label: "Open Working Folder...", click: openFolderAction },
        { label: "Open Recent", submenu: buildRecentRepositorySubmenu() },
        { label: "Refresh Git Data", enabled: hasRepository, click: refreshAction },
        { label: "Reveal Working Folder", enabled: hasRepository, click: revealAction },
        { type: "separator" },
        { label: "Always on Top", type: "checkbox", checked: pinnedState, click: (item) => setPinnedWindow(item.checked) },
        { type: "separator" },
        updateMenuItem(),
        { type: "separator" },
        { label: "Quit Gocus", click: requestRealQuit },
      ]),
    );
  }
}

app.whenReady().then(() => {
  app.setName("Gocus");
  nativeTheme.themeSource = "dark";
  syncWindowBackgroundColors();
  currentRepository = readSavedRepositoryPath();
  const preferences = config.readPreferences();
  const menuBarModeEnabled = shouldUseMenuBarResidency(preferences);
  const startCollapsedAtLogin = shouldStartCollapsedAtLogin();
  if (preferences.launchAtLogin) syncLaunchAtLogin(preferences);
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(assets.loadImageAsset("app-icon.png"));
  }
  if (menuBarModeEnabled) createTray();
  syncDockIcon(preferences);
  createWindow({ collapsed: startCollapsedAtLogin });
  syncRepositoryWatcher();
  syncAutoUpdates(preferences);

  app.on("activate", () => {
    showMainWindow();
  });
  app.on("browser-window-blur", () => {
    closeTemporaryInfoWindowIfAppInactive();
    closeChangedFileInfoWindowIfAppInactive();
    closeCommitInfoWindowIfAppInactive();
  });
  app.on("did-resign-active", () => {
    workspaceOpenMenuActive = false;
    closeTemporaryInfoWindow();
    closeChangedFileInfoWindow();
    closeCommitInfoWindow();
  });
});

app.on("before-quit", (event) => {
  if (!shouldHideToMenuBarOnClose()) {
    stopRepositoryWatcher();
    return;
  }

  event.preventDefault();
  softQuitToMenuBar();
});

app.on("window-all-closed", () => {
  if (!shouldUseMenuBarResidency()) app.quit();
});

registerIpcHandlers({
  buildMenus,
  checkout,
  checkForUpdates: () => autoUpdates.checkForUpdates({ manual: true }),
  chooseRepository,
  clearRepositoryPath,
  clipboard,
  config,
  cleanupWorktree,
  createBranch,
  dockWindow,
  errorResponse,
  fetchRemotes,
  getActiveWorkspaceOpenTarget: () => activeWorkspaceOpenTarget,
  getAvailableWorkspaceTargets,
  getChangedFileInfoPayload: () => changedFileInfoPayload,
  getCollapsedState: () => collapsedState,
  getCommitInfoPayload: () => commitInfoPayload,
  getFunctionMenuPayload: () => functionMenuPayload,
  getPinnedState: () => pinnedState,
  holdCommitInfoPanelInteraction,
  isCommitInfoPanelActive,
  getSnapshotResponse,
  getTemporaryInfoPayload: () => temporaryInfoPayload,
  initializeRepository,
  ipcMain,
  merge,
  noRepositoryResponse,
  normalizeRepositorySwitchView,
  normalizeView,
  openRepositoryPath,
  openRepositoryRemote,
  openWorkspace,
  openWorkspaceFile,
  openWorkspaceFileMenu,
  openGitHubReleases,
  openWorktree,
  pullCurrentBranch,
  pushCurrentBranch,
  readPreferences,
  readRecentRepositories,
  removeRecentRepository,
  repositoryPathForAction,
  saveRepositoryPath,
  sendPreferences,
  sendSnapshotResponse,
  setCollapsedRailHeight,
  setActiveWorkspaceOpenTarget,
  setCollapsedWindow,
  setChangedFileInfoPanel,
  setCommitInfoPanel,
  setCommitInfoPanelHeight,
  setCurrentView: (view) => {
    currentView = view;
  },
  setFunctionMenuPanel,
  setFunctionMenuPanelHeight,
  setPinnedWindow,
  setTemporaryInfoPanel,
  syncAutoUpdates,
  syncDockIcon,
  syncLaunchAtLogin,
  syncMenuBarIcon,
  syncRepositoryWatcher,
});
