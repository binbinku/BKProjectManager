import { startProject, closeProject } from './native-menu.mjs';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-github-ui-'));
const workspace = path.join(temporary, 'Workspace');
const projects = path.join(workspace, 'WebDev/Projects');
const config = (name) => path.join(projects, name, '.git/config');
let app;
async function waitForRepositoryMenu() {
  await app.evaluate(async () => {
    const deadline = Date.now() + 10000;
    while (!global.__repositoryMenu) {
      if (Date.now() > deadline) throw new Error('Repository menu did not open');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });
}
try {
  await mkdir('artifacts', { recursive: true });
  for (const name of ['Single', 'Multiple', 'Local', 'GitLab']) {
    await mkdir(path.join(projects, name), { recursive: true });
    await writeFile(
      path.join(projects, name, 'sample.ts'),
      'export const repository = "GitHub";\n',
    );
    if (name !== 'Local') await mkdir(path.join(projects, name, '.git'));
  }
  await writeFile(config('Single'), '[remote "origin"]\nurl = git@github.com:demo/single.git\n');
  await writeFile(
    config('Multiple'),
    '[remote "upstream"]\nurl = https://github.com/team/upstream.git\n[remote "origin"]\nurl = ssh://git@github.com/demo/fork.git\n',
  );
  await writeFile(config('GitLab'), '[remote "origin"]\nurl = https://gitlab.com/demo/local.git\n');
  app = await electron.launch({
    executablePath: process.env.BKPM_SMOKE_EXECUTABLE
      ? path.resolve(process.env.BKPM_SMOKE_EXECUTABLE)
      : undefined,
    args: process.env.BKPM_SMOKE_EXECUTABLE ? [] : ['.'],
    env: {
      ...process.env,
      BKPM_USER_DATA: path.join(temporary, 'settings'),
      ELECTRON_RENDERER_URL: '',
    },
  });
  let page = await app.firstWindow();
  const manager = page;
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ dialog, shell, Menu }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
    global.__openedRepositories = [];
    shell.openExternal = async (url) => {
      global.__openedRepositories.push(url);
    };
    const build = Menu.buildFromTemplate;
    Menu.buildFromTemplate = (template) => {
      const menu = build(template);
      menu.popup = (options) => {
        global.__repositoryMenu = { menu, options };
      };
      return menu;
    };
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  const card = (name) =>
    page.locator('.project-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const github = (name) =>
    page.getByRole('button', { name: `打开 ${name} 的 GitHub 仓库`, exact: true });
  assert.equal(await page.locator('.github-open').count(), 2);
  for (const name of ['Local', 'GitLab'])
    assert.equal(await card(name).locator('.github-open').count(), 0);
  const opened = () => app.evaluate(() => global.__openedRepositories);
  await github('Single').click();
  await page.waitForFunction(() => !document.querySelector('.github-open').disabled);
  assert.deepEqual(await opened(), ['https://github.com/demo/single']);

  await github('Multiple').click();
  await waitForRepositoryMenu();
  const labels = await app.evaluate(() =>
    global.__repositoryMenu.menu.items.map((item) => item.label),
  );
  assert.deepEqual(labels, ['origin · demo/fork', 'upstream · team/upstream']);
  await app.evaluate(({ BrowserWindow }) => {
    const { menu, options } = global.__repositoryMenu;
    global.__repositoryMenu = null;
    menu.items[1].click(menu.items[1], BrowserWindow.getAllWindows()[0]);
    options.callback();
  });
  await page.waitForFunction(() => !document.querySelector('.github-open').disabled);
  assert.equal((await opened()).at(-1), 'https://github.com/team/upstream');
  await github('Multiple').click();
  await waitForRepositoryMenu();
  await app.evaluate(() => {
    global.__repositoryMenu.options.callback();
    global.__repositoryMenu = null;
  });
  await page.waitForFunction(() => !document.querySelector('.github-open').disabled);
  assert.equal((await opened()).length, 2);

  await page.getByRole('button', { name: '显示方式', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '列表视图', exact: true }).click();
  assert.equal(await page.locator('.list-view .github-open').count(), 2);
  await writeFile(
    config('Single'),
    '[remote "origin"]\nurl = https://secret-token@github.com/demo/renamed.git\n',
  );
  await github('Single').click();
  await page.waitForFunction(() => !document.querySelector('.github-open').disabled);
  assert.equal((await opened()).at(-1), 'https://github.com/demo/renamed');
  assert.ok(!(await page.locator('body').innerText()).includes('secret-token'));
  page = await startProject(
    app,
    manager,
    card('Single').getByRole('button', { name: '启动项目', exact: true }),
  );
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('treeitem', { name: '查看 sample.ts', exact: true }).click();
  await page.locator('.code-content .shiki').waitFor();
  await page.locator('.terminal-host[data-running="true"]').waitFor();
  await page.evaluate(() => {
    window.__originalTerminal = document.querySelector('.terminal-host');
  });
  await github('Single').click();
  await page.waitForFunction(() => !document.querySelector('.github-open').disabled);
  assert.equal((await opened()).at(-1), 'https://github.com/demo/renamed');
  assert.equal(
    await page.evaluate(
      () => window.__originalTerminal === document.querySelector('.terminal-host'),
    ),
    true,
  );
  assert.ok((await page.locator('.code-content').textContent()).includes('repository'));
  await (await app.browserWindow(page)).evaluate((target) => target.setContentSize(980, 660));
  const header = await page.locator('.workbench-navigation-header').boundingBox();
  for (const selector of ['.back-projects', '.github-open', '.external-open:not(.github-open)']) {
    const rect = await page.locator(selector).boundingBox();
    assert.ok(rect.x >= header.x && rect.x + rect.width <= header.x + header.width);
  }
  await page.screenshot({ path: 'artifacts/github-workbench.png' });
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.openGitHub('https://evil.test/repo')),
    /只能操作当前窗口/,
  );
  const state = await page.evaluate(() => window.workspaceAPI.getState());
  const single = state.snapshot.projects.find((project) => project.name === 'Single');
  await writeFile(config('Single'), '[remote "origin"]\nurl = https://gitlab.com/demo/moved.git\n');
  await assert.rejects(
    page.evaluate((id) => window.workspaceAPI.openGitHub(id), single.id),
    /未找到 GitHub/,
  );
  await closeProject(app, page);
  page = manager;
  await page.getByRole('button', { name: '重新扫描', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.github-open').length === 1);
  assert.deepEqual(errors, []);
  console.log(
    'GitHub smoke passed: conditional buttons in cards/list/workbench, HTTPS/SSH, native remote selection/cancel, default origin, fresh config validation, credential-free URLs, preserved terminal/preview, minimum window and rescan.',
  );
} finally {
  await app?.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
