import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { clickMenu } from './native-menu.mjs';
const palettes = createRequire(import.meta.url)('../electron/palettes.json');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-palette-ui-'));
const workspace = path.join(temporary, 'Workspace');
const project = path.join(workspace, 'WebDev/Projects/PaletteDemo');
await mkdir(project, { recursive: true });
await writeFile(path.join(project, 'package.json'), '{}');
await writeFile(path.join(project, 'sample.ts'), 'export const theme = "colors only";\n');
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
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
async function settings(page) {
  await clickMenu(app, 'settings');
  await page.getByRole('dialog', { name: '设置', exact: true }).waitFor();
}
async function appearance(page, mode, palette) {
  await settings(page);
  const radio = page
    .getByRole('radiogroup', { name: '设置外观主题', exact: true })
    .getByRole('radio', {
      name: { light: '亮色', dark: '暗色', system: '跟随系统' }[mode],
      exact: true,
    });
  if (!(await radio.isChecked())) await radio.click();
  await page.waitForFunction(
    () => !document.querySelector('input[name="settings-theme"]:checked').disabled,
  );
  const color = page
    .getByRole('radiogroup', { name: '配色主题', exact: true })
    .getByRole('radio', { name: palettes[palette].name, exact: true });
  if (!(await color.isChecked())) await color.click();
  await page.waitForFunction(
    (expected) =>
      document.documentElement.dataset.palette === expected &&
      !document.querySelector('input[name="settings-palette"]:checked').disabled,
    palette,
  );
  if (mode !== 'system')
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      mode,
    );
  await page.getByRole('button', { name: '完成', exact: true }).click();
}
async function geometry(page, selectors) {
  return page.evaluate(
    (selectors) =>
      selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)].map((element) => {
          const rect = element.getBoundingClientRect();
          return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      ),
    selectors,
  );
}
function rgb(hex) {
  return `rgb(${[1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
}
async function checkColors(page, palette, mode) {
  const colors = palettes[palette].colors[mode];
  const actual = await page.evaluate(() => ({
    background: getComputedStyle(document.documentElement).backgroundColor,
    foreground: getComputedStyle(document.documentElement).color,
    sidebar: getComputedStyle(document.querySelector('.sidebar, .explorer-panel')).backgroundColor,
  }));
  assert.equal(actual.background, rgb(colors.canvas));
  assert.equal(actual.foreground, rgb(colors.text));
  assert.equal(actual.sidebar, rgb(colors.sidebar));
  const native = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getBackgroundColor(),
  );
  assert.equal(native.slice(-6).toLowerCase(), colors.canvas.slice(1));
}
try {
  let page = await launch();
  await page.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  const mainSelectors = [
    '.sidebar',
    '.brand',
    '.content',
    '.project-card',
    '.project-tools',
    '.project-tool-button',
  ];
  const main = await geometry(page, mainSelectors);
  for (const mode of ['light', 'dark'])
    for (const palette of Object.keys(palettes)) {
      await appearance(page, mode, palette);
      await checkColors(page, palette, mode);
      assert.deepEqual(
        await geometry(page, mainSelectors),
        main,
        `${palette}/${mode}: switching colors never moves or resizes the project UI`,
      );
      await page.screenshot({ path: `artifacts/palette-${palette}-${mode}.png` });
    }
  await settings(page);
  await page
    .getByRole('radiogroup', { name: '配色主题', exact: true })
    .screenshot({ path: 'artifacts/palette-selector.png' });
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await settings(page);
  const selected = page
    .getByRole('radiogroup', { name: '配色主题', exact: true })
    .getByRole('radio', { name: palettes.neo.name, exact: true });
  await selected.focus();
  await selected.press('ArrowRight');
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.palette === 'default' &&
      document.activeElement?.getAttribute('name') === 'settings-palette' &&
      !document.querySelector('input[name="settings-palette"]:checked').disabled,
  );
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '打开项目', exact: true }).click();
  await page.getByRole('treeitem', { name: '查看 sample.ts', exact: true }).click();
  await page.locator('.code-content .shiki span[style]').first().waitFor();
  const terminal = page.locator('.terminal-host .xterm-helper-textarea');
  await page.waitForFunction(
    () => document.querySelector('.terminal-host .xterm-rows')?.textContent?.trim().length > 0,
  );
  if (process.platform !== 'win32') {
    await terminal.focus();
    await terminal.pressSequentially(
      "BKPM_PALETTE_SESSION=kept; printf '\\033[38;2;215;119;87mPALETTE_ORANGE\\033[0m\\n'",
      { delay: 1 },
    );
    await terminal.press('Enter');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.xterm-rows span')].some(
        (span) =>
          span.textContent.includes('PALETTE_ORANGE') &&
          getComputedStyle(span).color === 'rgb(215, 119, 87)',
      ),
    );
  }
  const workbenchSelectors = [
    '.explorer-panel',
    '.file-panel',
    '.terminal-panel',
    '.panel-resizer',
    '.workbench-navigation-header',
    '.file-viewport',
    '.terminal-host',
  ];
  const workbench = await geometry(page, workbenchSelectors);
  const syntax = {};
  for (const mode of ['light', 'dark'])
    for (const palette of Object.keys(palettes)) {
      await appearance(page, mode, palette);
      await checkColors(page, palette, mode);
      assert.deepEqual(
        await geometry(page, workbenchSelectors),
        workbench,
        `${palette}/${mode}: workbench layout remains identical`,
      );
      const current = await page.locator('.code-content').evaluate((element) => ({
        background: getComputedStyle(document.querySelector('.file-panel')).backgroundColor,
        tokens: [...element.querySelectorAll('.shiki span[style]')].map(
          (span) => getComputedStyle(span).color,
        ),
      }));
      assert.equal(current.background, mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(30, 30, 30)');
      if (!syntax[mode]) syntax[mode] = current;
      else
        assert.deepEqual(
          current,
          syntax[mode],
          'VS Code syntax colors remain independent of the UI palette',
        );
      assert.equal(
        await page
          .locator('.terminal-host .xterm-viewport')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
        rgb(palettes[palette].colors[mode].canvas),
      );
      if (process.platform !== 'win32')
        assert.ok(
          await page
            .locator('.xterm-rows span')
            .evaluateAll((spans) =>
              spans.some(
                (span) =>
                  span.textContent.includes('PALETTE_ORANGE') &&
                  getComputedStyle(span).color === 'rgb(215, 119, 87)',
              ),
            ),
        );
    }
  if (process.platform !== 'win32') {
    await terminal.focus();
    await terminal.pressSequentially('printf \'\\nSESSION_%s\\n\' "$BKPM_PALETTE_SESSION"', {
      delay: 1,
    });
    await terminal.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('.xterm-rows').textContent.includes('SESSION_kept'),
    );
  }
  await appearance(page, 'system', 'neo');
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode });
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      mode,
    );
    assert.equal(await page.evaluate(() => document.documentElement.dataset.palette), 'neo');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      rgb(palettes.neo.colors[mode].canvas),
    );
  }
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.setPalette('invalid')),
    /无效的配色主题/,
  );
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.setPalette('__proto__')),
    /无效的配色主题/,
  );
  await appearance(page, 'dark', 'neo');
  await app.close();
  page = await launch();
  await page.locator('.project-card').first().waitFor();
  const restored = await page.evaluate(() => window.workspaceAPI.getState());
  assert.equal(restored.settings.palette, 'neo');
  assert.equal(restored.settings.theme, 'dark');
  await checkColors(page, 'neo', 'dark');
  assert.deepEqual(errors, []);
  console.log(
    'Palette smoke passed: all seven palettes in both modes, native backgrounds, identical project/workbench geometry, unchanged VS Code highlighting and true-color output, live terminal session, system appearance, validation and restart persistence.',
  );
} finally {
  if (app) await app.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
