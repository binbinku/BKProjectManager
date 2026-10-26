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
const { readGitHubRemotes } = require('./github.cjs');
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
const projectWindows = new Map();
const projectOpenings = new Map();
let quitting = false;
let quitRequested = false;
let nativeGlass =
  process.platform === 'darwin' ||
  (process.platform === 'win32' && Number(os.release().split('.')[2]) >= 22621);
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
function focusWindow(target) {
  if (target.isMinimized()) target.restore();
  target.show();
  target.focus();
}
function showManager() {
  if (!window || window.isDestroyed()) createWindow();
  focusWindow(window);
}
function menuAction(action) {
  if (action === 'settings') {
    const existing = window && !window.isDestroyed();
    if (!existing) pendingSettings = true;
    showManager();
    if (existing) window.webContents.send('app:menu-action', action);
    return;
  }
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && [...projectWindows.values()].some((entry) => entry.window === focused))
    focused.webContents.send('app:menu-action', action);
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
          { role: 'close' },
          ...(process.platform === 'darwin' ? [] : [{ role: 'quit' }]),
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
  return {
    settings: store.data,
    snapshot: visibleSnapshot(snapshot, getVisibility(store.data)),
    nativeGlass,
    runningProjects: [...projectWindows.entries()]
      .filter(([, entry]) => entry.ready && !entry.window.isDestroyed())
      .map(([id]) => id),
  };
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
  if (nativeGlass && store?.data.glassMode === 'full') return '#00000000';
  return palettes[store?.data.palette ?? 'default'].colors[
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  ].canvas;
}
function broadcastState() {
  for (const target of BrowserWindow.getAllWindows())
    if (!target.isDestroyed()) target.webContents.send('app:state-changed', state());
}
function updateWindowBackgrounds() {
  for (const target of BrowserWindow.getAllWindows()) target.setBackgroundColor(windowBackground());
}
function applyWindowMaterial(target) {
  const full = nativeGlass && store.data.glassMode === 'full';
  try {
    if (process.platform === 'darwin') target.setVibrancy(full ? 'sidebar' : null);
    if (process.platform === 'win32' && nativeGlass)
      target.setBackgroundMaterial(full ? 'mica' : 'none');
  } catch {
    nativeGlass = false;
  }
  target.setBackgroundColor(windowBackground());
}
function applyTheme(theme) {
  nativeTheme.themeSource = theme;
  updateWindowBackgrounds();
}
function projectById(id) {
  return (
    state().snapshot?.projects.find((item) => item.id === id) ||
    projectWindows.get(id)?.session.project
  );
}
function entryForEvent(event) {
  return [...projectWindows.values()].find((entry) => entry.window.webContents === event.sender);
}
function ownWorkbench(event, id) {
  const entry = entryForEvent(event);
  if (!entry || entry.session.id !== id) throw new Error('只能操作当前窗口的项目');
  return entry.workbench;
}
function requestEditorClose(entry) {
  if (entry.closeRequested) return;
  entry.closeRequested = true;
  entry.window.webContents.send('workbench:close-request');
}
async function openProjectWindow(id) {
  const existing = projectWindows.get(id);
  if (existing?.ready && !existing.window.isDestroyed()) {
    focusWindow(existing.window);
    return { state: state() };
  }
  if (projectOpenings.has(id)) return projectOpenings.get(id);
  const job = (async () => {
    const project = state().snapshot?.projects.find((item) => item.id === id);
    if (!project) throw new Error('项目已不存在，请重新扫描');
    let projectWindow;
    const workbench = new Workbench((event) => {
      if (projectWindow && !projectWindow.isDestroyed())
        projectWindow.webContents.send('terminal:event', event);
    });
    try {
      const session = await workbench.open(project);
      if (quitting) throw new Error('应用正在退出');
      projectWindow = makeWindow(project.name, false);
      const entry = { window: projectWindow, workbench, session, ready: false };
      projectWindows.set(id, entry);
      projectWindow.on('close', (event) => {
        if (entry.markdownDirty) {
          event.preventDefault();
          requestEditorClose(entry);
        }
      });
      projectWindow.webContents.on('will-prevent-unload', () => {
        quitting = false;
        requestEditorClose(entry);
      });
      projectWindow.on('closed', () => {
        workbench.dispose();
        if (projectWindows.get(id) === entry) projectWindows.delete(id);
        broadcastState();
      });
      projectWindow.webContents.on('render-process-gone', () => {
        if (!projectWindow.isDestroyed()) projectWindow.destroy();
      });
      store.data.recent[id] = Date.now();
      await store.save();
      await loadWindow(projectWindow, true);
      if (projectWindow.isDestroyed() || quitting) throw new Error('项目打开已取消');
      entry.ready = true;
      focusWindow(projectWindow);
      broadcastState();
      return { state: state() };
    } catch (error) {
      workbench.dispose();
      if (projectWindow && !projectWindow.isDestroyed()) projectWindow.destroy();
      throw error;
    }
  })();
  projectOpenings.set(id, job);
  try {
    return await job;
  } finally {
    projectOpenings.delete(id);
  }
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
    'project:github': (id) =>
      workspaceTask(async () => {
        const project = projectById(id);
        if (!project) throw new Error('项目已不存在或已移除，请重新扫描');
        const remotes = await readGitHubRemotes(project.path);
        project.githubRemotes = remotes;
        if (!remotes.length) throw new Error('未找到 GitHub 远程仓库，请重新扫描');
        if (remotes.length === 1) await shell.openExternal(remotes[0].url);
        else
          await new Promise((resolve, reject) => {
            let selected = false;
            const menu = Menu.buildFromTemplate(
              remotes.map((remote) => ({
                label: `${remote.name} · ${remote.repository}`,
                click: () => {
                  selected = true;
                  shell.openExternal(remote.url).then(resolve, reject);
                },
              })),
            );
            menu.popup({
              window: BrowserWindow.getFocusedWindow() || window,
              callback: () => {
                if (!selected) resolve();
              },
            });
          });
        return state();
      }),
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
    'workbench:open': openProjectWindow,
    'workbench:focus': async (id) => {
      const entry = projectWindows.get(id);
      if (!entry?.ready || entry.window.isDestroyed())
        throw new Error('项目窗口已关闭，请重新启动');
      focusWindow(entry.window);
      return state();
    },
    'manager:show': async () => showManager(),
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
    'settings:glass-mode': async (value) => {
      if (!['off', 'medium', 'full'].includes(value)) throw new Error('无效的毛玻璃档位');
      const previous = store.data.glassMode;
      store.data.glassMode = value;
      try {
        await store.save();
      } catch (error) {
        store.data.glassMode = previous;
        throw error;
      }
      for (const target of BrowserWindow.getAllWindows()) applyWindowMaterial(target);
      return state();
    },
    'settings:glass-transparency': (value) =>
      workspaceTask(async () => {
        if (!Number.isInteger(value) || value < 0 || value > 100)
          throw new Error('无效的毛玻璃透明度');
        const previous = store.data.glassTransparency;
        store.data.glassTransparency = value;
        try {
          await store.save();
        } catch (error) {
          store.data.glassTransparency = previous;
          throw error;
        }
        return state();
      }),
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
      if (!['default', 'folder', 'terminal', 'vscode'].includes(action))
        throw new Error('无效的项目操作');
      const opener = action === 'vscode' ? 'vscode' : store.data.opener;
      const project = projectById(id);
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
      } else if (action === 'folder' || opener === 'folder') {
        const error = await shell.openPath(project.path);
        if (error) throw new Error(error);
      } else {
        const executable = await editorPath(opener);
        if (process.platform === 'darwin')
          await run('/usr/bin/open', ['-a', executable, project.path], true);
        else await run(executable, [project.path]);
      }
      store.data.recent[project.id] = Date.now();
      await store.save();
      return state();
    },
  };
  const scopedHandlers = {
    'window:state': (event) => ({
      maximized: BrowserWindow.fromWebContents(event.sender).isMaximized(),
    }),
    'window:control': (event, action) => {
      const target = BrowserWindow.fromWebContents(event.sender);
      if (action === 'close') target.close();
      else if (action === 'minimize') target.minimize();
      else if (action === 'maximize') {
        if (target.isMaximized()) target.unmaximize();
        else target.maximize();
      } else throw new Error('无效的窗口操作');
    },
    'workbench:current': (event) => entryForEvent(event)?.session || null,
    'workbench:close': (event, id) => {
      ownWorkbench(event, id);
      entryForEvent(event).window.close();
    },
    'workbench:list': (event, id, relative) =>
      ownWorkbench(event, id).requireSession(id).files.list(relative),
    'workbench:read': (event, id, relative) =>
      ownWorkbench(event, id).requireSession(id).files.read(relative),
    'workbench:save-markdown': (event, id, relative, content, revision) =>
      ownWorkbench(event, id).requireSession(id).files.saveMarkdown(relative, content, revision),
    'workbench:markdown-dirty': (event, id, dirty) => {
      ownWorkbench(event, id);
      if (typeof dirty !== 'boolean') throw new Error('无效的编辑状态');
      entryForEvent(event).markdownDirty = dirty;
    },
    'workbench:confirm-markdown': async (event, id, relative) => {
      ownWorkbench(event, id);
      if (typeof relative !== 'string' || relative.length > 4096) throw new Error('无效的文件路径');
      const { response } = await dialog.showMessageBox(entryForEvent(event).window, {
        type: 'question',
        message: `要保存对“${path.basename(relative)}”的修改吗？`,
        detail: '未保存的修改会在离开文件后丢失。',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });
      return ['save', 'discard', 'cancel'][response] || 'cancel';
    },
    'workbench:resolve-close': (event, id, approved) => {
      ownWorkbench(event, id);
      const entry = entryForEvent(event);
      if (!entry.closeRequested || typeof approved !== 'boolean') return;
      entry.closeRequested = false;
      if (!approved) {
        quitRequested = false;
        quitting = false;
        return;
      }
      entry.markdownDirty = false;
      if (quitRequested) app.quit();
      else entry.window.close();
    },
    'workbench:open-link': async (event, id, value) => {
      ownWorkbench(event, id);
      if (typeof value !== 'string' || value.length > 8192) throw new Error('无效的链接');
      const url = new URL(value);
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password)
        throw new Error('不支持打开此链接');
      await shell.openExternal(url.href);
    },
    'terminal:start': (event, id, ...args) => ownWorkbench(event, id).startTerminal(id, ...args),
    'terminal:input': (event, id, ...args) => ownWorkbench(event, id).write(id, ...args),
    'terminal:resize': (event, id, ...args) => ownWorkbench(event, id).resize(id, ...args),
    'terminal:acknowledge': (event, id, ...args) =>
      ownWorkbench(event, id).acknowledge(id, ...args),
    'terminal:stop': (event, id, ...args) => ownWorkbench(event, id).stopTerminal(id, ...args),
  };
  const projectChannels = new Set([
    'workspace:state',
    'settings:opener-info',
    'project:open',
    'project:github',
    'manager:show',
    ...Object.keys(scopedHandlers),
  ]);
  for (const channel of [...Object.keys(handlers), ...Object.keys(scopedHandlers)])
    ipcMain.handle(channel, async (event, ...args) => {
      const expected =
        process.env.ELECTRON_RENDERER_URL ||
        pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
      const senderURL = event.senderFrame?.url;
      const entry = entryForEvent(event);
      const target = entry?.window || window;
      if (
        !target ||
        target.isDestroyed() ||
        event.sender !== target.webContents ||
        event.senderFrame !== target.webContents.mainFrame ||
        !senderURL ||
        new URL(senderURL).origin !== new URL(expected).origin ||
        (new URL(expected).protocol === 'file:' && senderURL.split('#')[0] !== expected)
      )
        throw new Error('无效的请求来源');
      if (
        entry &&
        (!projectChannels.has(channel) ||
          (['project:open', 'project:github'].includes(channel) &&
            args[0] !== entry.session.project.id))
      )
        throw new Error('只能操作当前窗口的项目');
      const result = scopedHandlers[channel]
        ? await scopedHandlers[channel](event, ...args)
        : await handlers[channel](...args);
      if (result?.settings || result?.state?.settings) broadcastState();
      return result;
    });
}
function makeWindow(title = 'BK Project Manager', show = true) {
  const target = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: windowBackground(),
    title,
    show,
    icon: appIcon,
    titleBarStyle:
      process.platform === 'darwin'
        ? 'hiddenInset'
        : process.platform === 'win32'
          ? 'hidden'
          : 'default',
    ...(process.platform === 'win32' ? { frame: false, autoHideMenuBar: true } : {}),
    ...(process.platform === 'darwin'
      ? {
          trafficLightPosition: { x: 12, y: 20 },
          // Keep Chromium's backing surface alpha-aware, including after toggling glass.
          transparent: true,
          ...(store.data.glassMode === 'full' ? { vibrancy: 'sidebar' } : {}),
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  applyWindowMaterial(target);
  const sendWindowState = () => {
    if (!target.isDestroyed())
      target.webContents.send('window:state-changed', { maximized: target.isMaximized() });
  };
  target.on('maximize', sendWindowState);
  target.on('unmaximize', sendWindowState);
  target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  target.on('page-title-updated', (event) => event.preventDefault());
  target.webContents.on('will-navigate', (event) => event.preventDefault());
  return target;
}
function loadWindow(target, project = false) {
  if (process.env.ELECTRON_RENDERER_URL)
    return target.loadURL(`${process.env.ELECTRON_RENDERER_URL}${project ? '#project' : ''}`);
  return target.loadFile(
    path.join(__dirname, '../dist/index.html'),
    project ? { hash: 'project' } : {},
  );
}
function createWindow() {
  window = makeWindow();
  const manager = window;
  manager.on('closed', () => {
    if (window === manager) window = null;
  });
  void loadWindow(manager).catch((error) => dialog.showErrorBox('无法打开项目列表', error.message));
}
app
  .whenReady()
  .then(async () => {
    if (process.platform === 'darwin') app.dock.setIcon(appIcon);
    store = new Store(app.getPath('userData'));
    await store.load();
    applyTheme(store.data.theme);
    nativeTheme.on('updated', updateWindowBackgrounds);
    registerHandlers();
    createMenu();
    createWindow();
    app.on('activate', () => {
      if (!window || window.isDestroyed()) createWindow();
    });
  })
  .catch((error) => {
    dialog.showErrorBox('无法启动 BK Project Manager', error.message);
    app.quit();
  });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', (event) => {
  quitRequested = true;
  const dirty = [...projectWindows.values()].find((entry) => entry.markdownDirty);
  if (dirty) {
    event.preventDefault();
    requestEditorClose(dirty);
    return;
  }
  quitting = true;
});
app.on('will-quit', () => {
  for (const entry of projectWindows.values()) entry.workbench.dispose();
});
