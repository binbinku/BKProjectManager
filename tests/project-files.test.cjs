const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { ProjectFiles, MAX_FILE_BYTES } = require('../electron/project-files.cjs');
const { Workbench } = require('../electron/workbench.cjs');
const { terminalEnvironment } = require('../electron/terminal-environment.cjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-files-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'Project 中文');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  return { root, directory, files: await ProjectFiles.open(root) };
}

test('Interactive terminal capabilities do not inherit host no-color, CI or debugger settings', () => {
  const source = {
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    CLICOLOR: '0',
    CLICOLOR_FORCE: '0',
    CI: 'true',
    TERM: 'dumb',
    COLORTERM: '',
    ELECTRON_RUN_AS_NODE: '1',
    BKPM_USER_DATA: '/host/config',
    NODE_OPTIONS: '--inspect',
    NODE_INSPECTOR_IPC: '/host/debugger',
    PATH: '/usr/bin',
    HOME: '/home/user',
    PROJECT_ENV: 'keep',
  };
  const env = terminalEnvironment(source);
  assert.equal(env.TERM, 'xterm-256color');
  assert.equal(env.COLORTERM, 'truecolor');
  for (const name of [
    'NO_COLOR',
    'FORCE_COLOR',
    'CLICOLOR',
    'CLICOLOR_FORCE',
    'CI',
    'NODE_OPTIONS',
    'ELECTRON_RUN_AS_NODE',
    'BKPM_USER_DATA',
    'NODE_INSPECTOR_IPC',
  ])
    assert.equal(env[name], undefined);
  assert.equal(env.PATH, source.PATH);
  assert.equal(env.HOME, source.HOME);
  assert.equal(env.PROJECT_ENV, 'keep');
  assert.equal(source.NO_COLOR, '1');
});

test('File tree is lazy, keeps hidden files, sorts folders first and reads Unicode paths', async (t) => {
  const { root, files } = await fixture(t);
  await fs.writeFile(path.join(root, '.gitignore'), 'node_modules/');
  await fs.writeFile(path.join(root, 'src', '你好.ts'), "export const greeting = '你好';\n");
  const top = await files.list('');
  assert.equal(top.entries[0].name, 'src');
  assert.equal(top.entries[0].kind, 'directory');
  assert(top.entries.some((entry) => entry.name === '.gitignore'));
  assert(!top.entries.some((entry) => entry.name === '你好.ts'));
  assert.deepEqual(
    (await files.list('src')).entries.map((entry) => entry.path),
    ['src/你好.ts'],
  );
  const content = await files.read('src/你好.ts');
  assert.equal(content.kind, 'text');
  assert.match(content.content, /你好/);
  assert.equal(content.encoding, 'utf-8');
});

