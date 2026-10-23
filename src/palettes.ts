import palettes from '../electron/palettes.json';
import type { PaletteName } from './types';

export { palettes };
export function applyPalette(root: HTMLElement, name: PaletteName) {
  const palette = palettes[name];
  for (const token of Object.keys(palette.colors.light)) {
    const key = token as keyof typeof palette.colors.light;
    root.style.setProperty(
      `--${token}`,
      `light-dark(${palette.colors.light[key]}, ${palette.colors.dark[key]})`,
    );
  }
  root.dataset.palette = name;
}
export function currentPaletteColors() {
  const root = document.documentElement;
  const name = root.dataset.palette as PaletteName;
  return (palettes[name] ?? palettes.default).colors[
    root.dataset.theme === 'dark' ? 'dark' : 'light'
  ];
}
