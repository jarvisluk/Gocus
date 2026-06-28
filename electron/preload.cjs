const { contextBridge, ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.platform = process.platform;
});

contextBridge.exposeInMainWorld("gocus", {
  openRepository: (view) => ipcRenderer.invoke("git:openRepository", view),
  switchRepository: (repositoryPath, view) => ipcRenderer.invoke("git:switchRepository", repositoryPath, view),
  getRecentRepositories: () => ipcRenderer.invoke("git:getRecentRepositories"),
  refresh: (view) => ipcRenderer.invoke("git:refresh", view),
  getSnapshot: (view) => ipcRenderer.invoke("git:getSnapshot", view),
  clearRepository: () => ipcRenderer.invoke("git:clearRepository"),
  initializeRepository: (repositoryPath, view) => ipcRenderer.invoke("git:initializeRepository", repositoryPath, view),
  createBranch: (branchName, startPoint, view) => ipcRenderer.invoke("git:createBranch", branchName, startPoint, view),
  merge: (ref, targetBranch, view, options) => ipcRenderer.invoke("git:merge", ref, targetBranch, view, options),
  checkout: (ref, view) => ipcRenderer.invoke("git:checkout", ref, view),
  openWorktree: (worktreePath, view) => ipcRenderer.invoke("git:openWorktree", worktreePath, view),
  cleanupWorktree: (worktreePath, view) => ipcRenderer.invoke("git:cleanupWorktree", worktreePath, view),
  openWorkspace: (target) => ipcRenderer.invoke("workspace:open", target),
  openWorkspaceFile: (target, filePath) => ipcRenderer.invoke("workspace:openFile", target, filePath),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  getAvailableWorkspaceTargets: () => ipcRenderer.invoke("workspace:getAvailableTargets"),
  getActiveWorkspaceTarget: () => ipcRenderer.invoke("workspace:getActiveTarget"),
  setActiveWorkspaceTarget: (target) => ipcRenderer.invoke("workspace:setActiveTarget", target),
  openWorkspaceFileMenu: (payload) => ipcRenderer.invoke("workspace:openFileMenu", payload),
  openGitHubReleases: () => ipcRenderer.invoke("app:openGitHubReleases"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  savePreferences: (preferences) => ipcRenderer.invoke("preferences:save", preferences),
  setCollapsed: (collapsed) => ipcRenderer.invoke("window:setCollapsed", collapsed),
  setCollapsedRailHeight: (height) => ipcRenderer.invoke("window:setCollapsedRailHeight", height),
  getPinned: () => ipcRenderer.invoke("window:getPinned"),
  setPinned: (pinned) => ipcRenderer.invoke("window:setPinned", pinned),
  dockToEdge: (collapsed) => ipcRenderer.invoke("window:dockToEdge", collapsed),
  getTemporaryInfoPayload: () => ipcRenderer.invoke("window:getTemporaryInfoPayload"),
  setTemporaryInfoPanel: (payload) => ipcRenderer.invoke("window:setTemporaryInfoPanel", payload),
  getChangedFileInfoPayload: () => ipcRenderer.invoke("window:getChangedFileInfoPayload"),
  setChangedFileInfoPanel: (payload) => ipcRenderer.invoke("window:setChangedFileInfoPanel", payload),
  getCommitInfoPayload: () => ipcRenderer.invoke("window:getCommitInfoPayload"),
  setCommitInfoPanel: (payload) => ipcRenderer.invoke("window:setCommitInfoPanel", payload),
  holdCommitInfoPanelInteraction: (durationMs) => ipcRenderer.invoke("window:holdCommitInfoPanelInteraction", durationMs),
  isCommitInfoPanelActive: () => ipcRenderer.invoke("window:isCommitInfoPanelActive"),
  setCommitInfoPanelHeight: (height) => ipcRenderer.invoke("window:setCommitInfoPanelHeight", height),
  copyText: (text) => ipcRenderer.invoke("clipboard:writeText", text),
  readText: () => ipcRenderer.invoke("clipboard:readText"),
  getSystemTheme: () => ipcRenderer.invoke("theme:getSystemTheme"),
  onTemporaryInfoPayloadUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("window:temporaryInfoPayload", handler);
    return () => ipcRenderer.removeListener("window:temporaryInfoPayload", handler);
  },
  onTemporaryInfoPanelClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("window:temporaryInfoPanelClosed", handler);
    return () => ipcRenderer.removeListener("window:temporaryInfoPanelClosed", handler);
  },
  onChangedFileInfoPayloadUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("window:changedFileInfoPayload", handler);
    return () => ipcRenderer.removeListener("window:changedFileInfoPayload", handler);
  },
  onChangedFileInfoPanelClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("window:changedFileInfoPanelClosed", handler);
    return () => ipcRenderer.removeListener("window:changedFileInfoPanelClosed", handler);
  },
  onCommitInfoPayloadUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("window:commitInfoPayload", handler);
    return () => ipcRenderer.removeListener("window:commitInfoPayload", handler);
  },
  onCommitInfoPanelClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("window:commitInfoPanelClosed", handler);
    return () => ipcRenderer.removeListener("window:commitInfoPanelClosed", handler);
  },
  onThemeChanged: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on("theme:changed", handler);
    return () => ipcRenderer.removeListener("theme:changed", handler);
  },
  onPreferencesChanged: (callback) => {
    const handler = (_event, preferences) => callback(preferences);
    ipcRenderer.on("preferences:changed", handler);
    return () => ipcRenderer.removeListener("preferences:changed", handler);
  },
  onActiveWorkspaceTargetChanged: (callback) => {
    const handler = (_event, target) => callback(target);
    ipcRenderer.on("workspace:activeTargetChanged", handler);
    return () => ipcRenderer.removeListener("workspace:activeTargetChanged", handler);
  },
  onSnapshotUpdated: (callback) => {
    const handler = (_event, response) => callback(response);
    ipcRenderer.on("git:snapshotUpdated", handler);
    return () => ipcRenderer.removeListener("git:snapshotUpdated", handler);
  },
  onCollapsedChanged: (callback) => {
    const handler = (_event, collapsed) => callback(collapsed);
    ipcRenderer.on("window:collapsedChanged", handler);
    return () => ipcRenderer.removeListener("window:collapsedChanged", handler);
  },
  onPinnedChanged: (callback) => {
    const handler = (_event, pinned) => callback(pinned);
    ipcRenderer.on("window:pinnedChanged", handler);
    return () => ipcRenderer.removeListener("window:pinnedChanged", handler);
  },
  onRepositoryDialogOpenChanged: (callback) => {
    const handler = (_event, open) => callback(open);
    ipcRenderer.on("window:repositoryDialogOpenChanged", handler);
    return () => ipcRenderer.removeListener("window:repositoryDialogOpenChanged", handler);
  },
});
