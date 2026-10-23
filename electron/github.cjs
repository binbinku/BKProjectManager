const fs = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');

async function readConfig(file) {
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 256 * 1024) return '';
    const buffer = Buffer.alloc(256 * 1024 + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead > 256 * 1024 ? '' : buffer.toString('utf8', 0, bytesRead);
  } catch {
    return '';
  } finally {
    await handle?.close();
  }
}

function gitValue(input) {
  let result = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const character = input[i];
    if (character === '"') quoted = !quoted;
    else if (!quoted && (character === '#' || character === ';')) break;
    else if (character === '\\') {
      const escaped = input[++i];
      const escapes = { n: '\n', t: '\t', b: '\b', '\\': '\\', '"': '"' };
      if (!Object.hasOwn(escapes, escaped)) return null;
      result += escapes[escaped];
    } else result += character;
  }
  return quoted ? null : result.trim();
}

function configEntries(text) {
  const entries = [];
  let section = '',
    subsection = null,
    pending = '';
  for (const source of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = pending + source;
    if ((line.match(/\\+$/)?.[0].length ?? 0) % 2) {
      pending = line.slice(0, -1);
      continue;
    }
    pending = '';
    const value = line.trim();
    if (value.startsWith('[')) {
      const header = value.match(
        /^\[\s*([\w-]+)(?:\s+"((?:\\.|[^"\\])*)"|\.([^\]]+))?\s*\]\s*(?:[#;].*)?$/,
      );
      section = header?.[1].toLowerCase() ?? '';
      subsection =
        header?.[2] !== undefined
          ? gitValue(`"${header[2]}"`)
          : (header?.[3]?.toLowerCase() ?? null);
      continue;
    }
    const assignment = value.match(/^([a-z][a-z0-9-]*)\s*=\s*(.*)$/i);
    if (!assignment) continue;
    const decoded = gitValue(assignment[2]);
    if (decoded !== null)
      entries.push({ section, subsection, key: assignment[1].toLowerCase(), value: decoded });
  }
  return entries;
}

function githubURL(input) {
  if (typeof input !== 'string' || /[\s\x00-\x1f\x7f]/.test(input)) return null;
  let repositoryPath;
  const scp = input.match(/^(?:[^@/:]+@)?github\.com:([^?#]+)$/i);
  if (scp) repositoryPath = scp[1];
  else {
    try {
      const url = new URL(input);
      if (!['https:', 'http:', 'ssh:', 'git:'].includes(url.protocol)) return null;
      if (
        url.hostname.toLowerCase() !== 'github.com' &&
        !(url.protocol === 'ssh:' && url.hostname.toLowerCase() === 'ssh.github.com')
      )
        return null;
      if (url.search || url.hash) return null;
      repositoryPath = url.pathname;
    } catch {
      return null;
    }
  }
  const match = repositoryPath.match(/^\/?([a-z0-9][a-z0-9-]*)\/([a-z0-9_.-]+)\/?$/i);
  if (!match) return null;
  const repository = match[2].replace(/\.git$/i, '');
  if (!repository || repository === '.' || repository === '..') return null;
  return `https://github.com/${match[1]}/${repository}`;
}

async function readGitHubRemotes(project) {
  let gitDirectory = path.join(project, '.git');
  try {
    const info = await fs.lstat(gitDirectory);
    if (info.isFile()) {
      const match = (await readConfig(gitDirectory)).trim().match(/^gitdir:\s*(.+)$/);
      if (!match) return [];
      gitDirectory = path.resolve(project, match[1]);
    } else if (!info.isDirectory()) return [];
    const common = (await readConfig(path.join(gitDirectory, 'commondir'))).trim();
    if (common.includes('\n') || common.includes('\0')) return [];
    const commonDirectory = common ? path.resolve(gitDirectory, common) : gitDirectory;
    const entries = configEntries(await readConfig(path.join(commonDirectory, 'config')));
    if (
      entries.some(
        (e) =>
          e.section === 'extensions' &&
          e.key === 'worktreeconfig' &&
          /^(true|yes|on|1)$/i.test(e.value),
      )
    )
      entries.push(...configEntries(await readConfig(path.join(gitDirectory, 'config.worktree'))));
    const names = new Set();
    const remotes = [];
    for (const entry of entries) {
      if (
        entry.section !== 'remote' ||
        entry.key !== 'url' ||
        !entry.subsection ||
        names.has(entry.subsection)
      )
        continue;
      names.add(entry.subsection);
      const url = githubURL(entry.value);
      if (url)
        remotes.push({
          name: entry.subsection,
          url,
          repository: url.slice('https://github.com/'.length),
        });
    }
    remotes.sort(
      (a, b) =>
        Number(b.name === 'origin') - Number(a.name === 'origin') || a.name.localeCompare(b.name),
    );
    const seen = new Set();
    return remotes.filter((remote) => {
      const key = remote.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

module.exports = { githubURL, readGitHubRemotes };
