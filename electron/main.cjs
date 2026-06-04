const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, nativeTheme, screen, shell } = require("electron");
const path = require("node:path");
const { createAssetLoader } = require("./lib/assets.cjs");
const { createConfigStore } = require("./lib/config.cjs");
const { checkout, createBranch, normalizeView, openWorktree, readGitSnapshot } = require("./lib/git.cjs");
const { openWorkspace } = require("./lib/workspace.cjs");

let mainWindow;
let tray;
let currentRepository = null;
let collapsedState = false;
let pinnedState = false;
let currentView = { mode: "auto" };
let applyingWindowBounds = false;
let applyingWindowBoundsTimer = null;
let expandedWindowSizeSaveTimer = null;

const expandedMinimumSize = { width: 320, height: 620 };
const defaultExpandedSize = { width: expandedMinimumSize.width, height: 780 };
const collapsedSize = { width: 38, height: 154 };
const config = createConfigStore(app);
const assets = createAssetLoader({
  nativeImage,
  resourcesPath: process.resourcesPath,
  electronDir: __dirname,
});

function saveRepositoryPath(repoPath) {
  config.saveRepositoryPath(repoPath);
  currentRepository = repoPath;
}

function readSavedRepositoryPath() {
  return config.readRepositoryPath();
}

function clearRepositoryPath() {
  config.clearRepositoryPath();
  currentRepository = null;
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

async function getSnapshotResponse(view = currentView) {
  const nextView = normalizeView(view);
  currentView = nextView;
  if (!currentRepository) currentRepository = readSavedRepositoryPath();
  if (!currentRepository) return noRepositoryResponse();

  try {
    const snapshot = await readGitSnapshot(currentRepository, nextView);
    saveRepositoryPath(snapshot.repoPath);
    buildMenus();
    return { ok: true, snapshot };
  } catch (error) {
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

  try {
    const snapshot = await readGitSnapshot(result.filePaths[0], view);
    saveRepositoryPath(snapshot.repoPath);
    currentView = snapshot.view;
    buildMenus();
    return { ok: true, snapshot };
  } catch (error) {
    return {
      ok: false,
      reason: "invalid_repository",
      error: error.stderr || error.message || "The selected folder is not a readable Git repository.",
    };
  }
}

function sendSnapshotResponse(response) {
  mainWindow?.webContents.send("git:snapshotUpdated", response);
}

function sendRepositoryDialogOpen(open) {
  mainWindow?.webContents.send("window:repositoryDialogOpenChanged", open);
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
  collapsedState = nextCollapsedState;
  positionWindow(mainWindow, collapsedState);
  mainWindow.webContents.send("window:collapsedChanged", collapsedState);
  buildMenus();
}

function dockWindow(collapsed = collapsedState) {
  if (!mainWindow) return;
  if (!collapsed) saveCurrentExpandedWindowSize(mainWindow);
  positionWindow(mainWindow, collapsed);
}

function setPinnedWindow(pinned) {
  if (!mainWindow) return;
  pinnedState = Boolean(pinned);
  mainWindow.setAlwaysOnTop(pinnedState, "floating");
  buildMenus();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
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

function createWindow() {
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
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("resize", () => scheduleExpandedWindowSizeSave(mainWindow));
  mainWindow.on("close", () => saveCurrentExpandedWindowSize(mainWindow));
  mainWindow.on("closed", () => {
    clearTimeout(applyingWindowBoundsTimer);
    clearTimeout(expandedWindowSizeSaveTimer);
    mainWindow = null;
  });

  if (process.env.GIT_PEEK_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.GIT_PEEK_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
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

  const hasRepository = Boolean(repositoryPathForAction());
  const openFolderAction = async () => sendSnapshotResponse(await chooseRepository());
  const refreshAction = async () => refreshAndSendSnapshot();
  const revealAction = () => {
    const repositoryPath = repositoryPathForAction();
    if (repositoryPath) shell.openPath(repositoryPath);
  };
  const clearAction = () => {
    clearRepositoryPath();
    sendSnapshotResponse(noRepositoryResponse());
    buildMenus();
  };

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
            { role: "quit" },
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
        { label: "Refresh Git Data", enabled: hasRepository, click: refreshAction },
        { label: "Reveal Working Folder", enabled: hasRepository, click: revealAction },
        { type: "separator" },
        { label: "Always on Top", type: "checkbox", checked: pinnedState, click: (item) => setPinnedWindow(item.checked) },
        { type: "separator" },
        { label: "Quit Git Peek", role: "quit" },
      ]),
    );
  }
}

app.whenReady().then(() => {
  app.setName("Git Peek");
  nativeTheme.themeSource = "system";
  nativeTheme.on("updated", sendSystemTheme);
  currentRepository = readSavedRepositoryPath();
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(assets.loadImageAsset("app-icon.png"));
  }
  createTray();
  createWindow();

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("git:openRepository", async (_event, view) => {
  return chooseRepository(normalizeView(view));
});

ipcMain.handle("git:refresh", async (_event, view) => {
  return getSnapshotResponse(normalizeView(view));
});

ipcMain.handle("git:getSnapshot", async (_event, view) => {
  return getSnapshotResponse(normalizeView(view));
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
    saveRepositoryPath(snapshot.repoPath);
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
    saveRepositoryPath(snapshot.repoPath);
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
    saveRepositoryPath(snapshot.repoPath);
    buildMenus();
    sendSnapshotResponse({ ok: true, snapshot });
    return { ok: true, message: `Opened ${snapshot.branch.detached ? "detached worktree" : snapshot.repoName}.`, snapshot };
  } catch (error) {
    return errorResponse(error, "Unable to open worktree.");
  }
});

ipcMain.handle("workspace:open", async (_event, target) => {
  return openWorkspace(repositoryPathForAction(), target);
});

ipcMain.handle("preferences:get", () => {
  return config.readPreferences();
});

ipcMain.handle("preferences:save", (_event, preferences) => {
  config.savePreferences(preferences);
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

ipcMain.handle("theme:getSystemTheme", () => getSystemTheme());
