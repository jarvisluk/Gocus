const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, nativeTheme, screen, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow;
let tray;
let currentRepository = null;
let collapsedState = false;
let pinnedState = false;

const expandedSize = { width: 364, height: 780 };
const collapsedSize = { width: 38, height: 154 };

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function saveRepositoryPath(repoPath) {
  writeConfig({ ...readConfig(), repositoryPath: repoPath });
}

function clearRepositoryPath() {
  const config = readConfig();
  delete config.repositoryPath;
  writeConfig(config);
  currentRepository = null;
}

function resolveAssetPath(fileName) {
  const candidates = [
    path.join(__dirname, "..", "assets", fileName),
    path.join(process.resourcesPath ?? "", "assets", fileName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function loadImageAsset(fileName, { template = false } = {}) {
  const image = nativeImage.createFromPath(resolveAssetPath(fileName));
  if (template) image.setTemplateImage(true);
  return image;
}

function runGit(repoPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", repoPath, ...args],
      {
        timeout: options.timeout ?? 10000,
        maxBuffer: options.maxBuffer ?? 1024 * 1024 * 4,
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve(stdout.trimEnd());
      },
    );
  });
}

function safeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBranchLine(line) {
  const clean = line.replace(/^##\s*/, "");
  const result = {
    name: clean,
    upstream: "",
    ahead: 0,
    behind: 0,
    detached: false,
  };

  if (clean.startsWith("HEAD ")) {
    result.name = "detached";
    result.detached = true;
    return result;
  }

  const [branchPart, metaPart = ""] = clean.split("...");
  result.name = branchPart || "main";

  if (metaPart) {
    const upstream = metaPart.replace(/\s*\[.*\]\s*$/, "");
    result.upstream = upstream;

    const aheadMatch = metaPart.match(/ahead\s+(\d+)/);
    const behindMatch = metaPart.match(/behind\s+(\d+)/);
    result.ahead = aheadMatch ? safeInteger(aheadMatch[1]) : 0;
    result.behind = behindMatch ? safeInteger(behindMatch[1]) : 0;
  }

  return result;
}

function parseStatus(shortStatus) {
  const lines = shortStatus.split("\n").filter(Boolean);
  const branchLine = lines[0]?.startsWith("##") ? lines[0] : "## main";
  const fileLines = lines[0]?.startsWith("##") ? lines.slice(1) : lines;
  const counts = { modified: 0, staged: 0, untracked: 0 };
  const files = [];

  for (const line of fileLines) {
    const code = line.slice(0, 2);
    const pathText = line.slice(3).replace(/^.* -> /, "");
    const x = code[0];
    const y = code[1];

    if (code === "??") {
      counts.untracked += 1;
    } else {
      if (x && x !== " ") counts.staged += 1;
      if (y && y !== " ") counts.modified += 1;
    }

    files.push({
      path: pathText,
      status: code.trim() || "M",
      additions: 0,
      deletions: 0,
    });
  }

  return {
    branch: parseBranchLine(branchLine),
    counts,
    files,
  };
}

function applyNumstat(files, output) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const line of output.split("\n").filter(Boolean)) {
    const [insertions, deletions, filePath] = line.split("\t");
    if (!filePath) continue;
    const normalizedPath = filePath.replace(/^.* => /, "");
    const file = byPath.get(normalizedPath) ?? byPath.get(filePath);
    if (!file) continue;
    file.additions += insertions === "-" ? 0 : safeInteger(insertions);
    file.deletions += deletions === "-" ? 0 : safeInteger(deletions);
  }
}

function branchKindFromRefs(refs, index) {
  const lowerRefs = refs.toLowerCase();
  if (lowerRefs.includes("stash")) return "stash";
  if (lowerRefs.includes("release")) return "release";
  if (lowerRefs.includes("develop") || lowerRefs.includes("dev")) return "develop";
  if (lowerRefs.includes("fix") || lowerRefs.includes("hotfix")) return "fix";
  if (lowerRefs.includes("main") || lowerRefs.includes("master")) return "main";
  if (lowerRefs.includes("feature") || lowerRefs.includes("feat")) return "feature";
  return branchKindForIndex(index);
}

function branchKindForIndex(index) {
  return ["main", "develop", "feature", "fix", "release", "remote"][index % 6];
}

