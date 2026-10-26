import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { startProject } from './native-menu.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'bkpm-markdown-'));
const workspace = path.join(directory, 'Workspace');
const project = path.join(workspace, 'Docs', 'Projects', 'Notebook');
const document = path.join(project, 'README.md');
const original =
  '# 项目笔记\n\n阅读 **Markdown**，继续工作。\n\n## 计划\n\n- [x] 阅读预览\n- [ ] 开始编辑\n\n| 功能 | 状态 |\n| --- | --- |\n| 表格 | 支持 |\n\n```ts\nexport const ready = true;\n```\n\n> 保持专注，记录下一步。\n\n![本地图标](assets/logo.svg)\n\n[下一份文档](notes/next.markdown) · [GitHub](https://github.com/binbinku/BKProjectManager)\n\n[不安全链接](javascript:alert(1))\n<script>globalThis.__markdownInjected=true</script>\n<img src=x onerror="globalThis.__markdownInjected=true">\n';
await mkdir(path.join(project, 'notes'), { recursive: true });
await mkdir(path.join(project, 'assets'), { recursive: true });
await mkdir(path.join(directory, 'shell'));
await writeFile(document, original);
await writeFile(path.join(project, 'notes', 'next.markdown'), '# 下一份文档\n');
await writeFile(
  path.join(project, 'notes', 'images.md'),
  '# 嵌套目录图片\n\n![父级图片](../assets/logo.svg)\n\n![根路径图片](/assets/logo.svg)\n',
);
await writeFile(path.join(project, 'code.ts'), 'export const value = 1;\n');
await writeFile(
  path.join(project, 'assets', 'logo.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48"><rect width="96" height="48" rx="8" fill="#8bb29b"/></svg>',
);
const lightImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#e5c17a"/></svg>';
const darkImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#9b87b5"/></svg>';
const remoteImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="36"><rect width="72" height="36" fill="#72a8cc"/></svg>';
await writeFile(path.join(project, 'assets', 'light.svg'), lightImage);
await writeFile(path.join(project, 'assets', 'dark.svg'), darkImage);
await writeFile(path.join(project, 'assets', '图片 名称.svg'), lightImage);
await writeFile(
  path.join(project, 'images.md'),
  `# 图片支持\n\n![HTTPS 图片](https://images.bkpm.test/remote.svg)\n\n![HTTP 图片](http://images.bkpm.test/remote.svg)\n\n<p align="center"><img src="./assets/logo.svg" alt="HTML 图片" width="48" height="24" style="position:fixed" onload="globalThis.__markdownInjected=true" onerror="globalThis.__markdownInjected=true"></p>\n\n<picture><source media="(prefers-color-scheme: dark)" srcset="assets/dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/light.svg"><img src="assets/logo.svg" alt="主题图片" width="60"></picture>\n\n![中文空格路径](assets/%E5%9B%BE%E7%89%87%20%E5%90%8D%E7%A7%B0.svg)\n\n![缺失图片](assets/missing.png)\n\n![网络失败](https://images.bkpm.test/missing.svg)\n\n![越界图片](../outside.svg)\n\n<picture><source media="all" srcset="file:///etc/passwd"><img src="assets/logo.svg" alt="安全回退"></picture>\n\n<iframe src="https://images.bkpm.test/frame"></iframe><script>globalThis.__markdownInjected=true</script>\n`,
);
await mkdir('artifacts', { recursive: true });
let app;
let page;
const errors = [];
try {
  app = await electron.launch({
    colorScheme: null,
    args: ['.'],
    env: {
      ...process.env,
      BKPM_USER_DATA: path.join(directory, 'settings'),
      ELECTRON_RENDERER_URL: '',
      ZDOTDIR: path.join(directory, 'shell'),
      HISTFILE: path.join(directory, 'shell', 'history'),
    },
  });
  const manager = await app.firstWindow();
  manager.setDefaultTimeout(15000);
  await manager.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog, shell }, root) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
    globalThis.__markdownChoice = 2;
    globalThis.__markdownPrompts = [];
    dialog.showMessageBox = async (_window, options) => {
      globalThis.__markdownPrompts.push(options);
      return { response: globalThis.__markdownChoice, checkboxChecked: false };
    };
    shell.openExternal = async (url) => {
      globalThis.__markdownExternal = url;
    };
  }, workspace);
  await manager.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await manager.locator('.project-card').waitFor();
  page = await startProject(app, manager);
  page.on('pageerror', (error) => errors.push(error.message));
  const remoteRequests = [];
  await page.route(/^https?:\/\/images\.bkpm\.test\//, async (route) => {
    remoteRequests.push(route.request().url());
    await route.fulfill({
      status: route.request().url().endsWith('missing.svg') ? 404 : 200,
      contentType: route.request().url().endsWith('missing.svg') ? 'text/plain' : 'image/svg+xml',
      body: route.request().url().endsWith('missing.svg') ? 'Not found' : remoteImage,
    });
  });
  await page.locator('.terminal-host[data-running="true"]').waitFor();
  const select = async (name) =>
    page.getByRole('treeitem', { name: `查看 ${name}`, exact: true }).click();
  const choice = async (response) =>
    app.evaluate((_electron, value) => {
      globalThis.__markdownChoice = value;
    }, response);
  const promptCount = async () => app.evaluate(() => globalThis.__markdownPrompts.length);
  const waitPrompt = async (previous) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await promptCount()) > previous) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail('Expected an unsaved Markdown dialog');
  };
  const edit = async (content) => {
    await page.getByRole('button', { name: '编辑 Markdown', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Markdown 源码编辑器' });
    await editor.waitFor();
    await editor.focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await page.keyboard.insertText(content);
    await page.getByText('未保存', { exact: true }).waitFor();
  };
  await select('README.md');
  await page.getByRole('heading', { name: '项目笔记', exact: true }).waitFor();
  assert.equal(await page.locator('.markdown-editor, .code-document, [role="tab"]').count(), 0);
  assert.equal(await page.locator('.markdown-document strong').textContent(), 'Markdown');
  assert.equal(await page.locator('.markdown-document table').count(), 1);
  assert.equal(await page.locator('.markdown-document input[disabled]').count(), 2);
  await page.locator('.markdown-code-block .shiki span[style]').first().waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.markdown-document img');
    return image?.complete && image.naturalWidth === 96;
  });
  assert.equal(await page.evaluate(() => window.__markdownInjected), undefined);
  assert.equal(
    await page
      .locator(
        '.markdown-document script, .markdown-document [onerror], .markdown-document a[href^="javascript:"]',
      )
      .count(),
    0,
  );
  assert.equal(await readFile(document, 'utf8'), original);
  const session = await page.evaluate(() => window.workspaceAPI.getCurrentWorkbench());
  await assert.rejects(
    manager.evaluate(
      (id) => window.workspaceAPI.saveMarkdown(id, 'README.md', '# Wrong', '0'.repeat(64)),
      session.id,
    ),
    /当前窗口/,
  );
  await assert.rejects(
    page.evaluate(() =>
      window.workspaceAPI.saveMarkdown('other-window', 'README.md', '# Wrong', '0'.repeat(64)),
    ),
    /当前窗口/,
  );
  await assert.rejects(
    page.evaluate(
      (id) => window.workspaceAPI.openMarkdownLink(id, 'file:///etc/passwd'),
      session.id,
    ),
    /不支持/,
  );
  await page.getByRole('link', { name: 'GitHub', exact: true }).click();
  assert.equal(
    await app.evaluate(() => globalThis.__markdownExternal),
    'https://github.com/binbinku/BKProjectManager',
  );
  await page.getByRole('link', { name: '下一份文档', exact: true }).click();
  await page.getByRole('heading', { name: '下一份文档', exact: true }).waitFor();
  await page.getByRole('treeitem', { name: '展开 notes', exact: true }).click();
  await page.locator('[data-file-path="notes/images.md"]').click();
  await page.getByRole('heading', { name: '嵌套目录图片', exact: true }).waitFor();
  for (const alt of ['父级图片', '根路径图片'])
    await page.getByRole('img', { name: alt, exact: true }).evaluate((image) => image.decode());
  await page.locator('[data-file-path="images.md"]').click();
  await page.getByRole('heading', { name: '图片支持', exact: true }).waitFor();
  for (const alt of ['HTTPS 图片', 'HTTP 图片', 'HTML 图片', '中文空格路径', '安全回退']) {
    const image = page.getByRole('img', { name: alt, exact: true });
    await page.waitForFunction(
      (alt) =>
        [...document.querySelectorAll('.markdown-document img')].some(
          (image) => image.alt === alt && image.complete && image.naturalWidth > 0,
        ),
      alt,
    );
    await image.evaluate((image) => image.decode());
  }
  assert.equal(
    await page.getByRole('img', { name: 'HTML 图片', exact: true }).getAttribute('width'),
    '48',
  );
  assert.equal(
    await page.getByRole('img', { name: 'HTML 图片', exact: true }).getAttribute('height'),
    '24',
  );
  for (const alt of ['缺失图片', '网络失败', '越界图片'])
    await page.getByRole('img', { name: `${alt}（加载失败）`, exact: true }).waitFor();
  assert.ok(remoteRequests.includes('https://images.bkpm.test/remote.svg'));
  assert.ok(remoteRequests.includes('http://images.bkpm.test/remote.svg'));
  assert.equal(
    await page
      .locator(
        '.markdown-document script, .markdown-document iframe, .markdown-document [onerror], .markdown-document [onload], .markdown-document [style], .markdown-document source[srcset^="file:"]',
      )
      .count(),
    0,
  );
  assert.equal(await page.evaluate(() => window.__markdownInjected), undefined);
  for (const [theme, width] of [
    ['light', 80],
    ['dark', 64],
  ]) {
    await manager.evaluate((value) => window.workspaceAPI.setTheme(value), theme);
    await page.waitForFunction((width) => {
      const image = document.querySelector('img[alt="主题图片"]');
      return image?.complete && image.naturalWidth === width;
    }, width);
    await page.screenshot({ path: `artifacts/markdown-images-${theme}.png` });
  }
  await select('README.md');

  // Both appearances follow the existing palette without adding headers or tabs.
  for (const theme of ['light', 'dark']) {
    await manager.evaluate((value) => window.workspaceAPI.setTheme(value), theme);
    await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme);
    await page.screenshot({ path: `artifacts/markdown-preview-${theme}.png` });
  }
  await edit('# 编辑后的笔记\n\n**代码编辑与保存**\n');
  await page.locator('.markdown-editor .cm-line span').first().waitFor();
  assert.equal(await page.locator('.markdown-editor .cm-gutters').count(), 1);
  assert.equal(
    await page
      .locator('.file-panel .workbench-drag-region')
      .evaluate((element) => getComputedStyle(element).height),
    '52px',
  );
  await page.screenshot({ path: 'artifacts/markdown-editor-dark.png' });
  let before = await promptCount();
  await choice(2);
  await select('code.ts');
  await waitPrompt(before);
  await page.getByRole('textbox', { name: 'Markdown 源码编辑器' }).waitFor();
  assert.equal(await readFile(document, 'utf8'), original);
  await choice(1);
  await select('code.ts');
  await page.locator('.code-content .shiki').waitFor();
  assert.equal(await page.locator('.markdown-tools').count(), 0);
  assert.equal(await readFile(document, 'utf8'), original);

  await select('README.md');
  await edit('# 已保存的笔记\n\n保存后回到阅读模式。\n');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  await page.getByRole('heading', { name: '已保存的笔记', exact: true }).waitFor();
  assert.match(await readFile(document, 'utf8'), /^# 已保存的笔记/);
  assert.equal(await page.locator('.markdown-editor').count(), 0);

  // Cancel editing can save before returning to preview, and conflicts keep the draft.
  await edit('# 新草稿\n');
  await writeFile(document, '# 外部修改\n');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '其他程序修改' }).waitFor();
  assert.equal(await readFile(document, 'utf8'), '# 外部修改\n');
  assert.ok((await page.locator('.cm-content').textContent()).includes('# 新草稿'));
  await choice(1);
  await select('code.ts');
  await page.locator('.code-content').waitFor();
  await select('README.md');
  await page.getByRole('heading', { name: '外部修改', exact: true }).waitFor();
  await edit('# 保存并切换\n');
  await choice(0);
  await select('code.ts');
  await page.locator('.code-content').waitFor();
  assert.equal(await readFile(document, 'utf8'), '# 保存并切换\n');

  // Closing and quitting honor the same save/discard/cancel guard, without killing PTYs on cancel.
  await select('README.md');
  await edit('# 窗口关闭前保存\n');
  await choice(2);
  before = await promptCount();
  await page.evaluate(() => window.workspaceAPI.controlWindow('close'));
  await waitPrompt(before);
  assert.equal(page.isClosed(), false);
  assert.equal(await page.locator('.terminal-host[data-running="true"]').count(), 1);
  await choice(0);
  const closed = page.waitForEvent('close');
  await page.evaluate(() => window.workspaceAPI.controlWindow('close'));
  await closed;
  assert.equal(await readFile(document, 'utf8'), '# 窗口关闭前保存\n');
  page = await startProject(app, manager);
  page.on('pageerror', (error) => errors.push(error.message));
  await select('README.md');
  await edit('# 退出时不要丢失\n');
  await choice(2);
  before = await promptCount();
  await app.evaluate(({ app }) => {
    app.quit();
  });
  await waitPrompt(before);
  assert.equal(page.isClosed(), false);
  assert.equal(manager.isClosed(), false);
  assert.equal(await page.locator('.terminal-host[data-running="true"]').count(), 1);
  assert.equal(await readFile(document, 'utf8'), '# 窗口关闭前保存\n');
  await choice(1);
  const quit = app.waitForEvent('close');
  await app.evaluate(({ app }) => {
    app.quit();
  });
  await quit;
  assert.equal(await readFile(document, 'utf8'), '# 窗口关闭前保存\n');
  assert.deepEqual(errors, []);
  console.log(
    'Markdown smoke passed: safe GFM/HTML preview, highlighted fences, local/root/parent/Unicode image paths, HTTP(S) images, picture light/dark sources, image dimensions/failures, sanitized HTML, read-only default, source editing, keyboard save, unsaved guards, conflict protection, scoped IPC and cancel-safe window/app closing.',
  );
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: 'artifacts/markdown-failure.png' }).catch(() => {});
  throw error;
} finally {
  if (app) {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      })
      .catch(() => {});
    await app.close().catch(() => {});
  }
  await rm(directory, { recursive: true, force: true });
}
