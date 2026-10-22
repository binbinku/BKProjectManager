import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-smoke-'));
const fixture = path.join(temporary, 'Workspace');
for (const [directory, files] of [
  ['WebDev/Projects/MyWeb', ['package.json']],
  ['WebDev/Projects/Landing', ['package.json']],
  ['TestDev/工具箱', []],
  ['AndroidDev/Projects', ['settings.gradle.kts']],
  ['AndroidDev/Projects/app', ['build.gradle.kts']],
]) {
  const target = path.join(fixture, directory);
  await mkdir(target, { recursive: true });
  for (const file of files) await writeFile(path.join(target, file), '{}');
}
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
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  return page;
}
async function chooseTheme(page, value, group = '外观主题') {
  const labels = { light: '亮色', dark: '暗色', system: '跟随系统' };
  const radio = page
    .getByRole('radiogroup', { name: group, exact: true })
    .getByRole('radio', { name: labels[value], exact: true });
  if (!(await radio.isChecked())) await radio.click();
  await page.waitForFunction(
    ({ name, value }) =>
      document.querySelector(`input[name="${name}"][value="${value}"]`)?.checked &&
      !document.querySelector(`input[name="${name}"][value="${value}"]`)?.disabled,
    { name: group === '外观主题' ? 'sidebar-theme' : 'settings-theme', value },
  );
  await page.waitForFunction(
    async (expected) => (await window.workspaceAPI.getState()).settings.theme === expected,
    value,
  );
  if (value !== 'system')
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      value,
    );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  if (value !== 'system') {
    const colors = await page.locator('.workspace-switch').evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      scheme: getComputedStyle(element).colorScheme,
    }));
    assert.equal(
      colors.background,
      value === 'dark' ? 'rgb(32, 32, 32)' : 'rgb(255, 255, 255)',
      JSON.stringify(colors),
    );
  }
}
try {
  let page = await launch();
  await page
    .getByRole('button', { name: '选择工作空间', exact: true })
    .waitFor({ state: 'visible' });
  await chooseTheme(page, 'light');
  await page.screenshot({ path: 'artifacts/welcome.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await chooseTheme(page, 'system');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource), 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await chooseTheme(page, 'dark');
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
    'rgb(25, 25, 25)',
  );
  await page.screenshot({ path: 'artifacts/welcome-dark.png' });
  await page.emulateMedia({ colorScheme: null });
  await app.evaluate(({ dialog, shell }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
    globalThis.__opened = [];
    shell.openPath = async (target) => {
      globalThis.__opened.push(target);
      return '';
    };
  }, fixture);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.locator('.project-card').count(), 4);
  assert.equal(
    await page
      .locator('.project-card h2')
      .allTextContents()
      .then((a) => a.includes('app')),
    false,
  );
  await page.getByRole('button', { name: '收藏 MyWeb', exact: true }).click();
  await page.getByRole('button', { name: '取消收藏 MyWeb', exact: true }).waitFor();
  await page.getByRole('button', { name: /我的收藏/ }).click();
  assert.equal(await page.locator('.project-card').count(), 1);
  await page.getByRole('button', { name: /全部项目/ }).click();
  await page.getByRole('textbox', { name: '搜索项目' }).fill('工具箱');
  assert.equal(await page.locator('.project-card').count(), 1);
  await page.getByRole('button', { name: '打开 工具箱 文件夹' }).click();
  await page.getByRole('status').waitFor();
  assert.deepEqual(await app.evaluate(() => globalThis.__opened), [
    await realpath(path.join(fixture, 'TestDev/工具箱')),
  ]);
  await page.getByRole('button', { name: '清空搜索' }).click();
  await page.getByRole('button', { name: '列表视图' }).click();
  await page.locator('.list-view').waitFor();
  await page.getByRole('button', { name: '设置', exact: false }).last().click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('默认打开方式').selectOption('vscode');
  await chooseTheme(page, 'light', '设置外观主题');
  await page.screenshot({ path: 'artifacts/settings-light.png' });
  await chooseTheme(page, 'dark', '设置外观主题');
  await page.screenshot({ path: 'artifacts/settings-dark.png' });
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.screenshot({ path: 'artifacts/list.png' });
  await app.close();
  page = await launch();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.locator('.project-card').count(), 4);
  assert.equal(await page.getByRole('button', { name: '取消收藏 MyWeb', exact: true }).count(), 1);
  const restored = await page.evaluate(() => window.workspaceAPI.getState());
  assert.equal(restored.settings.opener, 'vscode');
  assert.equal(restored.settings.theme, 'dark');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource), 'dark');
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.setTheme('invalid')),
    /无效的外观主题/,
  );
  assert.equal(Object.keys(restored.settings.recent).length, 1);
  if (process.env.BKPM_SMOKE_WORKSPACE) {
    await app.evaluate(({ dialog }, workspace) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
    }, process.env.BKPM_SMOKE_WORKSPACE);
    await page.getByRole('button', { name: '设置', exact: false }).last().click();
    await page.getByRole('button', { name: '更换工作空间' }).click();
    await page
      .getByRole('dialog')
      .getByText(process.env.BKPM_SMOKE_WORKSPACE, { exact: true })
      .waitFor();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    const realState = await page.evaluate(() => window.workspaceAPI.getState());
    console.log(
      `Real workspace: ${realState.snapshot.projects.length} projects, ${realState.snapshot.categories.length} categories`,
    );
  }
  await chooseTheme(page, 'light');
  await page.screenshot({ path: 'artifacts/workspace-light.png' });
  await chooseTheme(page, 'dark');
  await page.screenshot({ path: 'artifacts/workspace-dark.png' });
  await page.screenshot({ path: 'artifacts/workspace.png' });
  assert.deepEqual(errors, []);
  console.log(
    'Electron smoke passed: onboarding, scan, favorites, search, folder action, list, light/dark/system themes, system changes, native appearance, settings, validation, and persistence.',
  );
} finally {
  if (app) await app.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