function parseRefs(refs) {
  return refs
    .split(",")
    .map((ref) => ref.trim().replace(/^HEAD -> /, "").replace(/^tag:\s*/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeActiveLanes(lanes) {
  const seen = new Set();
  return lanes.filter((lane) => {
    if (!lane?.hash || seen.has(lane.hash)) return false;
    seen.add(lane.hash);
    return true;
  });
}

function buildCommitGraph(commits) {
  const commitsByHash = new Map(commits.map((commit) => [commit.fullHash, commit]));
  let activeLanes = [];

  return commits.map((commit, index) => {
    let column = activeLanes.findIndex((lane) => lane.hash === commit.fullHash);
    const currentContinues = column !== -1;
    if (column === -1) {
      column = activeLanes.length;
      activeLanes.push({ hash: commit.fullHash, color: commit.lane });
    }

    const before = activeLanes.map((lane, laneIndex) => ({
      column: laneIndex,
      hash: lane.hash,
      color: lane.color,
    }));
    const currentColor = activeLanes[column]?.color ?? commit.lane;
    const parents = commit.parents.filter(Boolean);
    const parentEntries = [];
    const bridges = [];
    let after = activeLanes.slice();
    const colorForParent = (parentHash, fallbackColor) => {
      const parentCommit = commitsByHash.get(parentHash);
      return parentCommit?.refs.length ? parentCommit.lane : fallbackColor;
    };

    if (parents.length === 0) {
      after.splice(column, 1);
    } else {
      const firstParent = parents[0];
      const existingFirstParent = after.findIndex((lane, laneIndex) => laneIndex !== column && lane.hash === firstParent);

      if (existingFirstParent >= 0) {
        const color = after[existingFirstParent].color;
        parentEntries.push({ column: existingFirstParent, color });
        bridges.push({ fromColumn: column, toColumn: existingFirstParent, color: currentColor });
        after.splice(column, 1);
      } else {
        const color = colorForParent(firstParent, currentColor);
        after[column] = { hash: firstParent, color };
        parentEntries.push({ column, color });
      }

      parents.slice(1).forEach((parentHash, parentIndex) => {
        let parentColumn = after.findIndex((lane) => lane.hash === parentHash);

        if (parentColumn === -1) {
          const fallbackColor = commit.lane === "stash" ? currentColor : branchKindForIndex(index + parentIndex + 1);
          const color = colorForParent(parentHash, fallbackColor);
          const insertAt = Math.min(after.length, column + parentIndex + 1);
          after.splice(insertAt, 0, { hash: parentHash, color });
          parentColumn = insertAt;
        }

        const color = after[parentColumn].color;
        parentEntries.push({ column: parentColumn, color });
        bridges.push({ fromColumn: column, toColumn: parentColumn, color });
      });
    }

    const afterSnapshot = after.map((lane, laneIndex) => ({
      column: laneIndex,
      hash: lane.hash,
      color: lane.color,
    }));
    const parentColumns = parentEntries.map((parent) => parent.column);
    const maxParentColumn = parentColumns.length ? Math.max(...parentColumns) + 1 : 1;
    const laneCount = Math.max(1, before.length, afterSnapshot.length, column + 1, maxParentColumn);
    const parentStems = parentEntries.filter((parent, parentIndex, entries) => {
      return parent.column === column && entries.findIndex((entry) => entry.column === parent.column) === parentIndex;
    });

    activeLanes = normalizeActiveLanes(after);

    return {
      ...commit,
      graph: {
        column,
        laneCount,
        currentColor,
        currentContinues,
        passThrough: before
          .filter((lane) => lane.column !== column)
          .map((lane) => ({ column: lane.column, color: lane.color })),
        parentStems,
        bridges,
        isMerge: parents.length > 1,
      },
    };
  });
}

function parseLog(rawLog) {
  const commits = rawLog
    .split("\x1e")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const [header, ...statLines] = block.split("\n");
      const [fullHash, hash, parentsText = "", author, relativeTime, subject, refs = ""] = header.split("\x1f");
      let additions = 0;
      let deletions = 0;
      let filesChanged = 0;

      for (const line of statLines) {
        const [insertions, removed] = line.split("\t");
        if (!insertions || !removed) continue;
        additions += insertions === "-" ? 0 : safeInteger(insertions);
        deletions += removed === "-" ? 0 : safeInteger(removed);
        filesChanged += 1;
      }

      return {
        id: fullHash,
        fullHash,
        hash,
        title: subject || "Untitled commit",
        author: author || "Unknown",
        relativeTime: relativeTime || "",
        additions,
        deletions,
        filesChanged,
        parents: parentsText.split(" ").filter(Boolean),
        refs: parseRefs(refs),
        lane: branchKindFromRefs(refs, index),
      };
    });

  return buildCommitGraph(commits);
}

async function readGitSnapshot(repoPath) {
  const root = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const shortStatus = await runGit(root, ["status", "--porcelain=v1", "-b"]);
  const status = parseStatus(shortStatus);

  const [unstagedStats, stagedStats, logRaw] = await Promise.all([
    runGit(root, ["diff", "--numstat"]).catch(() => ""),
    runGit(root, ["diff", "--cached", "--numstat"]).catch(() => ""),
    runGit(root, [
      "log",
      "--topo-order",
      "--all",
      "--date=relative",
      "--pretty=format:%x1e%H%x1f%h%x1f%P%x1f%an%x1f%ar%x1f%s%x1f%D",
      "--numstat",
    ], { maxBuffer: 1024 * 1024 * 64 }).catch(() => ""),
  ]);

  applyNumstat(status.files, unstagedStats);
  applyNumstat(status.files, stagedStats);

  const rootName = path.basename(root);
  currentRepository = root;

  return {
    repoPath: root,
    repoName: rootName,
    branch: status.branch,
    counts: status.counts,
    commits: parseLog(logRaw),
    changedFiles: status.files.slice(0, 8),
    lastFetchedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    isSample: false,
  };
}

function readSavedRepositoryPath() {
  const repositoryPath = readConfig().repositoryPath;
  return typeof repositoryPath === "string" && repositoryPath ? repositoryPath : null;
}

function noRepositoryResponse() {
  return {
    ok: false,
    reason: "not_configured",
    error: "Choose a working folder to start tracking Git changes.",
  };
}

async function getSnapshotResponse() {
  if (!currentRepository) currentRepository = readSavedRepositoryPath();
  if (!currentRepository) return noRepositoryResponse();

  try {
    const snapshot = await readGitSnapshot(currentRepository);
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

async function chooseRepository() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Working Folder",
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, canceled: true };
  }

  try {
    const snapshot = await readGitSnapshot(result.filePaths[0]);
    saveRepositoryPath(snapshot.repoPath);
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

function positionWindow(win, collapsed = false) {
  const display = screen.getPrimaryDisplay().workArea;
  const size = collapsed ? collapsedSize : expandedSize;
  win.setMinimumSize(collapsed ? collapsedSize.width : 320, collapsed ? collapsedSize.height : 620);
  const current = win.getBounds();
  const edgeInset = collapsed ? 0 : 10;
  const x = display.x + display.width - size.width - edgeInset;
  const fallbackY = display.y + Math.max(18, Math.floor((display.height - size.height) / 2));
  const requestedY = current?.y ?? fallbackY;
  const minY = display.y + 8;
  const maxY = display.y + display.height - size.height - 8;
  const y = Math.min(Math.max(requestedY, minY), Math.max(minY, maxY));
  win.setBounds({ x, y, width: size.width, height: size.height }, true);
}

function setCollapsedWindow(collapsed) {
  if (!mainWindow) return;
  collapsedState = Boolean(collapsed);
  positionWindow(mainWindow, collapsedState);
  mainWindow.webContents.send("window:collapsedChanged", collapsedState);
  buildMenus();
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
  const appIcon = loadImageAsset("app-icon.png");

  mainWindow = new BrowserWindow({
    ...expandedSize,
    minWidth: 320,
    minHeight: 620,
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
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }
}

function createTray() {
  const trayIcon = loadImageAsset("tray-iconTemplate.png", { template: process.platform === "darwin" });

  tray = new Tray(trayIcon);
  tray.setToolTip("Git Peek");
  buildMenus();
  tray.on("click", toggleMainWindow);
}

function buildMenus() {
  if (!app.isReady()) return;

  const hasRepository = Boolean(currentRepository || readSavedRepositoryPath());
  const openFolderAction = async () => sendSnapshotResponse(await chooseRepository());
  const refreshAction = async () => refreshAndSendSnapshot();
  const revealAction = () => {
    const repositoryPath = currentRepository || readSavedRepositoryPath();
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
        { label: "Dock to Screen Edge", accelerator: "CmdOrCtrl+Shift+D", click: () => positionWindow(mainWindow, collapsedState) },
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
        { label: "No Git-changing action runs without confirmation", enabled: false },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (tray) {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Git Peek", click: showMainWindow },
        { label: collapsedState ? "Expand Side Peek" : "Collapse to Edge Tab", click: () => setCollapsedWindow(!collapsedState) },
        { label: "Dock to Screen Edge", click: () => positionWindow(mainWindow, collapsedState) },
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
    app.dock.setIcon(loadImageAsset("app-icon.png"));
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

ipcMain.handle("git:openRepository", async () => {
  return chooseRepository();
});

ipcMain.handle("git:refresh", async () => {
  return getSnapshotResponse();
});

ipcMain.handle("git:getSnapshot", async () => {
  return getSnapshotResponse();
});

ipcMain.handle("git:clearRepository", async () => {
  clearRepositoryPath();
  buildMenus();
  return noRepositoryResponse();
});

ipcMain.handle("window:setCollapsed", (_event, collapsed) => {
  setCollapsedWindow(Boolean(collapsed));
});

ipcMain.handle("window:setPinned", (_event, pinned) => {
  setPinnedWindow(Boolean(pinned));
});

ipcMain.handle("window:dockToEdge", (_event, collapsed) => {
  if (!mainWindow) return;
  positionWindow(mainWindow, Boolean(collapsed));
});

ipcMain.handle("theme:getSystemTheme", () => getSystemTheme());
