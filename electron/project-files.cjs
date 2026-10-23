const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 1000;
const imageTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

class ProjectFiles {
  constructor(root) {
    this.root = root;
  }

  static async open(directory) {
    const root = await fs.realpath(directory);
    if (!(await fs.stat(root)).isDirectory()) throw new Error('项目目录已不存在');
    return new ProjectFiles(root);
  }

  async resolve(relative = '') {
    if (
      typeof relative !== 'string' ||
      relative.length > 4096 ||
      relative.includes('\0') ||
      relative.includes('\\') ||
      path.isAbsolute(relative) ||
      /^[a-z]:/i.test(relative) ||
      (relative && relative.split('/').some((part) => !part || part === '.' || part === '..'))
    )
      throw new Error('无效的项目内路径');
    const resolved = await fs.realpath(path.join(this.root, relative));
    const within = path.relative(this.root, resolved);
    if (within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within))
      throw new Error('只能浏览当前项目内的文件');
    return resolved;
  }

  async list(relative = '') {
    const directory = await this.resolve(relative);
    const entries = (await fs.readdir(directory, { withFileTypes: true }))
      .map((entry) => ({
        name: entry.name,
        path: relative ? `${relative}/${entry.name}` : entry.name,
        kind: entry.isSymbolicLink()
          ? 'link'
          : entry.isDirectory()
            ? 'directory'
            : entry.isFile()
              ? 'file'
              : 'special',
      }))
      .sort(
        (a, b) =>
          Number(b.kind === 'directory') - Number(a.kind === 'directory') ||
          a.name.localeCompare(b.name, 'zh-CN', { numeric: true }),
      );
    return { entries: entries.slice(0, MAX_ENTRIES), truncated: entries.length > MAX_ENTRIES };
  }

  async read(relative) {
    const filename = await this.resolve(relative);
    const info = await fs.stat(filename);
    if (!info.isFile()) throw new Error('请选择普通文件');
    const base = { path: relative, size: info.size };
    if (info.size > MAX_FILE_BYTES)
      return { ...base, kind: 'unsupported', reason: '文件超过 2 MiB，请使用外部编辑器查看。' };
    // Non-blocking + a second stat also prevent an accidentally selected pipe
    // from blocking the application's main process.
    const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NONBLOCK);
    let bytes;
    try {
      if (!(await handle.stat()).isFile()) throw new Error('请选择普通文件');
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > MAX_FILE_BYTES)
        return { ...base, kind: 'unsupported', reason: '文件超过 2 MiB，请使用外部编辑器查看。' };
      bytes = buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
    base.size = bytes.length;
    const mime = imageTypes[path.extname(filename).toLowerCase()];
    if (mime)
      return { ...base, kind: 'image', dataURL: `data:${mime};base64,${bytes.toString('base64')}` };
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else if (bytes.includes(0))
      return { ...base, kind: 'unsupported', reason: '二进制文件暂不支持预览。' };
    try {
      const content = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      return { ...base, kind: 'text', content, encoding };
    } catch {
      return { ...base, kind: 'unsupported', reason: '文件编码暂不支持，请使用外部编辑器查看。' };
    }
  }
}

module.exports = { ProjectFiles, MAX_FILE_BYTES };
