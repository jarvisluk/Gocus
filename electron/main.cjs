const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, nativeTheme, screen, shell } = require("electron");
const path = require("node:path");
const { createAssetLoader } = require("./lib/assets.cjs");
const { createConfigStore } = require("./lib/config.cjs");
const { checkout, createBranch, initializeRepository, isNotGitRepositoryError, normalizeView, openWorktree, readFolderWithoutGit, readGitSnapshot } = require("./lib/git.cjs");
const { getAvailableWorkspaceTargets, openWorkspace } = require("./lib/workspace.cjs");

let mainWindow;
let tray;
let currentRepository = null;
let collapsedState = false;
let pinnedState = false;
let currentView = { mode: "all" };
let applyingWindowBounds = false;
let applyingWindowBoundsTimer = null;
let expandedWindowSizeSaveTimer = null;
let realQuitRequested = false;
let dockHiddenForMenuBarMode = false;
let temporaryInfoWindow = null;
let temporaryInfoPayload = null;

const expandedMinimumSize = { width: 320, height: 620 };
const defaultExpandedSize = { width: expandedMinimumSize.width, height: 780 };
const collapsedSize = { width: 38, height: 154 };
const temporaryInfoWindowSize = { width: 280, height: 220 };
const temporaryInfoWindowGap = 10;
const hiddenLaunchArg = "--hidden";
const config = createConfigStore(app);
const assets = createAssetLoader({
  nativeImage,
  resourcesPath: process.resourcesPath,
  electronDir: __dirname,
});

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
    console.warn("[Git Peek] Unable to read launch-at-login state.", error);
    return fallback;
  }
}

function readPreferences() {
  const preferences = config.readPreferences();
  return {
    ...preferences,
    launchAtLogin: readLaunchAtLoginEnabled(Boolean(preferences.launchAtLogin)),
  };
}

function syncLaunchAtLogin(preferences = config.readPreferences()) {
  if (process.platform !== "darwin" && process.platform !== "win32") return;

  try {
    app.setLoginItemSettings(loginItemSettings(Boolean(preferences.launchAtLogin)));
  } catch (error) {
    console.warn("[Git Peek] Unable to update launch-at-login state.", error);
  }
}

function shouldStartInMenuBar() {
  const preferences = config.readPreferences();
  if (!preferences.launchAtLogin && !process.argv.includes(hiddenLaunchArg)) return false;
  if (process.argv.includes(hiddenLaunchArg)) return true;
  if (process.platform !== "darwin") return false;

  try {
    const settings = app.getLoginItemSettings();
    return settings.wasOpenedAtLogin || settings.wasOpenedAsHidden;
  } catch {
    return false;
  }
}

function hideDockIcon() {
  if (process.platform !== "darwin" || !app.dock) return;
  app.dock.hide();
  dockHiddenForMenuBarMode = true;
}

function showDockIcon() {
  if (process.platform !== "darwin" || !app.dock || !dockHiddenForMenuBarMode) return;
  app.dock.show();
  app.dock.setIcon(assets.loadImageAsset("app-icon.png"));
  dockHiddenForMenuBarMode = false;
}

function softQuitToMenuBar() {
  closeTemporaryInfoWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveCurrentExpandedWindowSize(mainWindow);
    mainWindow.hide();
  }
  hideDockIcon();
}

function requestRealQuit() {
  realQuitRequested = true;
  app.quit();
}

function saveRepositoryPath(repoPath, repositoryKey) {
  config.saveRepositoryPath(repoPath, repositoryKey);
  currentRepository = repoPath;
}

function readSavedRepositoryPath() {
  return config.readRepositoryPath();
}

function clearRepositoryPath() {
  config.clearRepositoryPath();
  currentRepository = null;
}

