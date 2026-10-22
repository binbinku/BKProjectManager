const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workspaceAPI', {
  getState: () => ipcRenderer.invoke('workspace:state'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  scan: () => ipcRenderer.invoke('workspace:scan'),
  toggleFavorite: (id) => ipcRenderer.invoke('project:favorite', id),
  openProject: (id, action) => ipcRenderer.invoke('project:open', id, action),
  setOpener: (value) => ipcRenderer.invoke('settings:opener', value),
  setTheme: (value) => ipcRenderer.invoke('settings:theme', value),
  chooseEditor: () => ipcRenderer.invoke('settings:editor'),
  platform: process.platform,
});
