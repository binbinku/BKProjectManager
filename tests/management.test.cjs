const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  createCategory,
  createProject,
  validateStyle,
  validateName,
} = require('../electron/workspace-management.cjs');
const { scanWorkspace } = require('../electron/scanner.cjs');
const { Store } = require('../electron/store.cjs');
async function workspace(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-manage-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = path.join(await fs.realpath(temporary), 'Workspace');
  await fs.mkdir(root);
  return root;
}
test('New categories contain Projects, new projects are empty and immediately discovered', async (t) => {
  const root = await workspace(t);
  const category = await createCategory(root, '  设计  ');
  assert.deepEqual(await fs.readdir(category), ['Projects']);
  assert.equal(
    (await scanWorkspace(root)).projectContainers['设计'],
    path.join(category, 'Projects'),
  );
  const project = await createProject(root, '设计', ' 新项目 ');
  assert.deepEqual(await fs.readdir(project), []);
  const snapshot = await scanWorkspace(root);
  assert.equal(snapshot.projects.length, 1);
  assert.equal(snapshot.projects[0].relativePath, path.join('设计', 'Projects', '新项目'));
  await assert.rejects(createCategory(root, '设计'), /已存在/);
  await assert.rejects(createProject(root, '设计', '新项目'), /已存在/);
});
test('Project creation preserves direct-child layouts and supports lowercase projects containers', async (t) => {
  const root = await workspace(t);
  await fs.mkdir(path.join(root, 'Direct', 'Existing'), { recursive: true });
  await fs.mkdir(path.join(root, 'Web', 'projects'), { recursive: true });
  assert.equal(await createProject(root, 'Direct', 'Next'), path.join(root, 'Direct', 'Next'));
  assert.equal(
    await createProject(root, 'Web', 'Site'),
    path.join(root, 'Web', 'projects', 'Site'),
  );
  assert.deepEqual((await scanWorkspace(root)).projects.map((project) => project.name).sort(), [
    'Existing',
    'Next',
    'Site',
  ]);
  await assert.rejects(createProject(root, 'Direct', 'next'), /已存在/);
  await fs.mkdir(path.join(root, 'Cafe\u0301'));
  await assert.rejects(createCategory(root, 'Café'), /已存在/);
  await createProject(root, 'Cafe\u0301', 'Works');
});
test('Creation rejects invalid cross-platform names, paths and overwrites', async (t) => {
  const root = await workspace(t);
  await createCategory(root, 'Test');
  for (const name of [
    '',
    '.',
    '..',
    '../escape',
    'a/b',
    'a\\b',
    'bad:name',
    'a*',
    'con',
    'COM1.txt',
    'LPT9',
    'trailing.',
    '.hidden',
    'node_modules',
    'build',
    '汉'.repeat(100),
    'nul\x00',
  ]) {
    assert.throws(() => validateName(name));
    await assert.rejects(createCategory(root, name));
  }
  await assert.rejects(createProject(root, 'Test', 'Projects'), /收纳目录/);
  await fs.writeFile(path.join(root, 'Test', 'Projects', 'keep'), 'original');
  await assert.rejects(createProject(root, 'Test', 'keep'), /已存在/);
  assert.equal(await fs.readFile(path.join(root, 'Test', 'Projects', 'keep'), 'utf8'), 'original');
});
test('Creation never writes through symlinks or inside recognized project roots', async (t) => {
  const root = await workspace(t);
  await fs.mkdir(path.join(root, 'Standalone'));
  await fs.writeFile(path.join(root, 'Standalone', 'package.json'), '{}');
  await createCategory(root, 'Android');
  await fs.writeFile(path.join(root, 'Android', 'Projects', 'settings.gradle.kts'), '');
  await fs.symlink(path.join(root, 'Standalone'), path.join(root, 'Link'), 'dir');
  await fs.mkdir(path.join(root, 'LinkedContainer'));
  await fs.symlink(
    path.join(root, 'Standalone'),
    path.join(root, 'LinkedContainer', 'Projects'),
    'dir',
  );
  await assert.rejects(createProject(root, 'Standalone', 'Wrong'), /本身是一个工程/);
  await assert.rejects(createProject(root, 'Android', 'Wrong'), /本身是一个工程/);
  await assert.rejects(createProject(root, 'Link', 'Wrong'), /分类已不存在/);
  await assert.rejects(createProject(root, 'LinkedContainer', 'Wrong'), /不是普通目录/);
  await assert.rejects(createProject(root, '../Standalone', 'Wrong'), /分类已不存在/);
  const snapshot = await scanWorkspace(root);
  assert.equal(snapshot.projectContainers.Android, null);
  assert.equal(snapshot.projectContainers.Standalone, null);
  assert.equal(
    await fs.readdir(path.join(root, 'Standalone')).then((files) => files.includes('Wrong')),
    false,
  );
});
test('Category styles persist per workspace, migrate safely and discard unsupported values', async (t) => {
  const root = await workspace(t);
  const store = new Store(path.join(root, 'settings'));
  await store.load();
  assert.deepEqual(store.data.categoryStyles, {});
  const style = { color: 'orange', icon: 'flask' };
  store.data.categoryStyles = {
    [root]: { Test: style },
    other: { Test: { color: 'blue', icon: 'globe' }, invalid: { color: 'red', icon: 'anything' } },
  };
  await store.save();
  const restored = new Store(path.join(root, 'settings'));
  await restored.load();
  assert.deepEqual(restored.data.categoryStyles[root].Test, style);
  assert.deepEqual(restored.data.categoryStyles.other.Test, { color: 'blue', icon: 'globe' });
  assert.equal(restored.data.categoryStyles.other.invalid, undefined);
  assert.throws(() => validateStyle({ color: 'invalid', icon: 'folder' }));
});
