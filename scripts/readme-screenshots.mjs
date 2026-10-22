import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

// Use sample projects and isolated settings. Never read the user's workspace.
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-readme-'));
const workspace = path.join(temporary, 'Workspace');
const output = path.resolve('docs/assets');
const demoProjects = [
  ['WebDev/Projects/DesignSystem', ['package.json', '.git']],
  ['WebDev/Projects/AtlasWeb', ['package.json', '.git']],
  ['GameDev/Projects/OrbitGame', ['Assets/.keep', 'ProjectSettings/.keep']],
  ['FlutterDev/Projects/PocketNotes', ['pubspec.yaml', '.git']],
  ['TestDev/DevTools', ['package.json']],
  ['AndroidDev/Projects', ['settings.gradle.kts', 'build.gradle.kts']],
];
let application;
try {
  for (const [index, [directory, files]] of demoProjects.entries()) {
    const target = path.join(workspace, directory);
    await mkdir(target, { recursive: true });
    for (const file of files) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      await writeFile(path.join(target, file), '{}');
    }
    const modified = new Date(Date.now() - index * 86400000);
    await utimes(target, modified, modified);
  }
  await mkdir(output, { recursive: true });
  application = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      BKPM_USER_DATA: path.join(temporary, 'user-data'),
      ELECTRON_RENDERER_URL: '',
    },
  });
  const page = await application.firstWindow();
  page.setDefaultTimeout(15000);
  console.log('Documentation window ready.');
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1360, 900),
  );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();

  async function theme(value) {
    const radio = page
      .getByRole('radiogroup', { name: '外观主题', exact: true })
      .getByRole('radio', { name: value === 'dark' ? '暗色' : '亮色', exact: true });
    if (!(await radio.isChecked())) await radio.click();
    await page.waitForFunction(
      (value) =>
        document.documentElement.dataset.theme === value &&
        !document.querySelector(`input[name="sidebar-theme"][value="${value}"]`).disabled,
      value,
    );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  async function capture(name, selector) {
    console.log(`Capturing ${name}...`);
    // Present only a generic demo path; keep the actual scanner data intact.
    await page.locator('.summary-path > span, .settings-path').evaluateAll((elements) => {
      for (const element of elements) {
        element.textContent = '~/Workspace';
        element.title = '~/Workspace';
      }
    });
    await page.evaluate(() => document.fonts.ready);
    const target = selector ? page.locator(selector) : page;
    await target.screenshot({
      path: path.join(output, name),
      scale: 'css',
      animations: 'disabled',
    });
  }
  await theme('light');
  await capture('welcome.png');
  await application.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.locator('.project-card').count(), 6);
  for (const name of ['DesignSystem', 'DevTools']) {
    await page.getByRole('button', { name: `收藏 ${name}`, exact: true }).click();
    await page.getByRole('button', { name: `取消收藏 ${name}`, exact: true }).waitFor();
  }
  await capture('workspace-light.png');
  await theme('dark');
  await capture('workspace-dark.png');
  await page.getByRole('button', { name: '列表视图' }).click();
  await page.locator('.list-view').waitFor();
  await capture('list-dark.png');
  await page.getByRole('button', { name: '设置', exact: false }).last().click();
  await page.getByRole('dialog').waitFor();
  await capture('settings-dark.png', '.settings-modal');
  assert.deepEqual(errors, []);
  console.log('Saved 5 documentation screenshots with sample projects to docs/assets.');
} finally {
  if (application) await application.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
