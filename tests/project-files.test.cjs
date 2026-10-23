const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { ProjectFiles, MAX_FILE_BYTES } = require('../electron/project-files.cjs');
const { Workbench } = require('../electron/workbench.cjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-files-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'Project 中文');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  return { root, directory, files: await ProjectFiles.open(root) };
}

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
