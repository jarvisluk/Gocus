function registerIpcHandlers({
  buildMenus,
  checkout,
  chooseRepository,
  clearRepositoryPath,
  clipboard,
  config,
  createBranch,
  dockWindow,
  errorResponse,
  getAvailableWorkspaceTargets,
  getPinnedState,
  getCommitInfoPayload,
  getSnapshotResponse,
  getSystemTheme,
  getTemporaryInfoPayload,
  initializeRepository,
  ipcMain,
  merge,
  noRepositoryResponse,
  normalizeRepositorySwitchView,
  normalizeView,
  openRepositoryPath,
  openWorkspace,
  openWorkspaceFile,
  openWorktree,
  readPreferences,
  readRecentRepositories,
  repositoryPathForAction,
  saveRepositoryPath,
  sendPreferences,
  sendSnapshotResponse,
  setCollapsedRailHeight,
  setCollapsedWindow,
  setCommitInfoPanel,
  setCurrentView,
  setPinnedWindow,
  setTemporaryInfoPanel,
  syncLaunchAtLogin,
  syncMenuBarIcon,
}) {
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
        message: result.gitIgnoreCreated
          ? "Initialized Git and added a starter .gitignore."
          : "Initialized Git and kept the existing .gitignore.",
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

  ipcMain.handle("git:merge", async (_event, ref, targetBranch, view, options) => {
    const repositoryPath = repositoryPathForAction();
    if (!repositoryPath) return noRepositoryResponse();
    const normalizedView = normalizeView(view);

    try {
      const snapshot = await merge(repositoryPath, ref, targetBranch, normalizedView, options);
      saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
      sendSnapshotResponse({ ok: true, snapshot });
      return { ok: true, message: `Merged into ${targetBranch}.`, snapshot };
    } catch (error) {
      const response = errorResponse(error, "Unable to merge ref.");
      const snapshotResponse = await getSnapshotResponse(normalizedView);
      if (!snapshotResponse.ok) return response;

      sendSnapshotResponse(snapshotResponse);
      return { ...response, snapshot: snapshotResponse.snapshot };
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
      setCurrentView(snapshot.view);
      saveRepositoryPath(snapshot.repoPath, snapshot.repositoryKey);
      buildMenus();
      sendSnapshotResponse({ ok: true, snapshot });
      return {
        ok: true,
        message: `Opened ${snapshot.branch.detached ? "detached worktree" : `${snapshot.branch.name} worktree`}.`,
        snapshot,
      };
    } catch (error) {
      return errorResponse(error, "Unable to open worktree.");
    }
  });

  ipcMain.handle("workspace:open", async (_event, target) => {
    return openWorkspace(repositoryPathForAction(), target);
  });

  ipcMain.handle("workspace:openFile", async (_event, target, filePath) => {
    return openWorkspaceFile(repositoryPathForAction(), target, filePath);
  });

  ipcMain.handle("workspace:getAvailableTargets", () => {
    return getAvailableWorkspaceTargets();
  });

  ipcMain.handle("preferences:get", () => {
    return readPreferences();
  });

  ipcMain.handle("preferences:save", (_event, preferences) => {
    const previousEffectivePreferences = readPreferences();
    const previousConfigPreferences = config.readPreferences();
    config.savePreferences(preferences);
    const savedConfigPreferences = config.readPreferences();
    const sideEffects = preferencesSaveSideEffects(
      previousEffectivePreferences,
      previousConfigPreferences,
      savedConfigPreferences,
    );

    if (sideEffects.syncLaunchAtLogin) syncLaunchAtLogin(savedConfigPreferences);
    if (sideEffects.syncMenuBarIcon) syncMenuBarIcon(savedConfigPreferences);

    const savedPreferences = readPreferences();
    sendPreferences(savedPreferences);
  });

  ipcMain.handle("window:setCollapsed", (_event, collapsed) => {
    setCollapsedWindow(Boolean(collapsed));
  });

  ipcMain.handle("window:setCollapsedRailHeight", (_event, height) => {
    setCollapsedRailHeight(height);
  });

  ipcMain.handle("window:setPinned", (_event, pinned) => {
    setPinnedWindow(Boolean(pinned));
  });

  ipcMain.handle("window:getPinned", () => getPinnedState());

  ipcMain.handle("window:dockToEdge", (_event, collapsed) => {
    dockWindow(Boolean(collapsed));
  });

  ipcMain.handle("window:getTemporaryInfoPayload", () => getTemporaryInfoPayload());

  ipcMain.handle("window:setTemporaryInfoPanel", (_event, payload) => {
    setTemporaryInfoPanel(payload);
  });

  ipcMain.handle("window:getCommitInfoPayload", () => getCommitInfoPayload());

  ipcMain.handle("window:setCommitInfoPanel", (_event, payload) => {
    setCommitInfoPanel(payload);
  });

  ipcMain.handle("clipboard:writeText", (_event, text) => {
    clipboard.writeText(typeof text === "string" ? text : "");
  });

  ipcMain.handle("theme:getSystemTheme", () => getSystemTheme());
}

function preferencesSaveSideEffects(previousEffectivePreferences, previousConfigPreferences, savedConfigPreferences) {
  return {
    syncLaunchAtLogin: Boolean(previousEffectivePreferences.launchAtLogin) !== Boolean(savedConfigPreferences.launchAtLogin),
    syncMenuBarIcon: Boolean(previousConfigPreferences.showMenuBarIcon) !== Boolean(savedConfigPreferences.showMenuBarIcon),
  };
}

module.exports = {
  preferencesSaveSideEffects,
  registerIpcHandlers,
};