function readRecentRepositories() {
  return config.readRecentRepositories();
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

async function openRepositoryPath(repositoryPath, view = currentView, invalidRepositoryMessage = "Unable to read the saved working folder.") {
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

function sendSnapshotResponse(response) {
  mainWindow?.webContents.send("git:snapshotUpdated", response);
}

function sendRepositoryDialogOpen(open) {
  mainWindow?.webContents.send("window:repositoryDialogOpenChanged", open);
}

function sendTemporaryInfoPanelClosed() {
  mainWindow?.webContents.send("window:temporaryInfoPanelClosed");
}

function waitForDialogBlockerFrame() {
  return new Promise((resolve) => setTimeout(resolve, 32));
}

function getSystemTheme() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function sendSystemTheme() {
  mainWindow?.webContents.send("theme:changed", getSystemTheme());
}

async function refreshAndSendSnapshot() {
  const response = await getSnapshotResponse();
  sendSnapshotResponse(response);
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

function clampExpandedSize(size, display) {
  return {
    width: Math.min(Math.max(Math.round(size.width), expandedMinimumSize.width), Math.max(expandedMinimumSize.width, display.width - 20)),
    height: Math.min(Math.max(Math.round(size.height), expandedMinimumSize.height), Math.max(expandedMinimumSize.height, display.height - 16)),
  };
}

function readExpandedSize(display) {
  return clampExpandedSize(config.readExpandedWindowSize() ?? defaultExpandedSize, display);
}

function setWindowBounds(win, bounds, animated = true) {
  applyingWindowBounds = true;
  clearTimeout(applyingWindowBoundsTimer);
  win.setBounds(bounds, animated);
  applyingWindowBoundsTimer = setTimeout(() => {
    applyingWindowBounds = false;
  }, 250);
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
  const size = collapsed ? collapsedSize : readExpandedSize(display);
  win.setMinimumSize(collapsed ? collapsedSize.width : expandedMinimumSize.width, collapsed ? collapsedSize.height : expandedMinimumSize.height);
  const current = win.getBounds();
  const edgeInset = collapsed ? 0 : 10;
  const x = display.x + display.width - size.width - edgeInset;
  const fallbackY = display.y + Math.max(18, Math.floor((display.height - size.height) / 2));
  const requestedY = current?.y ?? fallbackY;
  const minY = display.y + 8;
  const maxY = display.y + display.height - size.height - 8;
  const y = Math.min(Math.max(requestedY, minY), Math.max(minY, maxY));
  setWindowBounds(win, { x, y, width: size.width, height: size.height }, true);
}

function setCollapsedWindow(collapsed) {
  if (!mainWindow) return;
  const nextCollapsedState = Boolean(collapsed);
  if (!collapsedState && nextCollapsedState) saveCurrentExpandedWindowSize(mainWindow);
  if (nextCollapsedState) closeTemporaryInfoWindow();
  collapsedState = nextCollapsedState;
  positionWindow(mainWindow, collapsedState);
  mainWindow.webContents.send("window:collapsedChanged", collapsedState);
  buildMenus();
}

function dockWindow(collapsed = collapsedState) {
  if (!mainWindow) return;
  if (!collapsed) saveCurrentExpandedWindowSize(mainWindow);
  positionWindow(mainWindow, collapsed);
  positionTemporaryInfoWindow();
}

function rendererWindowUrl(mode = "") {
  if (process.env.GIT_PEEK_DEV_SERVER_URL) {
    const url = new URL(process.env.GIT_PEEK_DEV_SERVER_URL);
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
  const width = temporaryInfoWindowSize.width;
  const height = temporaryInfoWindowSize.height;
  const preferredX = mainBounds.x - width - temporaryInfoWindowGap;
  const fallbackX = mainBounds.x + temporaryInfoWindowGap;
  const x = preferredX >= display.x + 8 ? preferredX : Math.min(fallbackX, display.x + display.width - width - 8);
  const preferredY = mainBounds.y + mainBounds.height - height;
  const minY = display.y + 8;
  const maxY = display.y + display.height - height - 8;
  const y = Math.min(Math.max(preferredY, minY), Math.max(minY, maxY));

  return { x, y, width, height };
}

function sendTemporaryInfoPayload() {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  temporaryInfoWindow.webContents.send("window:temporaryInfoPayload", temporaryInfoPayload);
}

function positionTemporaryInfoWindow() {
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  const bounds = temporaryInfoWindowBounds();
  if (bounds) temporaryInfoWindow.setBounds(bounds, true);
}

function closeTemporaryInfoWindow() {
  temporaryInfoPayload = null;
  if (!temporaryInfoWindow || temporaryInfoWindow.isDestroyed()) return;
  const windowToClose = temporaryInfoWindow;
  temporaryInfoWindow = null;
  sendTemporaryInfoPanelClosed();
  windowToClose.close();
}

function ensureTemporaryInfoWindow() {
  if (collapsedState || !mainWindow || mainWindow.isDestroyed()) return null;
  if (temporaryInfoWindow && !temporaryInfoWindow.isDestroyed()) return temporaryInfoWindow;

  const bounds = temporaryInfoWindowBounds() ?? { ...temporaryInfoWindowSize };
  temporaryInfoWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    title: "Git Peek Info",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (pinnedState) temporaryInfoWindow.setAlwaysOnTop(true, "floating");
  temporaryInfoWindow.once("ready-to-show", () => {
    positionTemporaryInfoWindow();
    temporaryInfoWindow?.showInactive();
    sendTemporaryInfoPayload();
  });
  temporaryInfoWindow.webContents.on("did-finish-load", sendTemporaryInfoPayload);
  temporaryInfoWindow.on("closed", () => {
    temporaryInfoWindow = null;
    temporaryInfoPayload = null;
    sendTemporaryInfoPanelClosed();
  });
  loadRendererWindow(temporaryInfoWindow, "temporary-info");

  return temporaryInfoWindow;
}

function setTemporaryInfoPanel(payload) {
  if (!payload || collapsedState) {
    closeTemporaryInfoWindow();
    return;
  }

  temporaryInfoPayload = payload;
  const infoWindow = ensureTemporaryInfoWindow();
  if (!infoWindow) return;
  positionTemporaryInfoWindow();
  sendTemporaryInfoPayload();
}

function setPinnedWindow(pinned) {
  if (!mainWindow) return;
  pinnedState = Boolean(pinned);
  mainWindow.setAlwaysOnTop(pinnedState, "floating");
  if (temporaryInfoWindow && !temporaryInfoWindow.isDestroyed()) {
    temporaryInfoWindow.setAlwaysOnTop(pinnedState, "floating");
  }
  buildMenus();
}

function showMainWindow() {
  showDockIcon();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow({ showOnReady: true });
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    showMainWindow();
    return;
  }

  mainWindow.hide();
}

function createWindow({ showOnReady = true } = {}) {
  const appIcon = assets.loadImageAsset("app-icon.png");
  const initialExpandedSize = readExpandedSize(screen.getPrimaryDisplay().workArea);

  mainWindow = new BrowserWindow({
    ...initialExpandedSize,
    minWidth: expandedMinimumSize.width,
    minHeight: expandedMinimumSize.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    icon: appIcon,
    resizable: true,
    title: "Git Peek",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  positionWindow(mainWindow);
  mainWindow.once("ready-to-show", () => {
    if (showOnReady) mainWindow.show();
  });
  mainWindow.on("move", positionTemporaryInfoWindow);
  mainWindow.on("resize", () => {
    scheduleExpandedWindowSizeSave(mainWindow);
    positionTemporaryInfoWindow();
  });
  mainWindow.on("hide", closeTemporaryInfoWindow);
  mainWindow.on("close", (event) => {
    closeTemporaryInfoWindow();
    saveCurrentExpandedWindowSize(mainWindow);
    if (process.platform === "darwin" && !realQuitRequested) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    closeTemporaryInfoWindow();
    clearTimeout(applyingWindowBoundsTimer);
    clearTimeout(expandedWindowSizeSaveTimer);
    mainWindow = null;
  });

  loadRendererWindow(mainWindow);
}

function createTray() {
  const trayIcon = assets.loadImageAsset("tray-iconTemplate.png", { template: process.platform === "darwin" });

  tray = new Tray(trayIcon);
  tray.setToolTip("Git Peek");
  buildMenus();
  tray.on("click", toggleMainWindow);
}

function buildMenus() {
  if (!app.isReady()) return;

  const activeRepository = repositoryPathForAction();
  const hasRepository = Boolean(activeRepository);
  const recentRepositories = readRecentRepositories();
  const openFolderAction = async () => sendSnapshotResponse(await chooseRepository());
  const refreshAction = async () => refreshAndSendSnapshot();
  const openRecentAction = async (repositoryPath) => {
    sendSnapshotResponse(await openRepositoryPath(repositoryPath, normalizeRepositorySwitchView(currentView), "Unable to open the recent working folder."));
  };
  const revealAction = () => {
    const repositoryPath = repositoryPathForAction();
    if (repositoryPath) shell.openPath(repositoryPath);
  };
  const clearAction = () => {
    clearRepositoryPath();
    sendSnapshotResponse(noRepositoryResponse());
    buildMenus();
  };
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
            { label: "Show Git Peek", click: showMainWindow },
            { label: "Hide Git Peek", click: () => mainWindow?.hide() },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { label: "Hide to Menu Bar", accelerator: "CmdOrCtrl+Q", click: softQuitToMenuBar },
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
      label: "View",
      submenu: [
        { label: "Expand Side Peek", accelerator: "CmdOrCtrl+Shift+E", enabled: collapsedState, click: () => setCollapsedWindow(false) },
        { label: "Collapse to Edge Tab", accelerator: "CmdOrCtrl+Shift+C", enabled: !collapsedState, click: () => setCollapsedWindow(true) },
        { label: "Dock to Screen Edge", accelerator: "CmdOrCtrl+Shift+D", click: () => dockWindow(collapsedState) },
        { type: "separator" },
        { label: "Always on Top", type: "checkbox", checked: pinnedState, click: (item) => setPinnedWindow(item.checked) },
        { label: "Follow System Appearance", type: "checkbox", checked: true, enabled: false },
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
        { label: "Show Git Peek", click: showMainWindow },
        { label: "Hide Git Peek", click: () => mainWindow?.hide() },
        { role: "minimize" },
        { role: "close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Git Peek remembers the last working folder", enabled: false },
        { label: "Git-changing actions ask from the panel before running", enabled: false },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (tray) {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Git Peek", click: showMainWindow },
        { label: collapsedState ? "Expand Side Peek" : "Collapse to Edge Tab", click: () => setCollapsedWindow(!collapsedState) },
        { label: "Dock to Screen Edge", click: () => dockWindow(collapsedState) },
        { type: "separator" },
        { label: "Open Working Folder...", click: openFolderAction },
        { label: "Open Recent", submenu: buildRecentRepositorySubmenu() },
        { label: "Refresh Git Data", enabled: hasRepository, click: refreshAction },
        { label: "Reveal Working Folder", enabled: hasRepository, click: revealAction },
        { type: "separator" },
        { label: "Always on Top", type: "checkbox", checked: pinnedState, click: (item) => setPinnedWindow(item.checked) },
        { type: "separator" },
        { label: "Quit Git Peek", click: requestRealQuit },
      ]),
    );
  }
}

app.whenReady().then(() => {
  app.setName("Git Peek");
  nativeTheme.themeSource = "system";
  nativeTheme.on("updated", sendSystemTheme);
  currentRepository = readSavedRepositoryPath();
  const preferences = config.readPreferences();
  if (preferences.launchAtLogin) syncLaunchAtLogin(preferences);
  const startInMenuBar = shouldStartInMenuBar();
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(assets.loadImageAsset("app-icon.png"));
  }
  createTray();
  if (startInMenuBar) hideDockIcon();
  createWindow({ showOnReady: !startInMenuBar });

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("before-quit", (event) => {
  if (process.platform !== "darwin" || realQuitRequested) return;
  event.preventDefault();
  softQuitToMenuBar();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("git:openRepository", async (_event, view) => {
  return chooseRepository(normalizeView(view));
});

ipcMain.handle("git:switchRepository", async (_event, repositoryPath, view) => {
  return openRepositoryPath(repositoryPath, normalizeRepositorySwitchView(view), "Unable to open the saved working folder.");
});

ipcMain.handle("git:getRecentRepositories", () => {
  return readRecentRepositories();
});

ipcMain.handle("git:refresh", async (_event, view) => {
  return getSnapshotResponse(normalizeView(view));
});

ipcMain.handle("git:getSnapshot", async (_event, view) => {
  return getSnapshotResponse(normalizeView(view));
});

ipcMain.handle("git:initializeRepository", async (_event, repositoryPath, view) => {
  try {
    const result = await initializeRepository(repositoryPath, normalizeView(view));
    saveRepositoryPath(result.snapshot.repoPath, result.snapshot.repositoryKey);
    buildMenus();
    sendSnapshotResponse({ ok: true, snapshot: result.snapshot });
    return {
      ok: true,
      message: result.gitIgnoreCreated ? "Initialized Git and added a starter .gitignore." : "Initialized Git and kept the existing .gitignore.",
      snapshot: result.snapshot,
    };
  } catch (error) {
    return errorResponse(error, "Unable to initialize Git in this folder.");
  }
});

ipcMain.handle("git:clearRepository", async () => {
  clearRepositoryPath();
  buildMenus();
  return noRepositoryResponse();
});

ipcMain.handle("git:createBranch", async (_event, branchName, startPoint, view) => {
  const repositoryPath = repositoryPathForAction();
  if (!repositoryPath) return noRepositoryResponse();

  try {
    const snapshot = await createBranch(repositoryPath, branchName, startPoint, normalizeView(view));
    saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
    sendSnapshotResponse({ ok: true, snapshot });
    return { ok: true, message: `Created branch ${branchName}.`, snapshot };
  } catch (error) {
    return errorResponse(error, "Unable to create branch.");
  }
});

ipcMain.handle("git:checkout", async (_event, ref, view) => {
  const repositoryPath = repositoryPathForAction();
  if (!repositoryPath) return noRepositoryResponse();

  try {
    const snapshot = await checkout(repositoryPath, ref, normalizeView(view));
    saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
    sendSnapshotResponse({ ok: true, snapshot });
    return { ok: true, message: `Checked out ${snapshot.branch.name}.`, snapshot };
  } catch (error) {
    return errorResponse(error, "Unable to checkout ref.");
  }
});

ipcMain.handle("git:openWorktree", async (_event, worktreePath, view) => {
  const repositoryPath = repositoryPathForAction();
  if (!repositoryPath) return noRepositoryResponse();

  try {
    const snapshot = await openWorktree(repositoryPath, worktreePath, normalizeView(view));
    currentView = snapshot.view;
    saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
    buildMenus();
    sendSnapshotResponse({ ok: true, snapshot });
    return { ok: true, message: `Opened ${snapshot.branch.detached ? "detached worktree" : `${snapshot.branch.name} worktree`}.`, snapshot };
  } catch (error) {
    return errorResponse(error, "Unable to open worktree.");
  }
});

ipcMain.handle("workspace:open", async (_event, target) => {
  return openWorkspace(repositoryPathForAction(), target);
});

ipcMain.handle("workspace:getAvailableTargets", () => {
  return getAvailableWorkspaceTargets();
});

ipcMain.handle("preferences:get", () => {
  return readPreferences();
});

ipcMain.handle("preferences:save", (_event, preferences) => {
  config.savePreferences(preferences);
  syncLaunchAtLogin(config.readPreferences());
});

ipcMain.handle("window:setCollapsed", (_event, collapsed) => {
  setCollapsedWindow(Boolean(collapsed));
});

ipcMain.handle("window:setPinned", (_event, pinned) => {
  setPinnedWindow(Boolean(pinned));
});

ipcMain.handle("window:dockToEdge", (_event, collapsed) => {
  dockWindow(Boolean(collapsed));
});

ipcMain.handle("window:getTemporaryInfoPayload", () => temporaryInfoPayload);

ipcMain.handle("window:setTemporaryInfoPanel", (_event, payload) => {
  setTemporaryInfoPanel(payload);
});

ipcMain.handle("theme:getSystemTheme", () => getSystemTheme());