test('Project browsing rejects traversal, absolute paths and links escaping the project', async (t) => {
  const { directory, root, files } = await fixture(t);
  const outside = path.join(directory, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'not part of project');
  await fs.symlink(
    outside,
    path.join(root, 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  for (const input of [
    '../outside/secret.txt',
    outside,
    'C:\\outside',
    'src/../../outside',
    '\0',
    'src//file',
  ])
    await assert.rejects(files.read(input), /无效|只能浏览/);
  await assert.rejects(files.read('linked/secret.txt'), /只能浏览/);
  await assert.rejects(files.list('linked'), /只能浏览/);
  assert.equal(
    (await files.list('')).entries.find((entry) => entry.name === 'linked').kind,
    'link',
  );
  await assert.rejects(files.read('src'), /普通文件/);
});

test('Preview handles binary, oversized, empty, UTF-16 and image files without writing them', async (t) => {
  const { root, files } = await fixture(t);
  const cases = [
    ['binary.dat', Buffer.from([0, 1, 2, 3])],
    ['large.txt', Buffer.alloc(MAX_FILE_BYTES + 1, 65)],
    ['empty.txt', Buffer.alloc(0)],
    ['utf16.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('你好', 'utf16le')])],
    ['logo.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['invalid.txt', Buffer.from([0xff, 0xff, 0xff])],
  ];
  for (const [name, content] of cases) await fs.writeFile(path.join(root, name), content);
  assert.equal((await files.read('binary.dat')).kind, 'unsupported');
  assert.match((await files.read('large.txt')).reason, /2 MiB/);
  assert.equal((await files.read('empty.txt')).content, '');
  assert.equal((await files.read('utf16.txt')).content, '你好');
  assert.match((await files.read('logo.svg')).dataURL, /^data:image\/svg\+xml;base64,/);
  assert.equal((await files.read('invalid.txt')).kind, 'unsupported');
  for (const [name, content] of cases)
    assert.deepEqual(await fs.readFile(path.join(root, name)), content);
});

test('Workbench sessions cannot overlap, old IDs are revoked, and disposal cancels pending opens', async (t) => {
  const { root } = await fixture(t);
  const workbench = new Workbench(() => {});
  t.after(() => workbench.dispose());
  const project = { id: 'project', name: 'Project', path: root };
  const first = await workbench.open(project);
  await assert.rejects(workbench.open(project), /请先关闭/);
  assert.throws(() => workbench.requireSession('another-id'), /已关闭/);
  assert.throws(() => workbench.startTerminal(first.id, -1, 10), /终端尺寸/);
  workbench.close(first.id);
  assert.throws(() => workbench.requireSession(first.id), /已关闭/);
  const pending = workbench.open(project);
  workbench.dispose();
  await assert.rejects(pending, /已取消/);
  assert.equal(workbench.session, null);
});

test('Markdown saves preserve Unicode encoding, BOM, CRLF and permissions', async (t) => {
  const { root, files } = await fixture(t);
  const utf16 = Buffer.from('\ufeff# 原文\r\n', 'utf16le');
  const cases = [
    ['utf8.md', Buffer.from('# 原文\r\n'), Buffer.from('# 修改\r\n下一行\r\n')],
    ['bom.MD', Buffer.from('\ufeff# 原文\r\n'), Buffer.from('\ufeff# 修改\r\n下一行\r\n')],
    ['utf16.md', utf16, Buffer.from('\ufeff# 修改\r\n下一行\r\n', 'utf16le')],
    [
      'big-endian.markdown',
      Buffer.from(utf16).swap16(),
      Buffer.from('\ufeff# 修改\r\n下一行\r\n', 'utf16le').swap16(),
    ],
    ['empty.md', Buffer.alloc(0), Buffer.from('# 修改\n下一行\n')],
  ];
  for (const [name, before, after] of cases) {
    const target = path.join(root, name);
    await fs.writeFile(target, before);
    await fs.chmod(target, 0o664);
    const mode = (await fs.stat(target)).mode & 0o777;
    const initial = await files.read(name);
    const saved = await files.saveMarkdown(name, '# 修改\n下一行\n', initial.revision);
    assert.equal(saved.kind, 'text');
    assert.notEqual(saved.revision, initial.revision);
    assert.deepEqual(await fs.readFile(target), after);
    assert.equal((await fs.stat(target)).mode & 0o777, mode);
  }
  assert.ok(!(await fs.readdir(root)).some((name) => name.startsWith('.bkpm-')));
});

test('Markdown saves reject stale revisions, concurrent overwrites and oversized contents', async (t) => {
  const { root, files } = await fixture(t);
  const target = path.join(root, 'README.md');
  await fs.writeFile(target, '# Original');
  const first = await files.read('README.md');
  await fs.writeFile(target, '# External change');
  await assert.rejects(files.saveMarkdown('README.md', '# Draft', first.revision), /其他程序修改/);
  assert.equal(await fs.readFile(target, 'utf8'), '# External change');
  const current = await files.read('README.md');
  const results = await Promise.allSettled([
    files.saveMarkdown('README.md', '# First save', current.revision),
    files.saveMarkdown('README.md', '# Stale save', current.revision),
  ]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['fulfilled', 'rejected'],
  );
  const saved = await files.read('README.md');
  assert.equal(saved.content, '# First save');
  await assert.rejects(
    files.saveMarkdown('README.md', '好'.repeat(MAX_FILE_BYTES), saved.revision),
    /2 MiB/,
  );
  await assert.rejects(files.saveMarkdown('README.md', '# Draft', null), /无效/);
  assert.equal((await files.read('README.md')).content, '# First save');
});

test('Only ordinary existing Markdown inside this project can be saved', async (t) => {
  const { root, directory, files } = await fixture(t);
  await fs.writeFile(path.join(directory, 'outside.md'), '# Outside');
  await fs.writeFile(path.join(root, 'note.md'), '# Inside');
  await fs.writeFile(path.join(root, 'code.ts'), '// Read-only');
  const note = await files.read('note.md');
  const code = await files.read('code.ts');
  await assert.rejects(
    files.saveMarkdown('code.ts', '// Changed', code.revision),
    /只能编辑 Markdown/,
  );
  await assert.rejects(
    files.saveMarkdown('../outside.md', '# Changed', note.revision),
    /无效|只能浏览/,
  );
  await assert.rejects(files.saveMarkdown('new.md', '# New', note.revision), /ENOENT/);
  await fs.link(path.join(root, 'note.md'), path.join(root, 'hardlink.md'));
  await assert.rejects(files.saveMarkdown('hardlink.md', '# Changed', note.revision), /普通/);
  if (process.platform !== 'win32') {
    await fs.symlink(path.join(root, 'note.md'), path.join(root, 'link.md'));
    await fs.symlink(path.join(root, 'src'), path.join(root, 'linked-dir'));
    await fs.writeFile(path.join(root, 'src', 'note.md'), '# Nested');
    const nested = await files.read('src/note.md');
    await assert.rejects(files.saveMarkdown('link.md', '# Changed', note.revision), /符号链接/);
    await assert.rejects(
      files.saveMarkdown('linked-dir/note.md', '# Changed', nested.revision),
      /符号链接/,
    );
  }
  assert.equal(await fs.readFile(path.join(directory, 'outside.md'), 'utf8'), '# Outside');
  assert.equal(await fs.readFile(path.join(root, 'code.ts'), 'utf8'), '// Read-only');
});
