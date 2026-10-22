const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { scanWorkspace } = require('../electron/scanner.cjs');
const { Store } = require('../electron/store.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  async function dir(relative, files = []) {
    const target = path.join(root, relative);
    await fs.mkdir(target, { recursive: true });
    for (const file of files) await fs.writeFile(path.join(target, file), '{}');
    return target;
  }
  return { root, dir };
}
test('Workspace categories flatten Projects, fall back to direct children, and preserve unknown folders', async (t) => {
  const { root, dir } = await fixture(t);
  await dir('WebDev/Projects/My Web', ['package.json', '.git']);
  await dir('WebDev/SDK/NotAProject');
  await dir("TestDev/中文 project 'one'");
  await dir('GameDev/Projects/MyGame/Assets');
  await dir('GameDev/Projects/MyGame/ProjectSettings');
  await dir('EmptyDev');
  const result = await scanWorkspace(root);
  assert.equal(result.projects.length, 3);
  const web = result.projects.find((p) => p.name === 'My Web');
  assert.equal(web.category, 'WebDev');
  assert.equal(web.type, 'JavaScript');
  assert.equal(web.git, true);
  assert.equal(result.projects.find((p) => p.name === 'MyGame').type, 'Unity');
  assert.equal(result.projects.find((p) => p.category === 'TestDev').type, 'Folder');
  assert(result.categories.includes('EmptyDev'));
  assert.equal((await scanWorkspace(root)).projects.find((p) => p.name === 'My Web').id, web.id);
});
test('Android Projects is a project root; app, build and gradle never become projects', async (t) => {
  const { root, dir } = await fixture(t);
  await dir('AndroidDev/Projects', ['settings.gradle.kts', 'build.gradle.kts']);
  await dir('AndroidDev/Projects/app', ['build.gradle.kts']);
  await dir('AndroidDev/Projects/build');
  await dir('AndroidDev/Projects/gradle');
  const { projects } = await scanWorkspace(root);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].type, 'Android');
  assert.equal(projects[0].name, 'AndroidDev');
  assert.equal(projects[0].relativePath, path.join('AndroidDev', 'Projects'));
});
test('Direct project roots are retained, container names are case-insensitive, symlinks and generated folders are skipped', async (t) => {
  const { root, dir } = await fixture(t);
  await dir('StandaloneFlutter', ['pubspec.yaml']);
  await dir('WebDev/projects/Visible', ['package.json']);
  await dir('WebDev/projects/node_modules/Dependency');
  await dir('WebDev/projects/build');
  await dir('.hidden/Projects/Hidden');
  await fs.symlink(path.join(root, 'WebDev'), path.join(root, 'LinkedDev'), 'dir');
  await fs.symlink(
    path.join(root, 'StandaloneFlutter'),
    path.join(root, 'WebDev/projects/LinkedProject'),
    'dir',
  );
  const { projects } = await scanWorkspace(root);
  assert.deepEqual(projects.map((p) => p.name).sort(), ['StandaloneFlutter', 'Visible']);
});
test('Unavailable workspace fails explicitly instead of returning an empty successful scan', async () => {
  await assert.rejects(scanWorkspace(path.join(os.tmpdir(), 'bkpm-does-not-exist-948231')));
});
test('Preferences persist across restarts and concurrent saves remain valid JSON', async (t) => {
  const { root } = await fixture(t);
  const store = new Store(root);
  await store.load();
  assert.equal(store.data.workspace, null);
  store.data.workspace = '/example/工作 空间';
  store.data.favorites = ['one'];
  store.data.theme = 'dark';
  const first = store.save();
  store.data.recent.one = 123;
  const second = store.save();
  await Promise.all([first, second]);
  const restored = new Store(root);
  await restored.load();
  assert.deepEqual(restored.data, store.data);
});
test('Invalid settings are reported and never silently overwritten', async (t) => {
  const { root } = await fixture(t);
  const file = path.join(root, 'settings.json');
  await fs.writeFile(file, 'broken');
  await assert.rejects(new Store(root).load(), /配置读取失败/);
  assert.equal(await fs.readFile(file, 'utf8'), 'broken');
});
test('Existing preferences without a theme and unknown themes default to system appearance', async (t) => {
  const { root } = await fixture(t);
  const file = path.join(root, 'settings.json');
  for (const saved of [
    { workspace: '/existing', favorites: ['kept'] },
    { theme: 'invalid', favorites: ['kept'] },
  ]) {
    await fs.writeFile(file, JSON.stringify(saved));
    const store = new Store(root);
    await store.load();
    assert.equal(store.data.theme, 'system');
    assert.deepEqual(store.data.favorites, ['kept']);
  }
});
