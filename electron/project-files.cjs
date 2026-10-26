const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

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
    this.saveQueue = Promise.resolve();
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
      return {
        ...base,
        kind: 'text',
        content,
        encoding,
        bom: encoding !== 'utf-8' || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf),
        revision: createHash('sha256').update(bytes).digest('hex'),
      };
    } catch {
      return { ...base, kind: 'unsupported', reason: '文件编码暂不支持，请使用外部编辑器查看。' };
    }
  }

  saveMarkdown(relative, content, revision) {
    const job = this.saveQueue.then(() => this.writeMarkdown(relative, content, revision));
    this.saveQueue = job.catch(() => {});
    return job;
  }

  async markdownTarget(relative) {
    const filename = await this.resolve(relative);
    if (!/\.(md|markdown)$/i.test(relative)) throw new Error('只能编辑 Markdown 文件');
    let current = this.root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      if ((await fs.lstat(current)).isSymbolicLink())
        throw new Error('请直接打开原文件，不能编辑符号链接中的 Markdown');
    }
    const info = await fs.lstat(filename);
    if (!info.isFile() || info.nlink > 1) throw new Error('只能编辑普通的 Markdown 文件');
    return { filename, info };
  }

  async writeMarkdown(relative, content, revision) {
    if (
      typeof content !== 'string' ||
      content.length > MAX_FILE_BYTES ||
      typeof revision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(revision)
    )
      throw new Error('无效的 Markdown 保存内容（最大 2 MiB）');
    const { filename, info } = await this.markdownTarget(relative);
    const original = await this.read(relative);
    const checkRevision = (current) => {
      if (current.kind !== 'text' || current.revision !== revision)
        throw new Error('文件已被其他程序修改。请先复制保留当前修改，再重新读取文件。');
    };
    checkRevision(original);
    const newline = original.content.match(/\r\n|\r|\n/)?.[0] || '\n';
    const normalized = content.replace(/\r\n|\r|\n/g, newline);
    let bytes;
    if (original.encoding === 'utf-8') {
      bytes = Buffer.from(normalized, 'utf8');
      if (original.bom) bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]);
    } else {
      bytes = Buffer.from(`\ufeff${normalized}`, 'utf16le');
      if (original.encoding === 'utf-16be') bytes.swap16();
    }
    if (bytes.length > MAX_FILE_BYTES) throw new Error('文件超过 2 MiB，请使用外部编辑器编辑。');
    await fs.access(filename, constants.W_OK);
    const temporary = path.join(path.dirname(filename), `.bkpm-${randomUUID()}.tmp`);
    try {
      const handle = await fs.open(temporary, 'wx', info.mode & 0o777);
      try {
        await handle.chmod(info.mode & 0o777);
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      // Revalidate immediately before replacing; a failed save leaves the original intact.
      const target = await this.markdownTarget(relative);
      if (target.filename !== filename || target.info.ino !== info.ino)
        throw new Error('文件位置已变化，请重新读取文件。');
      checkRevision(await this.read(relative));
      await fs.rename(temporary, filename);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return this.read(relative);
  }
}

module.exports = { ProjectFiles, MAX_FILE_BYTES };
