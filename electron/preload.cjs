const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gitPeek", {
  openRepository: () => ipcRenderer.invoke("git:openRepository"),
  refresh: () => ipcRenderer.invoke("git:refresh"),
  getSnapshot: () => ipcRenderer.invoke("git:getSnapshot"),
  clearRepository: () => ipcRenderer.invoke("git:clearRepository"),
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
