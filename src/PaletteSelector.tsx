import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { PaletteName } from './types';
import { palettes } from './palettes';

export function PaletteSelector({
  value,
  onChange,
  disabled,
}: {
  value: PaletteName;
  onChange: (value: PaletteName) => void;
  disabled: boolean;
}) {
  return (
    <div className="palette-selector" role="radiogroup" aria-label="配色主题">
      {(Object.entries(palettes) as [PaletteName, typeof palettes.default][]).map(
        ([name, palette]) => {
          const tokens = ['canvas', 'sidebar', 'surface', 'border', 'text', 'button'] as const;
          const style = Object.fromEntries(
            tokens.map((token) => [
              `--palette-${token}`,
              `light-dark(${palette.colors.light[token]}, ${palette.colors.dark[token]})`,
            ]),
          ) as CSSProperties;
          return (
            <label
              key={name}
              className={`palette-option ${value === name ? 'selected' : ''}`}
              style={style}
            >
              <input
                type="radio"
                name="settings-palette"
                value={name}
                checked={value === name}
                disabled={disabled}
                aria-label={palette.name}
                onChange={() => onChange(name)}
              />
              <span className="palette-preview" aria-hidden="true">
                <span className="palette-preview-sidebar">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="palette-preview-main">
                  <span className="palette-preview-title" />
                  <span className="palette-preview-cards">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="palette-preview-action" />
                </span>
              </span>
              <span className="palette-option-name">
                {palette.name}
                <Check size={13} style={{ visibility: value === name ? 'visible' : 'hidden' }} />
              </span>
              <span className="palette-description">{palette.description}</span>
            </label>
          );
        },
      )}
    </div>
  );
}
