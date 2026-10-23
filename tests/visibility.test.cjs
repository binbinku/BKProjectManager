const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  visibleSnapshot,
  loadVisibility,
  getVisibility,
  saveVisibility,
  emptyVisibility,
} = require('../electron/visibility.cjs');
const { Store } = require('../electron/store.cjs');
const { scanWorkspace } = require('../electron/scanner.cjs');

test('Visibility filters projects, categories and creation targets without mutating scanner results', () => {
  const snapshot = {
    categories: ['Web', 'Other', 'Empty'],
    projectContainers: { Web: '/Web', Other: '/Other', Empty: '/Empty' },
    projects: [
      { id: '1', category: 'Web', relativePath: 'Web/A' },
      { id: '2', category: 'Web', relativePath: 'Web/B' },
      { id: '3', category: 'Other', relativePath: 'Other/C' },
    ],
    warnings: [],
  };
  const original = structuredClone(snapshot);
  const hidden = { categories: ['Web', 'Empty'], projects: ['Other/C', 'Web/A'] };
  assert.deepEqual(visibleSnapshot(snapshot, hidden).categories, ['Other']);
  assert.deepEqual(visibleSnapshot(snapshot, hidden).projects, []);
  assert.deepEqual(visibleSnapshot(snapshot, hidden).projectContainers, { Other: '/Other' });
  const categoryRestored = visibleSnapshot(snapshot, { ...hidden, categories: [] });
  assert.deepEqual(
    categoryRestored.projects.map((project) => project.id),
    ['2'],
  );
  assert.deepEqual(visibleSnapshot(snapshot, emptyVisibility()), snapshot);
  assert.deepEqual(snapshot, original);
  assert.equal(visibleSnapshot(null, hidden), null);
});
test('Warnings about removed items stay hidden while unrelated scan errors remain visible', () => {
  const snapshot = {
    categories: ['Hidden', 'Visible'],
    projects: [],
    projectContainers: {},
    warnings: [
      '无法读取分类：Hidden',
      `无法读取项目：${path.join('Hidden', 'Folder')}`,
      `无法读取项目：${path.join('Visible', 'Removed')}`,
      '无法读取分类：Visible',
    ],
  };
  assert.deepEqual(
    visibleSnapshot(snapshot, {
      categories: ['Hidden'],
      projects: [path.join('Visible', 'Removed')],
    }).warnings,
    ['无法读取分类：Visible'],
  );
});
test('Visibility migrates old settings, sanitizes invalid lists, deduplicates and persists per workspace', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-visibility-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, 'settings.json'),
    JSON.stringify({ workspace: '/first', favorites: ['kept'] }),
  );
  const store = new Store(root);
  await store.load();
  assert.deepEqual(getVisibility(store.data), emptyVisibility());
  const hidden = { categories: ['Web'], projects: ['Other/Project'] };
  await saveVisibility(store, hidden);
  store.data.workspace = '/second';
  assert.deepEqual(getVisibility(store.data), emptyVisibility());
  await saveVisibility(store, { categories: [], projects: ['Web/Different'] });
  const restored = new Store(root);
  await restored.load();
  assert.deepEqual(restored.data.visibility['/first'], hidden);
  assert.deepEqual(getVisibility(restored.data), { categories: [], projects: ['Web/Different'] });
  assert.deepEqual(restored.data.favorites, ['kept']);
  assert.deepEqual(
    loadVisibility({
      '/first': { categories: ['Web', null, 'Web', ''], projects: 'bad' },
      invalid: [],
    }),
    { '/first': { categories: ['Web'], projects: [] } },
  );
});
test('Failed saves roll back exclusions instead of reporting a nonpersistent removal', async () => {
  const previous = { '/root': { categories: [], projects: ['Web/A'] } };
  const store = {
    data: { workspace: '/root', visibility: previous },
    save: async () => {
      throw new Error('disk full');
    },
  };
  await assert.rejects(saveVisibility(store, { categories: ['Web'], projects: [] }), /disk full/);
  assert.equal(store.data.visibility, previous);
});
test('Hidden content remains on disk and discovery stays independent of removal preferences', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-hidden-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'Workspace');
  const project = path.join(workspace, 'Web', 'Projects', 'Alpha');
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(project, 'package.json'), '{"private":true}');
  const snapshot = await scanWorkspace(workspace);
  const hidden = { categories: ['Web'], projects: [snapshot.projects[0].relativePath] };
  assert.equal(visibleSnapshot(snapshot, hidden).projects.length, 0);
  assert.equal((await scanWorkspace(workspace)).projects.length, 1);
  assert.equal(await fs.readFile(path.join(project, 'package.json'), 'utf8'), '{"private":true}');
});
