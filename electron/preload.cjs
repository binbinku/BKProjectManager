const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workspaceAPI', {
  getWindowState: () => ipcRenderer.invoke('window:state'),
  controlWindow: (action) => ipcRenderer.invoke('window:control', action),
  onWindowStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:state-changed', listener);
    return () => ipcRenderer.removeListener('window:state-changed', listener);
  },
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('app:state-changed', listener);
    return () => ipcRenderer.removeListener('app:state-changed', listener);
  },
  getCurrentWorkbench: () => ipcRenderer.invoke('workbench:current'),
  focusWorkbench: (id) => ipcRenderer.invoke('workbench:focus', id),
  showManager: () => ipcRenderer.invoke('manager:show'),
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
  saveMarkdown: (id, relative, content, revision) =>
    ipcRenderer.invoke('workbench:save-markdown', id, relative, content, revision),
  setMarkdownDirty: (id, dirty) => ipcRenderer.invoke('workbench:markdown-dirty', id, dirty),
  confirmMarkdownChanges: (id, relative) =>
    ipcRenderer.invoke('workbench:confirm-markdown', id, relative),
  openMarkdownLink: (id, url) => ipcRenderer.invoke('workbench:open-link', id, url),
  resolveWorkbenchClose: (id, approved) =>
    ipcRenderer.invoke('workbench:resolve-close', id, approved),
  onWorkbenchCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('workbench:close-request', listener);
    return () => ipcRenderer.removeListener('workbench:close-request', listener);
  },
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
  openGitHub: (id) => ipcRenderer.invoke('project:github', id),
  setOpener: (value) => ipcRenderer.invoke('settings:opener', value),
  setTheme: (value) => ipcRenderer.invoke('settings:theme', value),
  setGlassMode: (value) => ipcRenderer.invoke('settings:glass-mode', value),
  setGlassTransparency: (value) => ipcRenderer.invoke('settings:glass-transparency', value),
  setPalette: (value) => ipcRenderer.invoke('settings:palette', value),
  chooseEditor: () => ipcRenderer.invoke('settings:editor'),
  platform: process.platform,
});
