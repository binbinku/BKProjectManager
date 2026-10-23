import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startProject } from './native-menu.mjs';

if (process.platform !== 'win32') {
  console.log('Windows window controls smoke test skipped on this platform.');
  process.exit(0);
}

const artifacts = path.resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const temporary = await mkdtemp(path.join(artifacts, 'window-chrome-'));
const workspace = path.join(temporary, 'Workspace');
const project = path.join(workspace, 'Web/Projects/Example');
const errors = [];
let app;
async function waitForWindowState(target, method, expected) {
  const deadline = Date.now() + 5000;
  while ((await target.evaluate((win, method) => win[method](), method)) !== expected) {
    assert.ok(Date.now() < deadline, `${method} should become ${expected}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
try {
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, 'sample.ts'), 'export const example = true;\n');
  const env = { ...process.env, BKPM_USER_DATA: path.join(temporary, 'settings') };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  app = await electron.launch({ args: ['.'], env });
  const manager = await app.firstWindow();
  manager.setDefaultTimeout(15000);
  manager.on('pageerror', (error) => errors.push(error.message));
  await manager.getByRole('group', { name: '窗口控制' }).waitFor();
  const managerWindow = await app.browserWindow(manager);
  assert.equal(await managerWindow.evaluate((win) => win.isMenuBarVisible()), false);
  assert.deepEqual(
    await managerWindow.evaluate((win) => {
      const outer = win.getBounds();
      const inner = win.getContentBounds();
      return { width: outer.width - inner.width, height: outer.height - inner.height };
    }),
    { width: 0, height: 0 },
    'The Windows content extends into the native title bar',
  );
  const controls = await manager.getByRole('group', { name: '窗口控制' }).boundingBox();
  assert.equal(controls.x, 12);
  assert.equal(controls.y, 20);
  const settings = await manager.getByRole('button', { name: '设置', exact: true }).boundingBox();
  const name = await manager.locator('.brand-name').boundingBox();
  const icon = await manager.locator('.brand-mark').boundingBox();
  assert.ok(name.y > controls.y + controls.height, 'Brand sits below the window controls');
  assert.ok(icon.x + icon.width <= name.x, 'Brand icon precedes its name');
  assert.ok(settings.x >= name.x + name.width, 'Settings sits to the right of the name');
  assert.equal(settings.y + settings.height / 2, name.y + name.height / 2);
  await manager.getByRole('button', { name: '设置', exact: true }).click();
  await manager.getByRole('dialog').waitFor();
  await manager.getByRole('radio', { name: '暗色', exact: true }).click();
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  await manager.screenshot({ path: path.join(artifacts, 'window-chrome-dark.png') });
  await manager.getByRole('button', { name: '设置', exact: true }).click();
  await manager.getByRole('radio', { name: '亮色', exact: true }).click();
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  await manager.screenshot({ path: path.join(artifacts, 'window-chrome-light.png') });
  await manager.getByRole('button', { name: '最大化窗口', exact: true }).click();
  await waitForWindowState(managerWindow, 'isMaximized', true);
  await manager.getByRole('button', { name: '还原窗口', exact: true }).click();
  await waitForWindowState(managerWindow, 'isMaximized', false);
  // Native changes must also update the custom green button.
  await managerWindow.evaluate((win) => win.maximize());
  await manager.getByRole('button', { name: '还原窗口', exact: true }).waitFor();
  await managerWindow.evaluate((win) => win.unmaximize());
  await manager.getByRole('button', { name: '最大化窗口', exact: true }).waitFor();
  await assert.rejects(
    manager.evaluate(() => window.workspaceAPI.controlWindow('invalid')),
    /无效的窗口操作/,
  );
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await manager.getByRole('button', { name: '选择工作空间', exact: true }).click();
  const workbench = await startProject(app, manager);
  workbench.on('pageerror', (error) => errors.push(error.message));
  const projectWindow = await app.browserWindow(workbench);
  await projectWindow.evaluate((win) => win.setContentSize(980, 700));
  await workbench.getByRole('group', { name: '窗口控制' }).waitFor();
  const projectControls = await workbench.getByRole('group', { name: '窗口控制' }).boundingBox();
  const projectName = await workbench.locator('.workbench-project-name').boundingBox();
  assert.equal(
    projectName.y + projectName.height / 2,
    projectControls.y + projectControls.height / 2,
    'Workbench keeps its project name on the same row as the window controls',
  );
  await workbench.getByRole('treeitem', { name: '查看 sample.ts', exact: true }).click();
  await workbench.locator('.shiki').waitFor();
  await workbench.screenshot({ path: path.join(artifacts, 'window-chrome-workbench.png') });
  await workbench.getByRole('button', { name: '最大化窗口', exact: true }).click();
  await waitForWindowState(projectWindow, 'isMaximized', true);
  assert.equal(await managerWindow.evaluate((win) => win.isMaximized()), false);
  await workbench.getByRole('button', { name: '还原窗口', exact: true }).click();
  await workbench.getByRole('button', { name: '最小化窗口', exact: true }).click();
  await waitForWindowState(projectWindow, 'isMinimized', true);
  assert.equal(await managerWindow.evaluate((win) => win.isMinimized()), false);
  // Windows reports the minimized flag before the native animation finishes.
  await new Promise((resolve) => setTimeout(resolve, 350));
  await projectWindow.evaluate((win) => {
    win.restore();
    win.show();
    win.focus();
  });
  await workbench.getByRole('button', { name: '设置', exact: true }).click();
  await manager.getByRole('dialog').waitFor();
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  await projectWindow.evaluate((win) => win.focus());
  await workbench.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await manager.waitForFunction(async () => {
    const state = await window.workspaceAPI.getState();
    return state.runningProjects.length === 0;
  });
  assert.equal(app.windows().length, 1, 'Closing the project preserves the manager');
  await managerWindow.evaluate((win) => win.focus());
  await manager.getByRole('button', { name: '最小化窗口', exact: true }).click();
  await waitForWindowState(managerWindow, 'isMinimized', true);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await managerWindow.evaluate((win) => {
    win.restore();
    win.show();
    win.focus();
  });
  await waitForWindowState(managerWindow, 'isMinimized', false);
  assert.deepEqual(errors, []);
  await manager.getByRole('button', { name: '关闭窗口', exact: true }).click();
  console.log(
    'Windows chrome passed: frameless layout, settings, maximize/restore, minimize, close and window isolation.',
  );
} finally {
  await app?.close().catch(() => {});
  const resolved = path.resolve(temporary);
  assert.ok(resolved.startsWith(`${artifacts}${path.sep}`));
  assert.ok(path.basename(resolved).startsWith('window-chrome-'));
  await rm(resolved, { recursive: true, force: true });
}
