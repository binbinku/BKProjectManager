const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { scanWorkspace } = require('./scanner.cjs');
const { Store } = require('./store.cjs');

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
  return { settings: store.data, snapshot };
}
function applyTheme(theme) {
  nativeTheme.themeSource = theme;
  if (window && !window.isDestroyed())
    window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff');
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
    'workspace:state': async () => state(),
    'workspace:scan': async () => {
      await scan();
      return state();
    },
    'workspace:choose': async () => {
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
    },
    'project:favorite': async (id) => {
      if (!snapshot?.projects.some((p) => p.id === id)) throw new Error('项目已不存在，请重新扫描');
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
      const project = snapshot?.projects.find((p) => p.id === id);
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff',
    title: 'BK Project Manager',
    icon: appIcon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}
app
  .whenReady()
  .then(async () => {
    if (process.platform === 'darwin') app.dock.setIcon(appIcon);
    store = new Store(app.getPath('userData'));
    await store.load();
    applyTheme(store.data.theme);
    nativeTheme.on('updated', () => {
      if (window && !window.isDestroyed())
        window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff');
    });
    registerHandlers();
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
