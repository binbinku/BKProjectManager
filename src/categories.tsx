import {
  Box,
  Code2,
  Database,
  FlaskConical,
  Folder,
  Gamepad2,
  Globe,
  Palette,
  Server,
  Smartphone,
  Terminal,
} from 'lucide-react';
import options from '../electron/category-options.json';
import type { CategoryStyle } from './types';

export const categoryColors = options.colors;
export const categoryIcons = {
  folder: Folder,
  globe: Globe,
  gamepad: Gamepad2,
  smartphone: Smartphone,
  flask: FlaskConical,
  code: Code2,
  server: Server,
  database: Database,
  palette: Palette,
  terminal: Terminal,
  box: Box,
};
export const colorLabels: Record<string, string> = {
  blue: '蓝色',
  purple: '紫色',
  green: '绿色',
  orange: '橙色',
  pink: '粉色',
  teal: '青色',
  gray: '灰色',
};
export const iconLabels: Record<string, string> = {
  folder: '文件夹',
  globe: '网站',
  gamepad: '游戏',
  smartphone: '移动应用',
  flask: '实验',
  code: '代码',
  server: '服务器',
  database: '数据库',
  palette: '设计',
  terminal: '终端',
  box: '工具',
};
export function defaultCategoryStyle(name: string): CategoryStyle {
  const preset = options.presets.find((item) => new RegExp(item.pattern, 'i').test(name));
  if (preset) return { color: preset.color, icon: preset.icon };
  const hash = Array.from(name.normalize('NFC')).reduce(
    (value, char) => (value * 31 + char.codePointAt(0)!) >>> 0,
    0,
  );
  return { color: options.colors[hash % (options.colors.length - 1)], icon: 'folder' };
}
export function CategoryIcon({ style, size = 17 }: { style: CategoryStyle; size?: number }) {
  const Icon = categoryIcons[style.icon as keyof typeof categoryIcons] ?? Folder;
  return (
    <Icon
      className={`category-icon ${style.color}`}
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}
