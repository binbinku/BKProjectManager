const fs = require('node:fs/promises');
const path = require('node:path');
const { detectType, directories } = require('./scanner.cjs');
const options = require('./category-options.json');

function validateStyle(style) {
  if (!style || !options.colors.includes(style.color) || !options.icons.includes(style.icon))
    throw new Error('请选择有效的分类颜色和图标');
  return { color: style.color, icon: style.icon };
}
function validateName(input) {
  if (typeof input !== 'string') throw new Error('请输入名称');
  const name = input.trim().normalize('NFC');
  if (
    !name ||
    name.startsWith('.') ||
    /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ||
    Buffer.byteLength(name) > 200 ||
    !directories([{ name, isDirectory: () => true }]).length
  )
    throw new Error('名称不能包含路径、特殊字符、系统保留名称或超过 200 字节');
  return name;
}
async function categoryDirectory(workspace, category) {
  const root = await fs.realpath(workspace);
  if (typeof category !== 'string') throw new Error('请选择有效分类');
  const name = category;
  // Only actual first-level directories are writable; never follow a category symlink.
  const entries = directories(await fs.readdir(root, { withFileTypes: true }));
  if (!entries.some((entry) => entry.name === name)) throw new Error('分类已不存在，请重新扫描');
  const target = path.join(root, name);
  if ((await fs.realpath(target)) !== target) throw new Error('分类路径已改变，请重新扫描');
  return target;
}
async function projectContainer(workspace, category) {
  const directory = await categoryDirectory(workspace, category);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  if (detectType(entries) !== 'Folder')
    throw new Error('此分类本身是一个工程，请在其他分类中新建项目');
  const container = entries.find((entry) => entry.name.toLowerCase() === 'projects');
  if (!container) return directory;
  if (!container.isDirectory()) throw new Error('Projects 不是普通目录，无法在此新建项目');
  const target = path.join(directory, container.name);
  if ((await fs.realpath(target)) !== target) throw new Error('Projects 路径已改变，请重新扫描');
  if (detectType(await fs.readdir(target, { withFileTypes: true })) !== 'Folder')
    throw new Error('此分类中的 Projects 本身是一个工程，请在其他分类中新建项目');
  return target;
}
async function makeDirectory(parent, name) {
  if (
    (await fs.readdir(parent)).some(
      (entry) => entry.normalize('NFC').toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    throw new Error('同名文件或文件夹已存在，请换一个名称');
  try {
    await fs.mkdir(path.join(parent, name));
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('同名文件或文件夹已存在，请换一个名称');
    throw error;
  }
  return path.join(parent, name);
}
async function createCategory(workspace, input) {
  const root = await fs.realpath(workspace);
  const target = await makeDirectory(root, validateName(input));
  try {
    await fs.mkdir(path.join(target, 'Projects'));
  } catch (error) {
    await fs.rmdir(target).catch(() => {});
    throw error;
  }
  return target;
}
async function createProject(workspace, category, input) {
  const name = validateName(input);
  if (name.toLowerCase() === 'projects')
    throw new Error('Projects 是收纳目录名称，请使用其他项目名称');
  return makeDirectory(await projectContainer(workspace, category), name);
}
module.exports = {
  validateName,
  validateStyle,
  categoryDirectory,
  projectContainer,
  createCategory,
  createProject,
};
