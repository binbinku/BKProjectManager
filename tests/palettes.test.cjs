const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Store } = require('../electron/store.cjs');
const palettes = require('../electron/palettes.json');
function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb.reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
test('Seven built-in themes contain only matching color tokens in both modes, with readable text and buttons', () => {
  assert.deepEqual(Object.keys(palettes), [
    'default',
    'graphite',
    'sand',
    'forest',
    'github',
    'apple',
    'neo',
  ]);
  const tokens = Object.keys(palettes.default.colors.light).sort();
  for (const palette of Object.values(palettes))
    for (const colors of Object.values(palette.colors)) {
      assert.deepEqual(Object.keys(colors).sort(), tokens);
      for (const value of Object.values(colors)) assert.match(value, /^#[0-9a-f]{6}$/);
      for (const background of ['canvas', 'sidebar', 'surface', 'surface-soft'])
        for (const foreground of ['text', 'secondary'])
          assert.ok(
            contrast(colors[foreground], colors[background]) >= 4.5,
            `${palette.name}: ${foreground} on ${background}`,
          );
      assert.ok(contrast(colors.button, colors['button-text']) >= 4.5);
    }
});
test('Existing settings migrate to the default palette; valid palette and appearance persist independently', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-palettes-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'settings.json');
  for (const palette of [undefined, 'invalid', '__proto__', null, 1]) {
    await fs.writeFile(file, JSON.stringify({ palette, theme: 'dark', favorites: ['kept'] }));
    const store = new Store(directory);
    await store.load();
    assert.equal(store.data.palette, 'default');
    assert.equal(store.data.theme, 'dark');
    assert.deepEqual(store.data.favorites, ['kept']);
  }
  for (const name of Object.keys(palettes)) {
    const store = new Store(directory);
    await store.load();
    store.data.palette = name;
    store.data.theme = 'system';
    await store.save();
    const restored = new Store(directory);
    await restored.load();
    assert.equal(restored.data.palette, name);
    assert.equal(restored.data.theme, 'system');
  }
});
