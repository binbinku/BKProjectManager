const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workspaceAPI', {
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('app:menu-action', listener);
    return () => ipcRenderer.removeListener('app:menu-action', listener);
  },
  getOpenerInfo: () => ipcRenderer.invoke('settings:opener-info'),
  openWorkbench: (id) => ipcRenderer.invoke('workbench:open', id),
  closeWorkbench: (id) => ipcRenderer.invoke('workbench:close', id),
  listProjectFiles: (id, relative) => ipcRenderer.invoke('workbench:list', id, relative),
  readProjectFile: (id, relative) => ipcRenderer.invoke('workbench:read', id, relative),
  startTerminal: (id, cols, rows) => ipcRenderer.invoke('terminal:start', id, cols, rows),
  writeTerminal: (id, terminalId, data) =>
    ipcRenderer.invoke('terminal:input', id, terminalId, data),
  resizeTerminal: (id, terminalId, cols, rows) =>
    ipcRenderer.invoke('terminal:resize', id, terminalId, cols, rows),
  acknowledgeTerminal: (id, terminalId, length) =>
    ipcRenderer.invoke('terminal:acknowledge', id, terminalId, length),
  stopTerminal: (id, terminalId) => ipcRenderer.invoke('terminal:stop', id, terminalId),
  onTerminalEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:event', listener);
    return () => ipcRenderer.removeListener('terminal:event', listener);
  },
  getState: () => ipcRenderer.invoke('workspace:state'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  scan: () => ipcRenderer.invoke('workspace:scan'),
  removeItem: (kind, key) => ipcRenderer.invoke('item:remove', kind, key),
  restoreItem: (kind, key) => ipcRenderer.invoke('item:restore', kind, key),
  revealItem: (kind, key) => ipcRenderer.invoke('item:reveal', kind, key),
  createCategory: (name, style) => ipcRenderer.invoke('category:create', name, style),
  setCategoryStyle: (category, style) => ipcRenderer.invoke('category:style', category, style),
  createProject: (category, name) => ipcRenderer.invoke('project:create', category, name),
  toggleFavorite: (id) => ipcRenderer.invoke('project:favorite', id),
  openProject: (id, action) => ipcRenderer.invoke('project:open', id, action),
  setOpener: (value) => ipcRenderer.invoke('settings:opener', value),
  setTheme: (value) => ipcRenderer.invoke('settings:theme', value),
  chooseEditor: () => ipcRenderer.invoke('settings:editor'),
  platform: process.platform,
});
