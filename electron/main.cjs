const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { scanWorkspace } = require('./scanner.cjs');
const { Store } = require('./store.cjs');
const { Workbench } = require('./workbench.cjs');
const { macAppIcon } = require('./app-icon.cjs');
const management = require('./workspace-management.cjs');
const palettes = require('./palettes.json');
const {
  emptyVisibility,
  getVisibility,
  visibleSnapshot,
  saveVisibility,
} = require('./visibility.cjs');

app.setName('BK Project Manager');
const appIcon = path.join(
  __dirname,
  '../build',
  process.platform === 'darwin' ? 'icon-mac.png' : 'icon.png',
);
if (process.platform === 'win32') app.setAppUserModelId('com.bk.projectmanager');
if (process.env.BKPM_USER_DATA) app.setPath('userData', process.env.BKPM_USER_DATA);
let window,
  store,
  snapshot = null;
let scanJob;
let workbench;
let pendingSettings = false;
let workspaceQueue = Promise.resolve();
function workspaceTask(task) {
  const job = workspaceQueue.then(task, task);
  workspaceQueue = job.catch(() => {});
  return job;
}
async function saveCategoryStyle(workspace, category, style) {
  const previous = store.data.categoryStyles;
  store.data.categoryStyles = {
    ...previous,
    [workspace]: { ...previous[workspace], [category]: style },
  };
  try {
    await store.save();
  } catch (error) {
    store.data.categoryStyles = previous;
    throw error;
  }
}
function menuAction(action) {
  if (!window || window.isDestroyed()) {
    if (action === 'settings') {
      pendingSettings = true;
      createWindow();
    }
    return;
  }
  window.show();
  window.focus();
  window.webContents.send('app:menu-action', action);
}
function createMenu() {
  const settings = {
    id: 'settings',
    label: '设置…',
    accelerator: 'CmdOrCtrl+,',
    click: () => menuAction('settings'),
  };
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin'
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' },
                { type: 'separator' },
                settings,
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
              ],
            },
          ]
        : []),
      {
        label: '文件',
        submenu: [
          ...(process.platform === 'darwin' ? [] : [settings, { type: 'separator' }]),
          { role: process.platform === 'darwin' ? 'close' : 'quit' },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: '查看',
        submenu: [
          {
            id: 'refresh-files',
            label: '刷新文件目录',
            accelerator: 'CmdOrCtrl+R',
            click: () => menuAction('refresh-files'),
          },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: '终端',
        submenu: [
          { id: 'terminal-clear', label: '清空终端', click: () => menuAction('terminal-clear') },
          {
            id: 'terminal-restart',
            label: '重新启动终端',
            click: () => menuAction('terminal-restart'),
          },
        ],
      },
      { role: 'windowMenu' },
    ]),
  );
}
async function scan() {
  if (!store.data.workspace) return null;
  if (!scanJob)
    scanJob = scanWorkspace(store.data.workspace)
      .then((result) => {
        snapshot = result;
        return result;
      })
      .finally(() => {
        scanJob = null;
      });
  return scanJob;
}
function state() {
  return { settings: store.data, snapshot: visibleSnapshot(snapshot, getVisibility(store.data)) };
}
async function removeItem(kind, key, reveal = false) {
  const visible = state().snapshot;
  if (!store.data.workspace || !visible) throw new Error('请先选择工作空间');
  const current = getVisibility(store.data);
  let next, target;
  if (kind === 'category' && visible.categories.includes(key)) {
    next = { ...current, categories: [...current.categories, key] };
    target = path.join(visible.workspace, key);
  } else if (kind === 'project') {
    const project = visible.projects.find((item) => item.id === key);
    if (!project) throw new Error('项目已不存在或已移除，请重新扫描');
    next = { ...current, projects: [...current.projects, project.relativePath] };
    target = project.path;
  } else throw new Error('分类已不存在、已移除或操作无效');
  if (reveal) {
    try {
      if (!(await fs.stat(target)).isDirectory()) throw new Error();
    } catch {
      throw new Error('文件夹已移动或删除，请重新扫描');
    }
  }
  await saveVisibility(store, next);
  if (reveal) shell.showItemInFolder(target);
  return state();
}
function windowBackground() {
  return palettes[store?.data.palette ?? 'default'].colors[
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  ].canvas;
}
function applyTheme(theme) {
  nativeTheme.themeSource = theme;
  if (window && !window.isDestroyed()) window.setBackgroundColor(windowBackground());
}
function run(executable, args, waitForExit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      detached: !waitForExit,
      stdio: 'ignore',
      shell: false,
    });
    child.once('error', reject);
    if (waitForExit)
      child.once('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('应用打开失败，请检查编辑器或终端是否可用')),
      );
    else
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
  });
}
async function editorPath(opener) {
  if (opener === 'custom') {
    if (!store.data.customEditor) throw new Error('请先在设置中选择编辑器');
    return store.data.customEditor;
  }
  const appName = opener === 'vscode' ? 'Visual Studio Code' : 'Cursor';
  const candidates =
    process.platform === 'darwin'
      ? [`/Applications/${appName}.app`, path.join(os.homedir(), 'Applications', `${appName}.app`)]
      : opener === 'vscode'
        ? [
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
            path.join(
              process.env.ProgramFiles || 'C:\\Program Files',
              'Microsoft VS Code',
              'Code.exe',
            ),
          ]
        : [
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe'),
            path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Cursor', 'Cursor.exe'),
          ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error(`未找到 ${appName}，请在设置中选择编辑器程序`);
}
function registerHandlers() {
  const handlers = {
    'settings:opener-info': async () => {
      const opener = store.data.opener;
      const name =
        opener === 'folder'
          ? process.platform === 'darwin'
            ? 'Finder'
            : '文件资源管理器'
          : opener === 'vscode'
            ? 'VS Code'
            : opener === 'cursor'
              ? 'Cursor'
              : path
                  .basename(store.data.customEditor || '自定义编辑器')
                  .replace(/\.(app|exe)$/i, '');
      try {
        const target =
          opener === 'folder'
            ? process.platform === 'darwin'
              ? '/System/Library/CoreServices/Finder.app'
              : path.join(process.env.WINDIR || 'C:\\Windows', 'explorer.exe')
            : await editorPath(opener);
        if (process.platform === 'darwin') return { name, icon: await macAppIcon(target) };
        const icon = await app.getFileIcon(target, { size: 'large' });
        return { name, icon: icon.isEmpty() ? null : icon.toDataURL() };
      } catch {
        return { name, icon: null };
      }
    },
    'workbench:open': async (id) => {
      const project = state().snapshot?.projects.find((item) => item.id === id);
      if (!project) throw new Error('项目已不存在，请重新扫描');
      const session = await workbench.open(project);
      try {
        store.data.recent[id] = Date.now();
        await store.save();
      } catch (error) {
        workbench.close(session.id);
        throw error;
      }
      return { session, state: state() };
    },
    'workbench:close': async (id) => workbench.close(id),
    'workbench:list': async (id, relative) => workbench.requireSession(id).files.list(relative),
    'workbench:read': async (id, relative) => workbench.requireSession(id).files.read(relative),
    'terminal:start': async (...args) => workbench.startTerminal(...args),
    'terminal:input': async (...args) => workbench.write(...args),
    'terminal:resize': async (...args) => workbench.resize(...args),
    'terminal:acknowledge': async (...args) => workbench.acknowledge(...args),
    'terminal:stop': async (...args) => workbench.stopTerminal(...args),
    'workspace:state': async () => {
      if (pendingSettings) {
        pendingSettings = false;
        window.webContents.send('app:menu-action', 'settings');
      }
      return state();
    },
    'workspace:scan': () =>
      workspaceTask(async () => {
        await scan();
        return state();
      }),
    'item:remove': (kind, key) => workspaceTask(() => removeItem(kind, key)),
    'item:restore': (kind, key) =>
      workspaceTask(async () => {
        if (!store.data.workspace) throw new Error('请先选择工作空间');
        const current = getVisibility(store.data);
        if (kind === 'all') await saveVisibility(store, emptyVisibility());
        else if (['category', 'project'].includes(kind) && typeof key === 'string') {
          const field = kind === 'category' ? 'categories' : 'projects';
          if (!current[field].includes(key)) throw new Error('该内容不在移除列表中');
          await saveVisibility(store, {
            ...current,
            [field]: current[field].filter((item) => item !== key),
          });
        } else throw new Error('无效的恢复操作');
        await scan();
        return state();
      }),
    'item:reveal': (kind, key) => workspaceTask(() => removeItem(kind, key, true)),
    'category:create': (name, appearance) =>
      workspaceTask(async () => {
        const workspace = store.data.workspace;
        if (!workspace) throw new Error('请先选择工作空间');
        const style = management.validateStyle(appearance);
        const target = await management.createCategory(workspace, name);
        try {
          await saveCategoryStyle(workspace, path.basename(target), style);
        } catch (error) {
          throw new Error(`分类文件夹已创建，但外观保存失败，请重新扫描：${error.message}`);
        }
        await scan();
        return state();
      }),
    'category:style': (category, appearance) =>
      workspaceTask(async () => {
        const workspace = store.data.workspace;
        if (!workspace) throw new Error('请先选择工作空间');
        await management.categoryDirectory(workspace, category);
        await saveCategoryStyle(workspace, category, management.validateStyle(appearance));
        return state();
      }),
    'project:create': (category, name) =>
      workspaceTask(async () => {
        if (!store.data.workspace) throw new Error('请先选择工作空间');
        await management.createProject(store.data.workspace, category, name);
        await scan();
        return state();
      }),
    'workspace:choose': () =>
      workspaceTask(async () => {
        const result = await dialog.showOpenDialog(window, {
          title: '选择工作空间',
          defaultPath: store.data.workspace || path.join(os.homedir(), 'Workspace'),
          properties: ['openDirectory'],
        });
        if (result.canceled || !result.filePaths[0]) return state();
        const next = await scanWorkspace(result.filePaths[0]);
        store.data.workspace = next.workspace;
        await store.save();
        snapshot = next;
        return state();
      }),
    'project:favorite': async (id) => {
      if (!state().snapshot?.projects.some((p) => p.id === id))
        throw new Error('项目已不存在，请重新扫描');
      store.data.favorites = store.data.favorites.includes(id)
        ? store.data.favorites.filter((x) => x !== id)
        : [...store.data.favorites, id];
      await store.save();
      return state();
    },
    'settings:opener': async (value) => {
      if (!['folder', 'vscode', 'cursor', 'custom'].includes(value))
        throw new Error('无效的打开方式');
      store.data.opener = value;
      await store.save();
      return state();
    },
    'settings:theme': async (value) => {
      if (!['light', 'dark', 'system'].includes(value)) throw new Error('无效的外观主题');
      store.data.theme = value;
      await store.save();
      applyTheme(value);
      return state();
    },
    'settings:palette': async (value) => {
      if (typeof value !== 'string' || !Object.hasOwn(palettes, value))
        throw new Error('无效的配色主题');
      const previous = store.data.palette;
      store.data.palette = value;
      try {
        await store.save();
      } catch (error) {
        store.data.palette = previous;
        throw error;
      }
      applyTheme(store.data.theme);
      return state();
    },
    'settings:editor': async () => {
      const result = await dialog.showOpenDialog(window, {
        title: '选择编辑器应用',
        properties: ['openFile'],
        filters: [
          { name: '应用程序', extensions: process.platform === 'darwin' ? ['app'] : ['exe'] },
        ],
      });
      if (!result.canceled && result.filePaths[0]) {
        const target = result.filePaths[0];
        if (!target.toLowerCase().endsWith(process.platform === 'darwin' ? '.app' : '.exe'))
          throw new Error('请选择有效的编辑器程序');
        store.data.customEditor = target;
        store.data.opener = 'custom';
        await store.save();
      }
      return state();
    },
    'project:open': async (id, action = 'default') => {
      if (!['default', 'folder', 'terminal'].includes(action)) throw new Error('无效的项目操作');
      const project = state().snapshot?.projects.find((p) => p.id === id);
      if (!project) throw new Error('项目已不存在，请重新扫描');
      try {
        if (!(await fs.stat(project.path)).isDirectory()) throw new Error();
      } catch {
        throw new Error('项目目录已移动或删除，请重新扫描');
      }
      if (action === 'terminal') {
        if (process.platform === 'darwin')
          await run('/usr/bin/open', ['-a', 'Terminal', project.path], true);
        else {
          const command = `Set-Location -LiteralPath '${project.path.replaceAll("'", "''")}'`;
          await run('powershell.exe', [
            '-NoExit',
            '-EncodedCommand',
            Buffer.from(command, 'utf16le').toString('base64'),
          ]);
        }
      } else if (action === 'folder' || store.data.opener === 'folder') {
        const error = await shell.openPath(project.path);
        if (error) throw new Error(error);
      } else {
        const executable = await editorPath(store.data.opener);
        if (process.platform === 'darwin')
          await run('/usr/bin/open', ['-a', executable, project.path], true);
        else await run(executable, [project.path]);
      }
      store.data.recent[project.id] = Date.now();
      await store.save();
      return state();
    },
  };
  for (const [channel, handler] of Object.entries(handlers))
    ipcMain.handle(channel, async (event, ...args) => {
      const expected =
        process.env.ELECTRON_RENDERER_URL ||
        pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
      const senderURL = event.senderFrame?.url;
      if (
        event.sender !== window?.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !senderURL ||
        new URL(senderURL).origin !== new URL(expected).origin ||
        (new URL(expected).protocol === 'file:' && senderURL.split('#')[0] !== expected)
      )
        throw new Error('无效的请求来源');
      return handler(...args);
    });
}
function createWindow() {
  window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: windowBackground(),
    title: 'BK Project Manager',
    icon: appIcon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 12, y: 20 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('render-process-gone', () => workbench.dispose());
  window.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) workbench.dispose();
  });
  window.on('closed', () => workbench.dispose());
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}
app
  .whenReady()
  .then(async () => {
    if (process.platform === 'darwin') app.dock.setIcon(appIcon);
    store = new Store(app.getPath('userData'));
    workbench = new Workbench((event) => {
      if (window && !window.isDestroyed()) window.webContents.send('terminal:event', event);
    });
    await store.load();
    applyTheme(store.data.theme);
    nativeTheme.on('updated', () => {
      if (window && !window.isDestroyed()) window.setBackgroundColor(windowBackground());
    });
    registerHandlers();
    createMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    dialog.showErrorBox('无法启动 BK Project Manager', error.message);
    app.quit();
  });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => workbench?.dispose());
