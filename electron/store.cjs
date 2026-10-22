const fs = require('node:fs/promises');
const path = require('node:path');
const defaults = () => ({
  workspace: null,
  favorites: [],
  recent: {},
  opener: 'folder',
  customEditor: null,
  theme: 'system',
});
class Store {
  constructor(directory) {
    this.file = path.join(directory, 'settings.json');
    this.data = defaults();
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const saved = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.data = {
        ...defaults(),
        workspace: typeof saved.workspace === 'string' ? saved.workspace : null,
        favorites: Array.isArray(saved.favorites)
          ? saved.favorites.filter((id) => typeof id === 'string')
          : [],
        recent:
          saved.recent && typeof saved.recent === 'object' && !Array.isArray(saved.recent)
            ? saved.recent
            : {},
        opener: ['folder', 'vscode', 'cursor', 'custom'].includes(saved.opener)
          ? saved.opener
          : 'folder',
        customEditor: typeof saved.customEditor === 'string' ? saved.customEditor : null,
        theme: ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : 'system',
      };
    } catch (error) {
      if (error.code !== 'ENOENT')
        throw new Error(`配置读取失败，请检查 ${this.file}：${error.message}`);
    }
    return this.data;
  }
  save() {
    const content = JSON.stringify(this.data, null, 2);
    const write = async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(`${this.file}.tmp`, content, 'utf8');
      await fs.rename(`${this.file}.tmp`, this.file);
    };
    this.queue = this.queue.then(write, write);
    return this.queue;
  }
}
module.exports = { Store };
