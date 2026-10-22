import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from './types';

const options = [
  { value: 'light', label: '亮色', Icon: Sun },
  { value: 'dark', label: '暗色', Icon: Moon },
  { value: 'system', label: '跟随系统', Icon: Monitor },
] as const;

export function ThemeSelector({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: ThemePreference;
  onChange(value: ThemePreference): void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`theme-selector ${compact ? 'compact' : 'with-previews'}`}
      role="radiogroup"
      aria-label={compact ? '外观主题' : '设置外观主题'}
    >
      {options.map(({ value: option, label, Icon }) => (
        <label key={option} className={`theme-option ${value === option ? 'selected' : ''}`}>
          <input
            type="radio"
            name={compact ? 'sidebar-theme' : 'settings-theme'}
            value={option}
            aria-label={label}
            checked={value === option}
            disabled={disabled}
            onChange={() => onChange(option)}
          />
          {!compact && (
            <span className={`theme-preview preview-${option}`} aria-hidden="true">
              <span className="preview-sidebar">
                <i />
                <i />
                <i />
              </span>
              <span className="preview-main">
                <b />
                <i />
                <i />
              </span>
            </span>
          )}
          <span className="theme-option-label">
            <Icon size={14} />
            <span>{compact && option === 'system' ? '系统' : label}</span>
            {!compact && value === option && <Check size={13} className="theme-check" />}
          </span>
        </label>
      ))}
    </div>
  );
}
