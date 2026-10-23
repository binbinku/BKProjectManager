const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const excluded = new Set([
  'node_modules',
  'build',
  'dist',
  'target',
  'vendor',
  '__pycache__',
  '$RECYCLE.BIN',
  'System Volume Information',
]);
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
async function readEntries(directory) {
  return fs.readdir(directory, { withFileTypes: true });
}
function directories(entries) {
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !excluded.has(e.name))
    .sort((a, b) => collator.compare(a.name, b.name));
}
function detectType(entries) {
  const names = new Set(entries.map((e) => e.name));
  if (names.has('Assets') && names.has('ProjectSettings')) return 'Unity';
  if (entries.some((e) => e.isFile() && e.name.endsWith('.uproject'))) return 'Unreal';
  if (names.has('settings.gradle') || names.has('settings.gradle.kts')) return 'Android';
  if (names.has('pubspec.yaml')) return 'Flutter';
  if (names.has('package.json')) return 'JavaScript';
  if (names.has('Cargo.toml')) return 'Rust';
  if (names.has('go.mod')) return 'Go';
  if (names.has('pyproject.toml') || names.has('requirements.txt')) return 'Python';
  if (entries.some((e) => e.isFile() && /\.(sln|slnx|csproj)$/.test(e.name))) return '.NET';
  if (names.has('pom.xml')) return 'Java';
  return 'Folder';
}
async function scanWorkspace(input) {
  const root = await fs.realpath(input);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('工作空间必须是文件夹');
  const groups = directories(await readEntries(root));
  const projects = [];
  const categories = [];
  const projectContainers = {};
  const warnings = [];
  async function addProject(projectPath, category, name, entries) {
    try {
      const info = entries ?? (await readEntries(projectPath));
      const stat = await fs.stat(projectPath);
      projects.push({
        id: createHash('sha256').update(projectPath).digest('hex').slice(0, 24),
        name,
        path: projectPath,
        relativePath: path.relative(root, projectPath),
        category,
        type: detectType(info),
        git: info.some((e) => e.name === '.git'),
        modifiedAt: stat.mtimeMs,
      });
    } catch {
      warnings.push(`无法读取项目：${path.relative(root, projectPath)}`);
    }
  }
  for (const group of groups) {
    const groupPath = path.join(root, group.name);
    categories.push(group.name);
    Object.defineProperty(projectContainers, group.name, {
      value: null,
      writable: true,
      enumerable: true,
    });
    try {
      const entries = await readEntries(groupPath);
      // A first-level directory may itself be a project.
      if (detectType(entries) !== 'Folder') {
        await addProject(groupPath, group.name, group.name, entries);
        continue;
      }
      const container = entries.find((e) => e.isDirectory() && e.name.toLowerCase() === 'projects');
      const scanPath = container ? path.join(groupPath, container.name) : groupPath;
      const children = container ? await readEntries(scanPath) : entries;
      // AndroidDev/Projects is an Android root, not a container for app/build/gradle.
      if (container && detectType(children) !== 'Folder') {
        await addProject(scanPath, group.name, group.name, children);
      } else {
        projectContainers[group.name] = entries.some(
          (entry) => entry.name.toLowerCase() === 'projects' && !entry.isDirectory(),
        )
          ? null
          : scanPath;
        for (const child of directories(children))
          await addProject(path.join(scanPath, child.name), group.name, child.name);
      }
    } catch {
      warnings.push(`无法读取分类：${group.name}`);
    }
  }
  return {
    workspace: root,
    categories,
    projectContainers,
    projects,
    warnings,
    scannedAt: Date.now(),
  };
}
module.exports = { scanWorkspace, detectType, directories };
