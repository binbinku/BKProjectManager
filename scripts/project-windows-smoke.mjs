import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { startProject, closeProject, clickMenu } from './native-menu.mjs';

const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'bkpm-windows-')));
const workspace = path.join(temporary, 'Workspace');
const errors = [];
let app;
try {
  for (const name of ['Alpha', 'Beta', 'Gone']) {
    const folder = path.join(workspace, 'WebDev/Projects', name);
    await mkdir(path.join(folder, '.git'), { recursive: true });
    await writeFile(path.join(folder, 'sample.ts'), `export const project = '${name}';\n`);
    await writeFile(
      path.join(folder, '.git/config'),
      `[remote "origin"]\nurl=https://github.com/demo/${name}.git\n`,
    );
  }
  await mkdir(path.join(temporary, 'shell'));
  await mkdir('artifacts', { recursive: true });
  app = await electron.launch({
    executablePath: process.env.BKPM_SMOKE_EXECUTABLE
      ? path.resolve(process.env.BKPM_SMOKE_EXECUTABLE)
      : undefined,
    args: process.env.BKPM_SMOKE_EXECUTABLE ? [] : ['.'],
    env: {
      ...process.env,
      BKPM_USER_DATA: path.join(temporary, 'settings'),
      ELECTRON_RENDERER_URL: '',
      ZDOTDIR: path.join(temporary, 'shell'),
    },
  });
  let manager = await app.firstWindow();
  const watch = (page) => {
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(error.message));
  };
  watch(manager);
  await app.evaluate(({ dialog, shell }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
    global.__external = [];
    shell.openExternal = async (url) => {
      global.__external.push(url);
    };
    shell.openPath = async (p) => {
      global.__external.push(p);
      return '';
    };
  }, workspace);
  await manager.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await manager.locator('.project-card').first().waitFor();
  const card = (name) =>
    manager
      .locator('.project-card')
      .filter({ has: manager.getByRole('heading', { name, exact: true }) });
  const start = (name) => card(name).getByRole('button', { name: '启动项目', exact: true });
  const running = (name) => card(name).getByRole('button', { name: '运行中', exact: true });
  await card('Alpha').locator('.card-body').dblclick();
  assert.equal(app.windows().length, 1, 'Unstarted cards do not open on click or double-click');
  const alpha = await startProject(app, manager, start('Alpha'));
  watch(alpha);
  await running('Alpha').waitFor();
  assert.equal(app.windows().length, 2);
  assert.equal(await (await app.browserWindow(alpha)).evaluate((w) => w.getTitle()), 'Alpha');
  await alpha.locator('.terminal-host[data-running="true"]').waitFor();
  await alpha.getByRole('treeitem', { name: '查看 sample.ts', exact: true }).click();
  await alpha.locator('.shiki').waitFor();
  await alpha.evaluate(() => {
    window.__terminal = document.querySelector('.terminal-host');
    window.__events = [];
    window.workspaceAPI.onTerminalEvent((event) => window.__events.push(event));
  });
  const alphaSession = await alpha.evaluate(() => window.workspaceAPI.getCurrentWorkbench());
  await manager.evaluate(async (id) => {
    await Promise.all([
      window.workspaceAPI.openWorkbench(id),
      window.workspaceAPI.openWorkbench(id),
    ]);
  }, alphaSession.project.id);
  assert.equal(app.windows().length, 2, 'Starting an existing project reuses its window');
  const betaID = await manager.evaluate(
    async () =>
      (await window.workspaceAPI.getState()).snapshot.projects.find((p) => p.name === 'Beta').id,
  );
  const betaOpened = app.waitForEvent('window');
  await manager.evaluate(async (id) => {
    await Promise.all([
      window.workspaceAPI.openWorkbench(id),
      window.workspaceAPI.openWorkbench(id),
    ]);
  }, betaID);
  const beta = await betaOpened;
  watch(beta);
  await beta.locator('.project-workbench').waitFor();
  await beta.locator('.terminal-host[data-running="true"]').waitFor();
  await running('Beta').waitFor();
  assert.equal(app.windows().length, 3, 'Concurrent starts create one window per project');
  const betaSession = await beta.evaluate(() => window.workspaceAPI.getCurrentWorkbench());
  assert.notEqual(alphaSession.id, betaSession.id);
  await assert.rejects(
    beta.evaluate((id) => window.workspaceAPI.readProjectFile(id, 'sample.ts'), alphaSession.id),
    /当前窗口/,
  );
  await assert.rejects(
    manager.evaluate((id) => window.workspaceAPI.listProjectFiles(id, ''), alphaSession.id),
    /当前窗口/,
  );
  await assert.rejects(
    beta.evaluate((id) => window.workspaceAPI.openGitHub(id), alphaSession.project.id),
    /当前窗口/,
  );
  await assert.rejects(
    beta.evaluate(() => window.workspaceAPI.setTheme('dark')),
    /当前窗口/,
  );
  await beta.evaluate(() => {
    window.__events = [];
    window.workspaceAPI.onTerminalEvent((event) => window.__events.push(event));
  });
  const focused = async (page) => {
    await app.evaluate(
      async ({ BrowserWindow }, id) => {
        const deadline = Date.now() + 5000;
        while (BrowserWindow.getFocusedWindow()?.id !== id) {
          if (Date.now() > deadline) throw new Error('Project window was not focused');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      },
      await (await app.browserWindow(page)).evaluate((w) => w.id),
    );
  };
  await card('Alpha').getByRole('heading', { name: 'Alpha', exact: true }).click();
  await focused(alpha);
  await (await app.browserWindow(beta)).evaluate((w) => w.minimize());
  await running('Beta').click();
  await focused(beta);
  assert.equal(await (await app.browserWindow(beta)).evaluate((w) => w.isMinimized()), false);
  const state = await manager.evaluate(() => window.workspaceAPI.getState());
  assert.equal(state.runningProjects.length, 2);
  await card('Alpha').getByRole('button', { name: '收藏 Alpha', exact: true }).click();
  await card('Alpha').getByRole('button', { name: '取消收藏 Alpha', exact: true }).waitFor();
  await card('Alpha')
    .getByRole('button', { name: '打开 Alpha 的 GitHub 仓库', exact: true })
    .click();
  await manager.waitForFunction(() => !document.querySelector('.github-open').disabled);
  assert.equal(
    (await app.evaluate(() => global.__external)).at(-1),
    'https://github.com/demo/Alpha',
  );
  await card('Alpha').getByRole('button', { name: '移除项目 Alpha', exact: true }).click();
  await manager.getByRole('dialog').waitFor();
  await manager.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(app.windows().length, 3);
  await clickMenu(app, 'settings', alpha);
  await manager.getByRole('radio', { name: '暗色', exact: true }).click();
  await alpha.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await beta.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  assert.equal(
    await alpha.evaluate(() => window.__terminal === document.querySelector('.terminal-host')),
    true,
  );
  assert.ok((await alpha.locator('.code-content').textContent()).includes('Alpha'));
  for (const width of [1380, 1260, 1160, 980, 1700]) {
    await (
      await app.browserWindow(manager)
    ).evaluate((w, width) => w.setContentSize(width, 900), width);
    for (const view of ['卡片视图', '列表视图']) {
      await manager.getByRole('button', { name: '显示方式', exact: true }).click();
      await manager.getByRole('menuitemradio', { name: view, exact: true }).click();
      for (const name of ['Alpha', 'Gone']) {
        const layout = await card(name).evaluate((el) => {
          const icons = el.querySelector('.card-tools').getBoundingClientRect();
          const button = el.querySelector('.open-project').getBoundingClientRect();
          const footer = el.querySelector('.card-footer').getBoundingClientRect();
          return (
            icons.right < button.left &&
            button.right <= footer.right &&
            el.scrollWidth <= el.clientWidth
          );
        });
        assert.ok(layout, `${width}/${view}/${name}: buttons must not overlap or clip`);
      }
    }
  }
  await (await app.browserWindow(manager)).evaluate((w) => w.setContentSize(1380, 900));
  await manager.getByRole('button', { name: '显示方式', exact: true }).click();
  await manager.getByRole('menuitemradio', { name: '卡片视图', exact: true }).click();
  if (process.platform !== 'win32') {
    const terminal = alpha.locator('.xterm-helper-textarea');
    await terminal.focus();
    await terminal.pressSequentially("BKPM_WINDOW_MARKER=kept; printf 'ALPHA_PID_%s\\n' $$", {
      delay: 1,
    });
    await terminal.press('Enter');
    await alpha.waitForFunction(() =>
      window.__events.some((e) => e.type === 'data' && /ALPHA_PID_\d+/.test(e.data)),
    );
    assert.ok(
      !(await beta.evaluate(() => window.__events)).some((e) => /ALPHA_PID_\d+/.test(e.data || '')),
      'Terminal output stays in its own window',
    );
  }
  assert.equal(await alpha.getByRole('button', { name: '返回项目列表', exact: true }).count(), 0);
  await clickMenu(app, 'settings', alpha);
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  assert.equal(alpha.isClosed(), false, 'Showing manager settings keeps the project running');
  await running('Alpha').waitFor();
  await manager.screenshot({ path: 'artifacts/project-windows-dark.png' });
  await closeProject(app, alpha);
  await start('Alpha').waitFor();
  await running('Beta').waitFor();
  assert.equal(
    (await beta.evaluate(() => window.workspaceAPI.getCurrentWorkbench())).id,
    betaSession.id,
  );
  await closeProject(app, manager);
  assert.equal(beta.isClosed(), false, 'Closing manager does not stop projects');
  const managerOpened = app.waitForEvent('window');
  await clickMenu(app, 'settings', beta);
  manager = await managerOpened;
  watch(manager);
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  await running('Beta').waitFor();
  await start('Alpha').waitFor();
  await rm(path.join(workspace, 'WebDev/Projects/Gone'), { recursive: true });
  await start('Gone').click();
  await manager.getByRole('alert').waitFor();
  assert.equal(app.windows().length, 2, 'Failed start does not leave a project window');
  assert.ok(
    !(await manager.evaluate(() => window.workspaceAPI.getState())).runningProjects.includes(
      (await manager.evaluate(() => window.workspaceAPI.getState())).snapshot.projects.find(
        (p) => p.name === 'Gone',
      ).id,
    ),
  );
  await closeProject(app, beta);
  await start('Beta').waitFor();
  const reopened = await startProject(app, manager, start('Alpha'));
  watch(reopened);
  const reopenedSession = await reopened.evaluate(() => window.workspaceAPI.getCurrentWorkbench());
  assert.notEqual(reopenedSession.id, alphaSession.id);
  await assert.rejects(
    reopened.evaluate(
      (id) => window.workspaceAPI.readProjectFile(id, 'sample.ts'),
      alphaSession.id,
    ),
    /当前窗口/,
  );
  await (
    await app.browserWindow(reopened)
  ).evaluate((w) => w.webContents.forcefullyCrashRenderer());
  await start('Alpha').waitFor();
  for (const name of [
    'BKProjectManager-项目管理与Markdown阅读编辑的跨平台工作台',
    `BKProjectManager-${'项目名称'.repeat(13)}`,
  ]) {
    const folder = path.join(workspace, 'WebDev/Projects', name);
    await mkdir(path.join(folder, '.git'), { recursive: true });
    await writeFile(
      path.join(folder, '.git/config'),
      '[remote "origin"]\nurl=https://github.com/demo/workbench.git\n',
    );
    await manager.evaluate(() => window.workspaceAPI.scan());
    const project = await startProject(app, manager, start(name));
    watch(project);
    await project.locator('.terminal-host[data-running="true"]').waitFor();
    await project.evaluate(() => {
      window.__originalTerminal = document.querySelector('.terminal-host');
    });
    const assertLayout = async () => {
      await project.waitForFunction(() => {
        const title = document.querySelector('.workbench-project-name');
        const header = document.querySelector('.workbench-navigation-header');
        const sidebar = document.querySelector('.explorer-panel');
        const viewer = document.querySelector('.file-panel');
        const terminal = document.querySelector('.terminal-panel');
        const titleBounds = title.getBoundingClientRect();
        const headerBounds = header.getBoundingClientRect();
        return (
          title.scrollWidth <= title.clientWidth + 1 &&
          title.scrollHeight <= title.clientHeight + 1 &&
          titleBounds.top >= headerBounds.top &&
          titleBounds.bottom <= headerBounds.bottom &&
          sidebar.getBoundingClientRect().width > 320 &&
          viewer.getBoundingClientRect().width >= 260 &&
          terminal.getBoundingClientRect().width >= 260 &&
          terminal.getBoundingClientRect().right <= window.innerWidth + 1 &&
          [...header.querySelectorAll('button')].every((button) => {
            const bounds = button.getBoundingClientRect();
            return (
              bounds.left >= titleBounds.right &&
              bounds.right <= headerBounds.right &&
              bounds.bottom <= headerBounds.bottom
            );
          })
        );
      });
      assert.equal(await project.locator('.workbench-project-name').textContent(), name);
      assert.equal(
        await project.getByRole('button', { name: '返回项目列表', exact: true }).count(),
        0,
      );
    };
    await assertLayout();
    await (await app.browserWindow(project)).evaluate((target) => target.setContentSize(980, 660));
    await assertLayout();
    await project.screenshot({ path: 'artifacts/workbench-project-title.png' });
    const before = (await project.locator('.explorer-panel').boundingBox()).width;
    const divider = project.getByRole('separator', { name: '调整文件目录宽度', exact: true });
    await divider.focus();
    await project.keyboard.press('ArrowLeft');
    await project.waitForFunction(
      (width) =>
        document.querySelector('.explorer-panel').getBoundingClientRect().width === width - 16,
      before,
    );
    await (await app.browserWindow(project)).evaluate((target) => target.setContentSize(1700, 900));
    await project.waitForFunction(
      (width) =>
        document.querySelector('.explorer-panel').getBoundingClientRect().width === width - 16,
      before,
    );
    assert.equal(
      await project.evaluate(
        () => window.__originalTerminal === document.querySelector('.terminal-host'),
      ),
      true,
    );
    await closeProject(app, project);
  }
  assert.deepEqual(errors, []);
  console.log(
    'Project windows passed: independent sessions/terminals, scoped IPC, launch/focus/minimize/close/crash/reopen, manager recreation, theme sync, icon actions, responsive cards, complete long project names, automatic sidebar widths, narrow-window wrapping and manual resize preservation.',
  );
} finally {
  await app?.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
