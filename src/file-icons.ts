import generated from './generated/material-icons.json';

type Associations = Record<string, string>;
interface IconSet {
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileNames?: Associations;
  fileExtensions?: Associations;
  folderNames?: Associations;
  folderNamesExpanded?: Associations;
}
const manifest = generated as IconSet & {
  iconDefinitions: Record<string, { iconPath: string }>;
  light: IconSet;
};

function resolveIcon(relative: string, folder: boolean, expanded: boolean, light: boolean) {
  const theme = light ? manifest.light : {};
  const association = (key: keyof IconSet, name: string) =>
    (theme[key] as Associations | undefined)?.[name] ||
    (manifest[key] as Associations | undefined)?.[name];
  const segments = relative.toLowerCase().split('/');
  const key = folder ? (expanded ? 'folderNamesExpanded' : 'folderNames') : 'fileNames';
  let icon: string | undefined;
  // More specific parent/name associations precede plain basenames.
  for (let index = 0; index < segments.length && !icon; index++)
    icon = association(key, segments.slice(index).join('/'));
  if (!folder && !icon) {
    const name = segments.at(-1)!;
    // Check compound extensions (e.g. test.tsx, d.ts) before their last suffix.
    for (let dot = name.indexOf('.'); dot !== -1 && !icon; dot = name.indexOf('.', dot + 1))
      icon = association('fileExtensions', name.slice(dot + 1));
  }
  const fallback = folder ? (expanded ? 'folderExpanded' : 'folder') : 'file';
  icon ||= theme[fallback] || manifest[fallback];
  const filename =
    manifest.iconDefinitions[icon || '']?.iconPath ||
    manifest.iconDefinitions[manifest[fallback]!]!.iconPath;
  return new URL(`./material-icon-theme/${filename}`, document.baseURI).href;
}

export function fileIcons(path: string, folder: boolean, expanded: boolean) {
  return {
    dark: resolveIcon(path, folder, expanded, false),
    light: resolveIcon(path, folder, expanded, true),
  };
}
