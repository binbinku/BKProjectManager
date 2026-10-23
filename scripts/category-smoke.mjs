import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, rm, realpath, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { clickMenu } from './native-menu.mjs';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-category-'));
const workspace = path.join(await realpath(temporary), 'Workspace');
for (let index = 0; index < 27; index++) {
  const folder = path.join(
    workspace,
    'WebDev/Projects',
    `Project${String(index).padStart(2, '0')}`,
  );
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'package.json'), '{}');
  await utimes(
    folder,
    new Date(1000000000000 + index * 100000),
    new Date(1000000000000 + index * 100000),
  );
}
await mkdir(path.join(workspace, 'Empty/Projects'), { recursive: true });
await mkdir('artifacts', { recursive: true });
let app;
const errors = [];
try {
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
  await page.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').first().waitFor();
  assert.equal(await page.getByRole('textbox', { name: '搜索项目' }).count(), 0);
  await page
    .getByRole('navigation', { name: '项目分类', exact: true })
    .getByRole('button', { name: /WebDev/ })
    .click();
  assert.equal(
    await page.locator('.project-card').count(),
    27,
    'Entering a category shows its projects',
  );
  for (const selector of [
    '.topbar',
    '.page-heading',
    '.workspace-summary',
    '.project-toolbar',
    '.results-caption',
    '.content-footer',
  ])
    assert.equal(
      await page.locator(selector).count(),
      0,
      `${selector} is absent from category pages`,
    );
  assert.equal(await page.getByRole('textbox', { name: '搜索项目' }).count(), 0);
  await page.getByRole('toolbar', { name: '项目工具栏' }).waitFor();
  for (const selector of ['.workspace-switch', '.sidebar-bottom', '.local-note', '.sidebar-drag'])
    assert.equal(await page.locator(selector).count(), 0);
  assert.equal(await page.getByRole('button', { name: '管理工作空间', exact: true }).count(), 0);
  const nativeButtons = await app.evaluate(({ BrowserWindow }) =>
    process.platform === 'darwin'
      ? BrowserWindow.getAllWindows()[0].getWindowButtonPosition()
      : null,
  );
  async function geometry() {
    const result = await page.evaluate(() => {
      const bar = document.querySelector('.project-tools');
      const bounds = bar.getBoundingClientRect();
      const rects = [...bar.querySelectorAll('.project-tool-button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const cards = [...document.querySelectorAll('.project-card')].map((card) =>
        card.getBoundingClientRect(),
      );
      return {
        brand: (() => {
          const header = document.querySelector('.brand').getBoundingClientRect();
          const logo = document.querySelector('.brand-mark').getBoundingClientRect();
          const name = document.querySelector('.brand-name');
          const text = name.getBoundingClientRect();
          return {
            top: header.top,
            logoLeft: logo.left,
            logoCenter: logo.top + logo.height / 2,
            textCenter: text.top + text.height / 2,
            textWidth: name.clientWidth,
            textScrollWidth: name.scrollWidth,
          };
        })(),
        position: getComputedStyle(bar).position,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        rects,
        viewport: { width: innerWidth, height: innerHeight },
        cardsEnd: Math.max(...cards.map((card) => card.right)),
        firstCardTop: cards[0].top,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert.equal(result.position, 'fixed');
    assert.equal(result.brand.top, 0);
    assert.ok(
      Math.abs(result.brand.logoCenter - result.brand.textCenter) < 1,
      'App icon and name share the top row',
    );
    assert.ok(
      result.brand.textScrollWidth <= result.brand.textWidth,
      'The app name fits even at the minimum window width',
    );
    if (nativeButtons) {
      assert.ok(
        Math.abs(result.brand.logoCenter - (nativeButtons.y + 6)) < 1,
        'The top row aligns with the native traffic lights',
      );
      assert.ok(
        result.brand.logoLeft > nativeButtons.x + 52,
        'Branding leaves the native window buttons clear',
      );
    }
    assert.equal(result.rects.length, 5);
    assert.ok(
      result.rects.every(
        (rect) => rect.width >= 40 && rect.height >= 40 && Math.abs(rect.x - result.rects[0].x) < 1,
      ),
    );
    assert.ok(result.rects.every((rect, i) => i === 0 || rect.y > result.rects[i - 1].y));
    assert.ok(
      result.bounds.x > result.cardsEnd + 10,
      'Floating controls keep a gutter clear of project cards',
    );
    assert.ok(result.bounds.y + result.bounds.height < result.viewport.height);
    assert.ok(result.scrollWidth <= result.viewport.width, 'No horizontal overflow');
    return result;
  }
  const initial = await geometry();
  assert.ok(initial.firstCardTop < 55, 'Projects begin near the window top');
  await page.screenshot({ path: 'artifacts/category-clean-light.png' });
  await page.getByRole('button', { name: '项目排序', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '按目录修改时间', exact: true }).click();
  assert.equal(await page.locator('.project-card h2').first().textContent(), 'Project26');
  await page.getByRole('button', { name: '项目排序', exact: true }).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.project-card h2').first().textContent(), 'Project00');
  await page.getByRole('button', { name: '显示方式', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '列表视图', exact: true }).click();
  await page.locator('.list-view').waitFor();
  await page.getByRole('button', { name: '显示方式', exact: true }).click();
  assert.equal(
    await page.getByRole('menuitemradio', { name: '列表视图' }).getAttribute('aria-checked'),
    'true',
  );
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0);
  assert.equal(
    await page
      .getByRole('button', { name: '显示方式', exact: true })
      .evaluate((button) => document.activeElement === button),
    true,
  );
  await page.getByRole('button', { name: '项目排序', exact: true }).click();
  await page.locator('.project-card h2').first().click();
  assert.equal(await page.getByRole('menu').count(), 0, 'Click outside dismisses menus');
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 1400);
  await page.waitForFunction(() => window.scrollY > 500);
  const scrolled = await geometry();
  assert.equal(
    scrolled.bounds.y,
    initial.bounds.y,
    'Floating controls remain fixed while scrolling',
  );
  await page.getByRole('button', { name: '重新扫描', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('.project-tools button[aria-label="重新扫描"]').disabled,
  );
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  assert.equal(await page.getByLabel('所属分类').inputValue(), 'WebDev');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '新建项目', exact: true })
      .evaluate((button) => document.activeElement === button),
    true,
    'Closing the dialog returns keyboard focus to its floating trigger',
  );
  await page.getByRole('button', { name: '分类操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '修改分类外观', exact: true }).click();
  await page.getByRole('dialog', { name: '分类外观', exact: true }).waitFor();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '分类操作', exact: true })
      .evaluate((button) => document.activeElement === button),
    true,
  );
  await page.getByRole('button', { name: '分类操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移除分类 WebDev', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page
    .getByRole('navigation', { name: '项目分类', exact: true })
    .getByRole('button', { name: /Empty/ })
    .click();
  assert.equal(await page.locator('.project-card').count(), 0);
  assert.equal(await page.getByRole('button', { name: '新建项目', exact: true }).count(), 1);
  await page
    .getByRole('navigation', { name: '项目分类', exact: true })
    .getByRole('button', { name: /WebDev/ })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '显示方式', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '卡片视图', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(980, 660),
  );
  await page.waitForFunction(() => innerWidth === 980);
  await geometry();
  await clickMenu(app, 'settings');
  await page.getByRole('radio', { name: '暗色', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.theme === 'dark' &&
      !document.querySelector('input[value="dark"]').disabled,
  );
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.screenshot({ path: 'artifacts/category-clean-dark-small.png' });
  await page.getByRole('button', { name: '显示方式', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '列表视图', exact: true }).click();
  await geometry();
  await page.getByRole('button', { name: /全部项目/ }).click();
  await page.getByRole('toolbar', { name: '项目工具栏' }).waitFor();
  assert.equal(await page.locator('.topbar, .workspace-summary, .project-toolbar').count(), 0);
  assert.equal(await page.getByRole('textbox', { name: '搜索项目' }).count(), 0);
  assert.equal(await page.locator('.project-tool-button').count(), 4);
  assert.equal(await page.getByRole('button', { name: '分类操作', exact: true }).count(), 0);
  // Favorites and recent use the same canvas, while keeping their own filtering and recent ordering.
  await app.evaluate(({ shell }) => {
    shell.openPath = async () => '';
  });
  await page.getByRole('button', { name: '收藏 Project00', exact: true }).click();
  await page.getByRole('button', { name: '取消收藏 Project00', exact: true }).waitFor();
  await page.getByRole('button', { name: '收藏 Project26', exact: true }).click();
  await page.getByRole('button', { name: '取消收藏 Project26', exact: true }).waitFor();
  for (const name of ['Project00', 'Project26']) {
    await page.getByRole('button', { name: `打开 ${name} 文件夹`, exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('.project-tools button[aria-label="重新扫描"]').disabled,
    );
  }
  for (const [label, first] of [
    [/我的收藏/, 'Project00'],
    [/最近打开/, 'Project26'],
  ]) {
    await page.getByRole('button', { name: label }).click();
    assert.equal(await page.locator('.project-card').count(), 2);
    assert.equal(await page.locator('.project-card h2').first().textContent(), first);
    assert.equal(
      await page
        .locator('.topbar, .workspace-summary, .project-toolbar, .results-caption, .content-footer')
        .count(),
      0,
    );
    assert.equal(await page.locator('.project-tool-button').count(), 4);
    await page.getByRole('button', { name: '显示方式', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '卡片视图', exact: true }).click();
    await page.getByRole('button', { name: '新建项目', exact: true }).click();
    await page.getByRole('dialog', { name: '新建项目', exact: true }).waitFor();
    await page.getByRole('button', { name: '取消', exact: true }).click();
  }
  await page.getByRole('button', { name: '项目排序', exact: true }).click();
  assert.equal(
    await page
      .getByRole('menuitemradio', { name: '按最近打开时间', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  await page.getByRole('menuitemradio', { name: '按名称排序', exact: true }).click();
  assert.equal(await page.locator('.project-card h2').first().textContent(), 'Project00');
  await page.getByRole('button', { name: '项目排序', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '按最近打开时间', exact: true }).click();
  assert.equal(await page.locator('.project-card h2').first().textContent(), 'Project26');
  await page.getByRole('button', { name: '重新扫描', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('.project-tools button[aria-label="重新扫描"]').disabled,
  );
  await page.getByRole('button', { name: /全部项目/ }).click();
  assert.equal(await page.locator('.project-card').count(), 27);
  assert.deepEqual(errors, []);
  console.log(
    'Category smoke passed: minimal category canvas, vertical floating controls, sorting, grid/list views, keyboard/outside dismissal, scan/create/category actions, scroll position, empty state, minimum window, themes and unified all/favorite/recent pages with recent sorting.',
  );
} finally {
  if (app) await app.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
