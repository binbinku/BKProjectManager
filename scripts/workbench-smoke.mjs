import { clickMenu } from './native-menu.mjs';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm, realpath, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const directory = await mkdtemp(path.join(os.tmpdir(), 'bkpm-workbench-'));
const workspace = path.join(directory, 'Workspace');
const project = path.join(workspace, 'WebDev', 'Projects', 'Orbit');
await mkdir(path.join(project, 'src'), { recursive: true });
await mkdir(path.join(project, 'public'), { recursive: true });
await writeFile(
  path.join(project, 'package.json'),
  JSON.stringify({ name: 'orbit', private: true }, null, 2),
);
await writeFile(path.join(project, 'README.md'), '# Orbit\n\nA calm space for your next idea.\n');
await writeFile(
  path.join(project, 'src', 'workspace.ts'),
  `// Everything you need, in one workspace.\nexport interface Project {\n  name: string;\n  path: string;\n  favorite: boolean;\n}\n\nexport function findProjects(query: string, projects: Project[]) {\n  const keyword = query.trim().toLowerCase();\n\n  return projects\n    .filter((project) => project.name.toLowerCase().includes(keyword))\n    .sort((a, b) => a.name.localeCompare(b.name));\n}\n\nexport const workspace = {\n  name: 'Orbit',\n  theme: 'system',\n  projects: 12,\n};\n`,
);
await writeFile(
  path.join(project, 'unsafe.ts'),
  '<img src=x onerror="globalThis.__previewInjected=true"><script>globalThis.__previewInjected=true</script>',
);
await writeFile(path.join(project, 'binary.dat'), Buffer.from([0, 1, 2]));
await writeFile(
  path.join(project, 'public', 'logo.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="28" fill="#191919"/><circle cx="60" cy="60" r="22" fill="#9ab79e"/></svg>',
);
await mkdir('artifacts', { recursive: true });
await mkdir(path.join(directory, 'shell'), { recursive: true });
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
      BKPM_USER_DATA: path.join(directory, 'settings'),
      ELECTRON_RENDERER_URL: '',
      ZDOTDIR: path.join(directory, 'shell'),
      HISTFILE: path.join(directory, 'shell', 'history'),
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      CLICOLOR: '0',
      CI: 'true',
    },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: '选择工作空间', exact: true }).waitFor();
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
  }, workspace);
  await page.getByRole('button', { name: '选择工作空间', exact: true }).click();
  await page.locator('.project-card').waitFor();
  await page.evaluate(() => {
    window.__terminalEvents = [];
    window.__terminalUnsubscribe = window.workspaceAPI.onTerminalEvent((event) =>
      window.__terminalEvents.push(event),
    );
  });
  await page.getByRole('button', { name: '打开项目', exact: true }).click();
  await page.getByRole('tree', { name: '项目文件目录' }).waitFor();
  await page.locator('.terminal-host[data-running="true"]').waitFor();
  assert.equal(await page.getByRole('button', { name: '设置', exact: true }).count(), 0);
  assert.equal(await page.locator('.explorer-panel > header').count(), 1);
  assert.equal((await page.locator('.workbench-navigation-header').boundingBox()).y, 0);
  await page.waitForFunction(() => {
    const image = document.querySelector('.external-open img');
    return image?.complete && image.naturalWidth > 0;
  });
  const defaultOpener = await page.evaluate(() => window.workspaceAPI.getOpenerInfo());
  assert.ok(defaultOpener.icon.startsWith('data:image/png;base64,'));
  const external = page.getByRole('button', {
    name: `在 ${defaultOpener.name} 中打开`,
    exact: true,
  });
  assert.equal(await external.getAttribute('title'), `在 ${defaultOpener.name} 中打开`);
  await app.evaluate(({ shell }) => {
    shell.openPath = async () => '';
  });
  await external.click();
  await clickMenu(app, 'settings');
  await page.getByLabel('默认打开方式', { exact: true }).selectOption('vscode');
  await page.getByRole('button', { name: '在 VS Code 中打开', exact: true }).waitFor();
  await page.getByLabel('默认打开方式', { exact: true }).selectOption('folder');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('treeitem', { name: '展开 src', exact: true }).click();
  await page.getByRole('treeitem', { name: '查看 workspace.ts', exact: true }).click();
  await page.locator('.code-content .shiki').waitFor();
  assert.ok(await page.locator('.code-content .shiki span[style]').count());
  assert.equal(await page.getByRole('tab').count(), 0);
  assert.equal(await page.locator('.file-panel textarea').count(), 0);
  const original = await page.locator('.code-content').textContent();
  await page.getByRole('treeitem', { name: '查看 README.md', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.code-content')?.textContent?.includes('# Orbit'),
  );
  assert.equal(await page.locator('.code-document').count(), 1);
  assert.ok(!(await page.locator('.code-content').textContent()).includes('findProjects'));
  await page.getByRole('treeitem', { name: '查看 unsafe.ts', exact: true }).click();
  await page.locator('.code-content .shiki').waitFor();
  await page.waitForFunction(() =>
    document.querySelector('.code-content')?.textContent?.includes('<script>'),
  );
  assert.equal(await page.evaluate(() => window.__previewInjected), undefined);
  await page.getByRole('treeitem', { name: '查看 binary.dat', exact: true }).click();
  await page.getByText('二进制文件暂不支持预览。', { exact: true }).waitFor();
  await page.getByRole('treeitem', { name: '展开 public', exact: true }).click();
  await page.getByRole('treeitem', { name: '查看 logo.svg', exact: true }).click();
  await page.waitForFunction(() => {
    const image = document.querySelector('.image-preview img');
    return image?.complete && image.naturalWidth === 120;
  });

  // The central viewer fills the window; hidden scrollbars must not disable scrolling.
  const assertFullHeight = async () => {
    for (const selector of ['.file-viewport', '.terminal-host']) {
      const bounds = await page.locator(selector).boundingBox();
      assert.equal(bounds.y, 0, `${selector} must reach the top edge`);
      assert.equal(bounds.height, await page.evaluate(() => window.innerHeight));
    }
    await page.waitForFunction(() => {
      const screen = document.querySelector('.xterm-screen').getBoundingClientRect();
      return screen.top >= 0 && screen.bottom <= window.innerHeight;
    });
    assert.equal(await page.locator('.file-panel header, .file-panel footer').count(), 0);
  };
  await assertFullHeight();
  const scrollFixture = path.join(project, 'scroll-fixture');
  await mkdir(scrollFixture);
  await Promise.all(
    Array.from({ length: 80 }, (_, index) =>
      writeFile(path.join(scrollFixture, `file-${String(index).padStart(2, '0')}.txt`), ''),
    ),
  );
  await writeFile(
    path.join(scrollFixture, 'long.txt'),
    Array.from({ length: 160 }, (_, index) => `${index}: ${'scroll '.repeat(80)}`).join('\n'),
  );
  await clickMenu(app, 'refresh-files');
  await page.getByRole('treeitem', { name: '展开 scroll-fixture', exact: true }).click();
  await page.getByRole('treeitem', { name: '查看 long.txt', exact: true }).click();
  await page.locator('.code-document').waitFor();
  await page.locator('.file-viewport').hover();
  await page.mouse.wheel(500, 500);
  await page.waitForFunction(() => {
    const viewport = document.querySelector('.file-viewport');
    return viewport.scrollTop > 0 && viewport.scrollLeft > 0;
  });
  await page.locator('.explorer-scroll').hover();
  await page.mouse.wheel(0, -10000);
  await page.waitForFunction(() => document.querySelector('.explorer-scroll').scrollTop === 0);
  await page.mouse.wheel(0, 400);
  await page.waitForFunction(() => document.querySelector('.explorer-scroll').scrollTop > 0);
  for (const selector of ['.file-viewport', '.explorer-scroll', '.xterm-viewport']) {
    assert.equal(
      await page.locator(selector).evaluate((element) => getComputedStyle(element).scrollbarWidth),
      'none',
    );
  }
  for (const scrollbar of await page.locator('.xterm-scrollable-element > .scrollbar').all())
    assert.equal(await scrollbar.evaluate((element) => getComputedStyle(element).display), 'none');
  await rm(scrollFixture, { recursive: true });
  await clickMenu(app, 'refresh-files');
  await page.getByRole('treeitem', { name: '展开 src', exact: true }).click();

  const output = async () =>
    page.evaluate(() =>
      window.__terminalEvents
        .filter((event) => event.type === 'data')
        .map((event) => event.data)
        .join(''),
    );
  const terminal = page.locator('.terminal-host .xterm-helper-textarea');
  const command = async (text) => {
    await terminal.focus();
    await page.keyboard.type(text, { delay: 1 });
    await page.keyboard.press('Enter');
  };
  const windows = process.platform === 'win32';
  await command(
    windows
      ? "Write-Output ('__'+'BKPM_READY'+'__'); (Get-Location).Path"
      : "printf '__%s__\\n' BKPM_READY; printf 'ROOT=%s\\n' \"$PWD\"; printf 'BKPM_PID_%s\\n' \"$$\"",
  );
  await page.waitForFunction(() =>
    window.__terminalEvents.some(
      (event) => event.type === 'data' && event.data.includes('__BKPM_READY__'),
    ),
  );
  assert.ok((await output()).includes(await realpath(project)));
  const shellQuote = (text) =>
    windows ? `'${text.replaceAll("'", "''")}'` : `'${text.replaceAll("'", "'\\''")}'`;
  const colorProbe =
    'console.log("BKPM_DEPTH="+process.stdout.getColorDepth());console.log("BKPM_NO_COLOR="+(process.env.NO_COLOR??"unset"));process.stdout.write("\\u001b[38;2;215;119;87mBKPM_ORANGE\\u001b[0m\\n")';
  await command(
    `${windows ? '& ' : ''}${shellQuote(process.execPath)} -e ${shellQuote(colorProbe)}`,
  );
  await page.waitForFunction(() => {
    const output = window.__terminalEvents
      .filter((event) => event.type === 'data')
      .map((event) => event.data)
      .join('');
    return (
      output.includes('BKPM_DEPTH=24') &&
      output.includes('BKPM_NO_COLOR=unset') &&
      output.includes('\u001b[38;2;215;119;87mBKPM_ORANGE')
    );
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.xterm-rows span')].some(
      (element) =>
        element.textContent.includes('BKPM_ORANGE') &&
        getComputedStyle(element).color === 'rgb(215, 119, 87)',
    ),
  );
  await page.screenshot({ path: 'artifacts/terminal-color.png' });
  const session = await page.evaluate(
    () => window.__terminalEvents.find((event) => event.type === 'data').sessionId,
  );
  await assert.rejects(
    page.evaluate((id) => window.workspaceAPI.readProjectFile(id, '../outside.txt'), session),
    /无效/,
  );
  await assert.rejects(
    page.evaluate(() => window.workspaceAPI.listProjectFiles('wrong-session', '')),
    /已关闭/,
  );
  if (!windows) {
    await command('sleep 20');
    await terminal.focus();
    await page.keyboard.press('Control+c');
    await command("printf '__%s__\\n' BKPM_INTERRUPTED");
    await page.waitForFunction(
      () =>
        window.__terminalEvents.some(
          (event) => event.type === 'data' && event.data.includes('__BKPM_INTERRUPTED__'),
        ),
      { timeout: 5000 },
    );
    await command("head -c 600000 /dev/zero | tr '\\0' x; printf '__%s__\\n' BKPM_BURST");
    await page.waitForFunction(() =>
      window.__terminalEvents
        .filter((event) => event.type === 'data')
        .map((event) => event.data)
        .join('')
        .includes('__BKPM_BURST__'),
    );
    const visibleOutput = await page.locator('.xterm-rows').textContent();
    await page.locator('.terminal-host').hover();
    await page.mouse.wheel(0, -500);
    await page.waitForFunction(
      (previous) => document.querySelector('.xterm-rows').textContent !== previous,
      visibleOutput,
    );
  }
  const separator = page.getByRole('separator', { name: '调整终端宽度' });
  const before = await page.locator('.terminal-panel').boundingBox();
  await separator.focus();
  await page.keyboard.press('ArrowLeft');
  const after = await page.locator('.terminal-panel').boundingBox();
  assert.ok(after.width > before.width);
  await page.getByRole('treeitem', { name: '查看 workspace.ts', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.code-content')?.textContent?.includes('findProjects'),
  );
  assert.equal(await page.locator('.code-content').textContent(), original);
  if (!windows) {
    await command(
      "PS1='orbit % '; clear; printf 'Workspace ready\\n\\n'; printf '  Project  Orbit\\n  Preview  src/workspace.ts\\n\\n' ",
    );
    await command('ls src');
  }
  // Check both themes while the terminal and file viewer remain mounted.
  for (const theme of ['dark', 'light']) {
    await clickMenu(app, 'settings');
    await page
      .getByRole('radio', { name: theme === 'dark' ? '暗色' : '亮色', exact: true })
      .click();
    await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
    await page.waitForFunction(
      () => !document.querySelector('input[name="settings-theme"]:checked').disabled,
    );
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await assertFullHeight();
    await page.screenshot({ path: `artifacts/workbench-${theme}.png` });
    if (process.argv.includes('--docs'))
      await copyFile(`artifacts/workbench-${theme}.png`, `docs/assets/workbench-${theme}.png`);
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(980, 660),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('.terminal-panel').getBoundingClientRect().right <= window.innerWidth,
  );
  assert.ok((await page.locator('.file-panel').boundingBox()).width >= 260);
  await assertFullHeight();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1380, 900),
  );
  const pid = (await output()).match(/BKPM_PID_(\d+)/)?.[1];
  await command('exit');
  await page.locator('.terminal-host[data-running="false"]').waitFor();
  await clickMenu(app, 'terminal-restart');
  await page.locator('.terminal-host[data-running="true"]').waitFor();
  await command(
    windows
      ? "Write-Output ('__'+'BKPM_RESTARTED'+'__')"
      : "printf '__%s__\\n' BKPM_RESTARTED; printf 'LIVE_PID_%s\\n' \"$$\"",
  );
  await page.waitForFunction(() =>
    window.__terminalEvents.some(
      (event) => event.type === 'data' && event.data.includes('__BKPM_RESTARTED__'),
    ),
  );
  const livePID = (await output()).match(/LIVE_PID_(\d+)/)?.[1];
  await page.getByRole('button', { name: '返回项目列表' }).click();
  await page.locator('.project-card').waitFor();
  await assert.rejects(
    page.evaluate((id) => window.workspaceAPI.listProjectFiles(id, ''), session),
    /已关闭/,
  );
  for (const candidate of [pid, livePID].filter(Boolean)) {
    let alive = true;
    for (let attempt = 0; attempt < 30 && alive; attempt++) {
      alive = await app.evaluate((_electron, pid) => {
        try {
          process.kill(Number(pid), 0);
          return true;
        } catch {
          return false;
        }
      }, candidate);
      if (alive) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(alive, false, `Terminal process ${candidate} must exit after leaving the project`);
  }
  await page.getByRole('button', { name: '打开项目', exact: true }).click();
  await page.locator('.terminal-host[data-running="true"]').waitFor();
  await page.getByRole('treeitem', { name: '查看 package.json', exact: true }).click();
  await page.locator('.code-content .shiki span[style]').first().waitFor();
  await page.getByRole('button', { name: '返回项目列表' }).click();
  assert.deepEqual(errors, []);
  console.log(
    'Workbench smoke passed: full-height viewer and terminal, hidden scrollbars with working tree/code/terminal scrolling, lazy tree, single-file preview, syntax highlighting, escaped content, images, binary fallback, real PTY input/cwd, Ctrl+C, panel resize, themes, terminal restart, session revocation and process cleanup.',
  );
} catch (error) {
  if (app?.windows().some((page) => !page.isClosed())) {
    const page = app.windows().find((page) => !page.isClosed());
    await page.screenshot({ path: 'artifacts/workbench-failure.png' }).catch(() => {});
    console.error(
      'Terminal status:',
      await page
        .locator('.terminal-host')
        .getAttribute('data-status')
        .catch(() => 'unavailable'),
    );
    console.error('Terminal error:', await page.locator('.terminal-error').allTextContents());
    console.error(
      'Recent terminal output:',
      await page.evaluate(() =>
        (window.__terminalEvents || [])
          .filter((event) => event.type === 'data')
          .map((event) => event.data)
          .join('')
          .slice(-1800),
      ),
    );
  }
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
