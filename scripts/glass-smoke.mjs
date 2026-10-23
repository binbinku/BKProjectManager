import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { clickMenu, startProject } from './native-menu.mjs';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'bkpm-glass-'));
const workspace = path.join(temporary, 'Workspace');
const project = path.join(workspace, 'TestDev/Projects/GlassPreview');
let app;
const errors = [];
const observe = (page) => {
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
};
async function launch() {
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
  const manager = await app.firstWindow();
  observe(manager);
  return manager;
}
async function inspect(page) {
  return page.evaluate(() => {
    const background = (selector) =>
      getComputedStyle(document.querySelector(selector)).backgroundColor;
    const alpha = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const pseudo = getComputedStyle(element, '::before');
      const paint = pseudo.content !== 'none' ? pseudo : getComputedStyle(element);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.fillStyle = paint.backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3];
    };
    const sidebar = document.querySelector('.sidebar, .explorer-panel');
    const rect = sidebar.getBoundingClientRect();
    const filters = [...document.querySelectorAll('*')].filter(
      (el) => getComputedStyle(el).backdropFilter !== 'none',
    );
    return {
      mode: document.documentElement.dataset.glass,
      native: document.documentElement.dataset.nativeGlass === 'true',
      root: background('html'),
      sidebar: getComputedStyle(sidebar).backgroundColor,
      sidebarAlpha: alpha('.sidebar, .explorer-panel'),
      contentAlpha: alpha(document.querySelector('.file-panel') ? '.file-panel' : 'main'),
      terminalAlpha: alpha('.terminal-panel'),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      filtered: filters.flatMap((el) => [...el.classList]),
      canvas: background(document.querySelector('.file-panel') ? '.file-panel' : 'main'),
      terminal: document.querySelector('.terminal-panel') ? background('.terminal-panel') : null,
      viewport: document.querySelector('.xterm-viewport') ? background('.xterm-viewport') : null,
    };
  });
}
try {
  await mkdir(project, { recursive: true });
  for (let index = 0; index < 40; index++)
    await mkdir(path.join(workspace, `Category${String(index).padStart(2, '0')}`));
  await mkdir(path.join(temporary, 'shell'));
  await mkdir('artifacts', { recursive: true });
  await writeFile(path.join(project, 'sample.ts'), "export const glass = 'sidebar only';\n");
  let manager = await launch();
  await manager.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog }, workspace) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspace] });
  }, workspace);
  await app.evaluate(({ BrowserWindow }) => {
    global.__materials = [];
    for (const target of BrowserWindow.getAllWindows()) {
      const key = process.platform === 'darwin' ? 'setVibrancy' : 'setBackgroundMaterial';
      if (process.platform === 'darwin' || process.platform === 'win32') {
        const original = target[key].bind(target);
        target[key] = (...args) => {
          global.__materials.push(args[0]);
          return original(...args);
        };
      }
    }
  });
  await manager.getByRole('button', { name: '选择工作空间', exact: true }).click();
  const preview = await startProject(app, manager);
  observe(preview);
  await preview.getByRole('treeitem', { name: '查看 sample.ts', exact: true }).click();
  await preview.locator('.shiki').waitFor();
  await preview.locator('.terminal-host[data-running="true"]').waitFor();
  await preview.evaluate(() => {
    window.__terminal = document.querySelector('.terminal-host');
  });
  const session = await preview.evaluate(() => window.workspaceAPI.getCurrentWorkbench());
  const labels = { off: '关闭', medium: '中等', full: '完整' };
  for (const theme of ['亮色', '暗色']) {
    await clickMenu(app, 'settings', preview);
    await manager.getByRole('radio', { name: theme, exact: true }).click();
    await preview.waitForFunction(
      (value) => document.documentElement.dataset.theme === value,
      theme === '亮色' ? 'light' : 'dark',
    );
    const geometry = (await inspect(preview)).bounds;
    for (const mode of ['full', 'medium', 'off', 'full']) {
      const radio = manager
        .getByRole('radiogroup', { name: '毛玻璃效果', exact: true })
        .getByRole('radio', { name: labels[mode], exact: true });
      if (!(await radio.isChecked())) await radio.click();
      await manager.waitForFunction(
        (mode) =>
          document.documentElement.dataset.glass === mode &&
          !document.querySelector('input[name="settings-glass"]:checked').disabled,
        mode,
      );
      await preview.waitForFunction(
        (mode) => document.documentElement.dataset.glass === mode,
        mode,
      );
      const m = await inspect(manager),
        p = await inspect(preview);
      const active = mode === 'full' && p.native;
      for (const [value, expected] of [
        [m.sidebarAlpha, active ? 102 : 255],
        [m.contentAlpha, active ? 163 : 255],
        [p.sidebarAlpha, active ? 102 : 255],
        [p.contentAlpha, active ? 163 : 255],
        [p.terminalAlpha, active ? 102 : 255],
      ])
        assert.ok(Math.abs(value - expected) <= 1, `Pane alpha ${value} should be ${expected}`);
      if (active) {
        assert.equal(p.viewport, 'rgba(0, 0, 0, 0)', 'xterm must reveal the panel backdrop');
      } else {
        assert.equal(p.terminal, p.canvas, 'Reduced modes restore opaque canvas colors');
        assert.equal(p.viewport, p.canvas);
      }
      assert.deepEqual(p.bounds, geometry, 'Sidebar geometry never changes');
      assert.equal(
        await preview.evaluate(
          () => window.__terminal === document.querySelector('.terminal-host'),
        ),
        true,
      );
      assert.equal(
        (await preview.evaluate(() => window.workspaceAPI.getCurrentWorkbench())).id,
        session.id,
      );
      assert.ok((await preview.locator('.code-content').textContent()).includes('sidebar only'));
      if (mode === 'off') {
        assert.deepEqual(m.filtered, []);
        assert.deepEqual(p.filtered, []);
      }
      if (mode === 'medium') {
        assert.ok(m.filtered.includes('project-tools'));
        assert.ok(p.filtered.includes('workbench-navigation-header'));
        assert.ok(!m.filtered.includes('modal-backdrop'));
      }
      if (mode === 'full' && m.native) {
        assert.equal(m.root, 'rgba(0, 0, 0, 0)');
        assert.equal(p.root, m.root);
        assert.equal(p.sidebar, 'rgba(0, 0, 0, 0)');
      }
      const native = await (
        await app.browserWindow(preview)
      ).evaluate((w) => w.getBackgroundColor());
      if (mode === 'full' && p.native) assert.ok(['#000000', '#00000000'].includes(native));
      else assert.ok(!native.endsWith('00') || native === '#000000');
      await preview.screenshot({
        path: `artifacts/glass-${mode}-${theme === '亮色' ? 'light' : 'dark'}.png`,
      });
    }
    await manager.getByRole('button', { name: '完成', exact: true }).click();
  }
  const verifyRenderedAlpha = async (page, selector, expected, inside = false) => {
    const rect = await page.locator(selector).boundingBox();
    const image = await page.screenshot({
      clip: {
        x: rect.x + (inside ? 90 : 5),
        y: Math.min(rect.y + rect.height - 30, 750),
        width: 2,
        height: 2,
      },
      scale: 'css',
    });
    const alpha = await app.evaluate(
      ({ nativeImage }, data) =>
        nativeImage.createFromBuffer(Buffer.from(data, 'base64')).toBitmap()[3],
      image.toString('base64'),
    );
    assert.ok(
      Math.abs(alpha - expected) <= 2,
      `${selector} rendered alpha ${alpha} should be ${expected}`,
    );
  };
  const nativeSupported = (await inspect(preview)).native;
  for (const value of [0, 60, 80, 100]) {
    await manager.evaluate((value) => window.workspaceAPI.setGlassTransparency(value), value);
    for (const page of [manager, preview])
      await page.waitForFunction(
        (value) =>
          document.documentElement.style.getPropertyValue('--glass-tint') === `${100 - value}%`,
        value,
      );
    const m = await inspect(manager),
      p = await inspect(preview);
    const side = nativeSupported ? Math.round(255 * (1 - value / 100)) : 255;
    const content = nativeSupported ? Math.round(255 * (1 - value * 0.006)) : 255;
    for (const [actual, expected] of [
      [m.sidebarAlpha, side],
      [m.contentAlpha, content],
      [p.sidebarAlpha, side],
      [p.contentAlpha, content],
      [p.terminalAlpha, side],
    ])
      assert.ok(
        Math.abs(actual - expected) <= 1,
        `value=${value} actual=${actual} expected=${expected} panes=${JSON.stringify({ m, p })}`,
      );
    if (nativeSupported) {
      await verifyRenderedAlpha(manager, 'main', content);
      await verifyRenderedAlpha(preview, '.file-panel', content, true);
      await verifyRenderedAlpha(preview, '.terminal-panel', side, true);
    }
    assert.equal(
      await preview.evaluate(() => window.__terminal === document.querySelector('.terminal-host')),
      true,
    );
  }
  await manager.evaluate(() => window.workspaceAPI.setGlassTransparency(60));
  await clickMenu(app, 'settings', preview);
  const slider = manager.getByRole('slider', { name: '毛玻璃透明度', exact: true });
  assert.equal(await slider.inputValue(), '60');
  const nativeCalls = (await app.evaluate(() => global.__materials)).length;
  await slider.scrollIntoViewIfNeeded();
  const sliderBox = await slider.boundingBox();
  await manager.mouse.move(sliderBox.x + sliderBox.width * 0.6, sliderBox.y + sliderBox.height / 2);
  await manager.mouse.down();
  await manager.mouse.move(sliderBox.x + sliderBox.width * 0.8, sliderBox.y + sliderBox.height / 2);
  const draft = Number(await slider.inputValue());
  assert.ok(draft >= 78 && draft <= 82);
  assert.equal(
    (await manager.evaluate(() => window.workspaceAPI.getState())).settings.glassTransparency,
    60,
    'Dragging previews without writing settings',
  );
  assert.equal(
    await manager.evaluate(() => document.documentElement.style.getPropertyValue('--glass-tint')),
    `${100 - draft}%`,
  );
  await manager.mouse.up();
  await preview.waitForFunction(
    (value) =>
      document.documentElement.style.getPropertyValue('--glass-tint') === `${100 - value}%`,
    draft,
  );
  assert.equal(
    (await manager.evaluate(() => window.workspaceAPI.getState())).settings.glassTransparency,
    draft,
  );
  for (const [key, expected] of [
    ['Home', 0],
    ['End', 100],
    ['ArrowLeft', 99],
  ]) {
    await slider.press(key);
    await preview.waitForFunction(
      (value) =>
        document.documentElement.style.getPropertyValue('--glass-tint') === `${100 - value}%`,
      expected,
    );
    assert.equal(
      (await manager.evaluate(() => window.workspaceAPI.getState())).settings.glassTransparency,
      expected,
    );
  }
  assert.equal(
    (await app.evaluate(() => global.__materials)).length,
    nativeCalls,
    'Transparency changes never recreate native material',
  );
  assert.equal(
    (await preview.evaluate(() => window.workspaceAPI.getCurrentWorkbench())).id,
    session.id,
  );
  assert.equal(
    await preview.evaluate(() => window.__terminal === document.querySelector('.terminal-host')),
    true,
  );
  await manager.getByRole('button', { name: '完成', exact: true }).click();
  await manager.mouse.move(700, 700);
  const nav = manager.locator('.category-nav');
  await nav.evaluate((el) => {
    el.scrollTop = 0;
  });
  const beforeScroll = await nav.screenshot();
  await nav.evaluate(async (el) => {
    for (let index = 0; index < 20; index++) {
      el.scrollTop = index % 2 === 0 ? el.scrollHeight : 0;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  const afterScroll = await nav.screenshot({ path: 'artifacts/glass-scroll-return.png' });
  const samePixels = await app.evaluate(
    ({ nativeImage }, images) => {
      const [a, b] = images.map((data) =>
        nativeImage.createFromBuffer(Buffer.from(data, 'base64')).toBitmap(),
      );
      return a.equals(b);
    },
    [beforeScroll, afterScroll].map((image) => image.toString('base64')),
  );
  assert.equal(samePixels, true, 'Rapid scrolling returns to the same clean sidebar frame');
  const materials = await app.evaluate(() => global.__materials);
  const supported = await manager.evaluate(
    async () => (await window.workspaceAPI.getState()).nativeGlass,
  );
  if (supported) {
    assert.ok(materials.includes(process.platform === 'darwin' ? 'sidebar' : 'mica'));
    assert.ok(
      materials.includes(process.platform === 'darwin' ? null : 'none'),
      'Reduced modes actually remove the OS material',
    );
  }
  await assert.rejects(
    manager.evaluate(() => window.workspaceAPI.setGlassMode('invalid')),
    /无效的毛玻璃档位/,
  );
  await assert.rejects(
    preview.evaluate(() => window.workspaceAPI.setGlassMode('off')),
    /当前窗口/,
  );
  for (const value of [-1, 101, 0.1, '70', null])
    await assert.rejects(
      manager.evaluate((value) => window.workspaceAPI.setGlassTransparency(value), value),
      /无效的毛玻璃透明度/,
    );
  await assert.rejects(
    preview.evaluate(() => window.workspaceAPI.setGlassTransparency(70)),
    /当前窗口/,
  );
  await clickMenu(app, 'settings', preview);
  await manager.evaluate(() => window.workspaceAPI.setGlassMode('off'));
  await slider.waitFor({ state: 'visible' });
  assert.equal(await slider.isDisabled(), true);
  await preview.waitForFunction(() => document.documentElement.dataset.glass === 'off');
  await app.close();
  app = undefined;
  manager = await launch();
  await manager.locator('.project-card').waitFor();
  assert.equal(
    (await manager.evaluate(() => window.workspaceAPI.getState())).settings.glassMode,
    'off',
  );
  await manager.waitForFunction(() => document.documentElement.dataset.glass === 'off');
  assert.deepEqual((await inspect(manager)).filtered, []);
  assert.equal(
    (await manager.evaluate(() => window.workspaceAPI.getState())).settings.glassTransparency,
    99,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Glass modes passed: full/medium/off in light and dark, native backdrop, 100/60 pane ratios and real transparent xterm rendering, opaque reduced modes, stable layout and live session, window sync, transparency preview/save/keyboard/bounds, rapid sidebar scrolling and restart persistence.',
  );
} finally {
  await app?.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
