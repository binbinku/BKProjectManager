const path = require('node:path');
const emptyVisibility = () => ({ categories: [], projects: [] });
function loadVisibility(saved) {
  const result = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
  for (const [workspace, value] of Object.entries(saved)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const strings = (items) =>
      Array.isArray(items)
        ? [...new Set(items.filter((item) => typeof item === 'string' && item.length > 0))]
        : [];
    Object.defineProperty(result, workspace, {
      enumerable: true,
      value: { categories: strings(value.categories), projects: strings(value.projects) },
    });
  }
  return result;
}
function getVisibility(settings) {
  return settings.visibility[settings.workspace] ?? emptyVisibility();
}
function visibleSnapshot(snapshot, hidden) {
  if (!snapshot) return null;
  const categories = snapshot.categories.filter(
    (category) => !hidden.categories.includes(category),
  );
  return {
    ...snapshot,
    categories,
    projectContainers: Object.fromEntries(
      Object.entries(snapshot.projectContainers).filter(([category]) =>
        categories.includes(category),
      ),
    ),
    projects: snapshot.projects.filter(
      (project) =>
        !hidden.categories.includes(project.category) &&
        !hidden.projects.includes(project.relativePath),
    ),
    warnings: snapshot.warnings.filter((warning) => {
      if (hidden.categories.some((category) => warning === `无法读取分类：${category}`))
        return false;
      const prefix = '无法读取项目：';
      if (!warning.startsWith(prefix)) return true;
      const relative = warning.slice(prefix.length);
      return (
        !hidden.projects.includes(relative) &&
        !hidden.categories.includes(relative.split(path.sep)[0])
      );
    }),
  };
}
async function saveVisibility(store, next) {
  const previous = store.data.visibility;
  store.data.visibility = { ...previous, [store.data.workspace]: next };
  try {
    await store.save();
  } catch (error) {
    store.data.visibility = previous;
    throw error;
  }
}
module.exports = {
  emptyVisibility,
  loadVisibility,
  getVisibility,
  visibleSnapshot,
  saveVisibility,
};
