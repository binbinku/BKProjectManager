import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readdir, readFile, rm, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { clickMenu } from './native-menu.mjs';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-removal-'));
const root = await realpath(temporary);
const workspace = path.join(root, 'Workspace');
const otherWorkspace = path.join(root, 'OtherWorkspace');
for (const directory of ['WebDev/Projects/Alpha', 'WebDev/Projects/Beta', 'TestDev/Tools', 'Empty'])
  await mkdir(path.join(workspace, directory), { recursive: true });
await mkdir(path.join(otherWorkspace, 'WebDev/Projects/Alpha'), { recursive: true });
await writeFile(path.join(workspace, 'WebDev/Projects/Alpha/package.json'), '{"untouched":true}');
await writeFile(path.join(workspace, 'TestDev/Tools/keep.txt'), 'keep me');
await mkdir('artifacts', { recursive: true });
async function tree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => ({
        name: entry.name,
        content: entry.isDirectory()
          ? await tree(path.join(directory, entry.name))
          : await readFile(path.join(directory, entry.name), 'utf8'),
      })),
  );
}
const original = await tree(workspace);
const errors = [];
let app;
async function launch() {
  app = await electron.launch({
    executablePath: process.env.BKPM_SMOKE_EXECUTABLE
      ? path.resolve(process.env.BKPM_SMOKE_EXECUTABLE)
      : undefined,
    args: process.env.BKPM_SMOKE_EXECUTABLE ? [] : ['.'],
    env: {
      ...process.env,
      BKPM_USER_DATA: path.join(root, 'user-data'),
      ELECTRON_RENDERER_URL: '',
    },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ shell }) => {
    globalThis.__revealed = [];
    shell.showItemInFolder = (target) => globalThis.__revealed.push(target);
    shell.openPath = async () => '';
  });
  return page;
}
async function settings(page) {
  await clickMenu(app, 'settings');
  await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
}
async function closeSettings(page) {
  await page.getByRole('button', { name: '完成', exact: true }).click();
}
async function hiddenProject(page, name) {
  await page.getByRole('button', { name: `移除项目 ${name}`, exact: true }).click();
  await page.getByRole('button', { name: '从列表移除', exact: false }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}
async function hideCategory(page, name) {
  await page
    .getByRole('navigation', { name: '项目分类', exact: true })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await page.getByRole('button', { name: `移除分类 ${name}`, exact: true }).click();
  await page.getByRole('button', { name: '从列表移除', exact: false }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}
try {
  let page = await launch();
  await page.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.locator('.project-card').count(), 3);
  await page.getByRole('button', { name: '移除项目 Alpha', exact: true }).click();
  assert.equal(
    await page
      .getByRole('dialog')
      .getByText(path.join(workspace, 'WebDev/Projects/Alpha'), { exact: true })
      .count(),
    1,
  );
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .locator('.remove-modal')
        .evaluate((modal) => modal.contains(document.activeElement)),
      true,
    );
  }
  await page.screenshot({ path: 'artifacts/remove-project-light.png' });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await page.locator('.project-card').count(), 3);
  await page.getByRole('button', { name: '移除项目 Beta', exact: true }).click();
  await page.getByRole('button', { name: /中显示，手动删除/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await app.evaluate(() => globalThis.__revealed), [
    path.join(workspace, 'WebDev/Projects/Beta'),
  ]);
  assert.equal(await page.locator('.project-card').count(), 3);
  assert.deepEqual(await tree(workspace), original);
  await page.getByRole('button', { name: '收藏 Alpha', exact: true }).click();
  await page.getByRole('button', { name: '取消收藏 Alpha', exact: true }).waitFor();
  await page.getByRole('button', { name: '打开 Alpha 文件夹', exact: true }).click();
  await page
    .getByRole('button', { name: '移除项目 Alpha', exact: true })
    .waitFor({ state: 'visible' });
  const before = await page.evaluate(() => window.workspaceAPI.getState());
  const alphaId = before.snapshot.projects.find((project) => project.name === 'Alpha').id;
  await hiddenProject(page, 'Alpha');
  assert.equal(await page.locator('.project-card').count(), 2);
  for (const name of [/我的收藏/, /最近打开/]) {
    await page.getByRole('button', { name }).click();
    assert.equal(await page.locator('.project-card').count(), 0);
  }
  await page.getByRole('button', { name: /全部项目/ }).click();
  await page.getByRole('button', { name: '重新扫描', exact: true }).click();
  await page.getByRole('button', { name: '重新扫描', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('.project-card').count(), 2);
  await assert.rejects(
    page.evaluate((id) => window.workspaceAPI.openWorkbench(id), alphaId),
    /已不存在/,
  );
  await app.close();
  page = await launch();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.locator('.project-card').count(), 2);
  await settings(page);
  await page.getByRole('button', { name: '恢复项目 WebDev/Projects/Alpha', exact: true }).click();
  await page
    .getByRole('button', { name: '恢复项目 WebDev/Projects/Alpha', exact: true })
    .waitFor({ state: 'detached' });
  await closeSettings(page);
  assert.equal(await page.getByRole('button', { name: '取消收藏 Alpha', exact: true }).count(), 1);
  let state = await page.evaluate(() => window.workspaceAPI.getState());
  assert.ok(state.settings.recent[alphaId]);
  await hiddenProject(page, 'Alpha');
  await hideCategory(page, 'WebDev');
  assert.equal(await page.locator('.project-card').count(), 1);
  assert.equal(
    await page
      .getByRole('navigation', { name: '项目分类', exact: true })
      .getByRole('button', { name: /WebDev/ })
      .count(),
    0,
  );
  await settings(page);
  assert.equal(
    await page
      .getByRole('button', { name: '恢复项目 WebDev/Projects/Alpha', exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({ path: 'artifacts/removed-settings-light.png' });
  await page.getByRole('button', { name: '恢复分类 WebDev', exact: true }).click();
  await page
    .getByRole('button', { name: '恢复项目 WebDev/Projects/Alpha', exact: true })
    .waitFor({ state: 'visible' });
  await closeSettings(page);
  assert.equal(await page.locator('.project-card').count(), 2);
  await hideCategory(page, 'Empty');
  await settings(page);
  await page.getByRole('button', { name: '全部恢复', exact: true }).click();
  await page.getByText('没有已移除的分类或项目。', { exact: true }).waitFor();
  await closeSettings(page);
  assert.equal(await page.locator('.project-card').count(), 3);
  await hideCategory(page, 'WebDev');
  await settings(page);
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, otherWorkspace);
  await page.getByRole('button', { name: '更换工作空间', exact: true }).click();
  await page.getByText('没有已移除的分类或项目。', { exact: true }).waitFor();
  await closeSettings(page);
  assert.equal(await page.locator('.project-card h2').textContent(), 'Alpha');
  await settings(page);
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await page.getByRole('button', { name: '更换工作空间', exact: true }).click();
  await page.getByRole('button', { name: '恢复分类 WebDev', exact: true }).click();
  await page.getByText('没有已移除的分类或项目。', { exact: true }).waitFor();
  await closeSettings(page);
  assert.deepEqual(
    await tree(workspace),
    original,
    'Every app removal/restore/reveal leaves all folders and file contents unchanged',
  );
  await page
    .getByRole('navigation', { name: '项目分类', exact: true })
    .getByRole('button', { name: /WebDev/ })
    .click();
  await page.getByRole('button', { name: '移除分类 WebDev', exact: true }).click();
  await page.getByRole('button', { name: /中显示，手动删除/ }).click();
  assert.deepEqual(await app.evaluate(() => globalThis.__revealed), [workspace + '/WebDev']);
  // Simulate a user's deletion in this disposable fixture, never through the app.
  await rm(path.join(workspace, 'WebDev/Projects/Beta'), { recursive: true });
  await page.getByRole('button', { name: '重新扫描', exact: true }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('.project-card h2')].some(
        (title) => title.textContent === 'Beta',
      ),
  );
  await settings(page);
  await page.getByRole('radio', { name: '暗色', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.theme === 'dark' &&
      !document.querySelector('input[value="dark"]').disabled,
  );
  await closeSettings(page);
  await page.getByRole('button', { name: '移除项目 Alpha', exact: true }).click();
  await page.screenshot({ path: 'artifacts/remove-project-dark.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.removeItem('invalid', 'anything')),
    /无效/,
  );
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.revealItem('category', '../escape')),
    /已不存在/,
  );
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.restoreItem('project', 'not-hidden')),
    /不在移除列表/,
  );
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.removeItem('project', 'not-a-project')),
    /已不存在/,
  );
  assert.equal(
    await readFile(path.join(workspace, 'WebDev/Projects/Alpha/package.json'), 'utf8'),
    '{"untouched":true}',
  );
  state = await page.evaluate(() => window.workspaceAPI.getState());
  assert.deepEqual(state.settings.visibility[workspace], { categories: [], projects: [] });
  assert.deepEqual(errors, []);
  console.log(
    'Removal smoke passed: cancel, modal focus, project/category removal, restore, restart/rescan persistence, favorites/recent retention, workspace isolation, Finder reveal, untouched filesystem and manual deletion rescan.',
  );
} finally {
  if (app) await app.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
