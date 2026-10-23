import { useRef, useState } from 'react';

export function GlassTransparency({
  value,
  disabled,
  onPreview,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onPreview(value: number | null): void;
  onSave(value: number): Promise<void>;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const requested = useRef<number | null>(null);
  const revision = useRef(0);
  const commit = async (next: number) => {
    if (requested.current === next) return;
    if (next === value && requested.current === null) {
      setDraft(null);
      onPreview(null);
      return;
    }
    const current = ++revision.current;
    requested.current = next;
    try {
      await onSave(next);
    } catch {
      // The parent reports the save error and retains the persisted setting.
    } finally {
      if (requested.current === next) requested.current = null;
      if (revision.current === current) {
        setDraft(null);
        onPreview(null);
      }
    }
  };
  return (
    <div className="glass-transparency">
      <label htmlFor="glass-transparency">毛玻璃透明度</label>
      <output htmlFor="glass-transparency">{draft ?? value}%</output>
      <input
        id="glass-transparency"
        type="range"
        min="0"
        max="100"
        step="1"
        value={draft ?? value}
        aria-valuetext={`${draft ?? value}%`}
        aria-describedby="glass-transparency-help"
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          revision.current++;
          setDraft(next);
          onPreview(next);
        }}
        onPointerDown={(event) => {
          if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => void commit(Number(event.currentTarget.value))}
        onPointerCancel={(event) => void commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => {
          if (
            [
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
              'PageUp',
              'PageDown',
            ].includes(event.key)
          )
            void commit(Number(event.currentTarget.value));
        }}
        onBlur={(event) => void commit(Number(event.currentTarget.value))}
      />
    </div>
  );
}
