import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, readdir, rm, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-management-'));
const workspace = path.join(await realpath(temporary), 'Workspace');
const otherWorkspace = path.join(await realpath(temporary), 'OtherWorkspace');
await mkdir(path.join(workspace, 'WebDev', 'Projects', 'Existing'), { recursive: true });
await mkdir(path.join(workspace, 'AndroidDev', 'Projects'), { recursive: true });
await writeFile(path.join(workspace, 'AndroidDev', 'Projects', 'settings.gradle.kts'), '');
await mkdir(path.join(otherWorkspace, 'DesignDev', 'Projects'), { recursive: true });
await mkdir('artifacts', { recursive: true });
let app;
const errors = [];
async function launch() {
  app = await electron.launch({
    executablePath: process.env.BKPM_SMOKE_EXECUTABLE
      ? path.resolve(process.env.BKPM_SMOKE_EXECUTABLE)
      : undefined,
    args: process.env.BKPM_SMOKE_EXECUTABLE ? [] : ['.'],
    env: {
      ...process.env,
      BKPM_USER_DATA: path.join(temporary, 'user-data'),
      ELECTRON_RENDERER_URL: '',
    },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
async function assertFocusInside(page) {
  assert.equal(
    await page
      .locator('.management-modal')
      .evaluate((element) => element.contains(document.activeElement)),
    true,
  );
}
try {
  let page = await launch();
  await page.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.locator('.category-nav .category-icon').count(), 2);
  const initialColors = await page
    .locator('.category-nav .category-icon')
    .evaluateAll((icons) => icons.map((icon) => getComputedStyle(icon).color));
  assert.equal(new Set(initialColors).size, 2);
  await page.getByRole('button', { name: '新增分类', exact: true }).click();
  await page.getByRole('textbox', { name: '分类名称' }).fill('DesignDev');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '紫色', exact: true }).click();
  await dialog.getByRole('button', { name: '设计', exact: true }).click();
  await page.screenshot({ path: 'artifacts/create-category.png' });
  await dialog.getByRole('button', { name: '创建分类', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(await readdir(path.join(workspace, 'DesignDev')), ['Projects']);
  await page.getByRole('button', { name: '新建项目', exact: true }).first().click();
  await page.getByRole('textbox', { name: '项目名称' }).fill('Sketch');
  assert.equal(await page.getByLabel('所属分类').inputValue(), 'DesignDev');
  assert.equal(
    await page.getByLabel('所属分类').locator('option[value="AndroidDev"]').isDisabled(),
    true,
  );
  await page.screenshot({ path: 'artifacts/create-project.png' });
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await readdir(path.join(workspace, 'DesignDev', 'Projects', 'Sketch')), []);
  assert.equal(await page.locator('.project-card h2').textContent(), 'Sketch');
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('项目名称').fill('sketch');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('dialog').getByRole('alert').filter({ hasText: '已存在' }).waitFor();
  await assertFocusInside(page);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '分类操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '修改分类外观' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '青色', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '工具', exact: true }).click();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    await assertFocusInside(page);
  }
  await page.getByRole('button', { name: '保存外观', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  const style = { color: 'teal', icon: 'box' };
  let state = await page.evaluate(() => window.workspaceAPI.getState());
  assert.deepEqual(state.settings.categoryStyles[workspace].DesignDev, style);
  assert.equal(await page.locator('.card-category .category-icon.teal').count(), 1);
  await page.screenshot({ path: 'artifacts/category-projects-light.png' });
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('所属分类').selectOption('WebDev');
  await page.getByLabel('项目名称').fill('NewWeb');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(
    await readdir(path.join(workspace, 'WebDev', 'Projects')).then((items) => items.sort()),
    ['Existing', 'NewWeb'],
  );
  // No-op cancel leaves the filesystem intact.
  await page.getByRole('button', { name: '新增分类', exact: true }).click();
  await page.getByLabel('分类名称').fill('Canceled');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal((await readdir(workspace)).includes('Canceled'), false);
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.createProject('AndroidDev', 'Wrong')),
    /本身是一个工程/,
  );
  await assert.rejects(
    page.evaluate(() =>
      window.workspaceAPI.createCategory('../escape', { color: 'blue', icon: 'folder' }),
    ),
    /名称不能/,
  );
  await assert.rejects(
    page.evaluate(() =>
      window.workspaceAPI.setCategoryStyle('WebDev', { color: 'bad', icon: 'bad' }),
    ),
    /有效/,
  );
  await page.evaluate(() => window.workspaceAPI.setTheme('dark'));
  await app.close();
  page = await launch();
  await page.locator('.project-card').first().waitFor();
  state = await page.evaluate(() => window.workspaceAPI.getState());
  assert.equal(state.snapshot.projects.length, 4);
  assert.deepEqual(state.settings.categoryStyles[workspace].DesignDev, style);
  await page.getByRole('button', { name: /DesignDev/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.screenshot({ path: 'artifacts/category-projects-dark.png' });
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, otherWorkspace);
  await page.evaluate(() => window.workspaceAPI.chooseWorkspace());
  state = await page.evaluate(() => window.workspaceAPI.getState());
  assert.equal(state.settings.categoryStyles[otherWorkspace], undefined);
  assert.deepEqual(state.settings.categoryStyles[workspace].DesignDev, style);
  const saved = JSON.parse(
    await readFile(path.join(temporary, 'user-data', 'settings.json'), 'utf8'),
  );
  assert.deepEqual(saved.categoryStyles[workspace].DesignDev, style);
  assert.deepEqual(errors, []);
  console.log(
    'Management smoke passed: category icons/colors, creation, empty projects, duplicate protection, cancel, focus, appearance, persistence, workspace isolation and invalid IPC requests.',
  );
} finally {
  if (app) await app.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
