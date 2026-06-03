const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gitPeek", {
  openRepository: (view) => ipcRenderer.invoke("git:openRepository", view),
  refresh: (view) => ipcRenderer.invoke("git:refresh", view),
  getSnapshot: (view) => ipcRenderer.invoke("git:getSnapshot", view),
  clearRepository: () => ipcRenderer.invoke("git:clearRepository"),
  createBranch: (branchName, startPoint, view) => ipcRenderer.invoke("git:createBranch", branchName, startPoint, view),
  checkout: (ref, view) => ipcRenderer.invoke("git:checkout", ref, view),
  openWorkspace: (target) => ipcRenderer.invoke("workspace:open", target),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  savePreferences: (preferences) => ipcRenderer.invoke("preferences:save", preferences),
  setCollapsed: (collapsed) => ipcRenderer.invoke("window:setCollapsed", collapsed),
  setPinned: (pinned) => ipcRenderer.invoke("window:setPinned", pinned),
  dockToEdge: (collapsed) => ipcRenderer.invoke("window:dockToEdge", collapsed),
  getSystemTheme: () => ipcRenderer.invoke("theme:getSystemTheme"),
  onThemeChanged: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on("theme:changed", handler);
    return () => ipcRenderer.removeListener("theme:changed", handler);
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
});
