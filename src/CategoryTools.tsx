import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownUp,
  Check,
  EyeOff,
  Grid2X2,
  List,
  MoreHorizontal,
  Palette,
  Plus,
  RefreshCw,
} from 'lucide-react';

type Panel = 'category' | 'sort' | 'view';
export function CategoryTools({
  category,
  busy,
  obscured,
  sort,
  view,
  onSort,
  onView,
  onScan,
  onCreate,
  onAppearance,
  onRemove,
}: {
  category: string;
  busy: boolean;
  obscured: boolean;
  sort: string;
  view: string;
  onSort: (value: string) => void;
  onView: (value: string) => void;
  onScan: () => void;
  onCreate: () => void;
  onAppearance: () => void;
  onRemove: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Panel, HTMLButtonElement | null>>>({});
  const menuId = useId();
  const close = (focus = false) => {
    if (focus && panel) triggers.current[panel]?.focus();
    setPanel(null);
  };
  useEffect(() => {
    if (busy || obscured) setPanel(null);
  }, [busy, obscured]);
  useEffect(() => {
    if (!panel) return;
    const previous = triggers.current[panel];
    (
      menu.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      menu.current?.querySelector<HTMLElement>('button')
    )?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPanel(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPanel(null);
        previous?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [panel]);
  function choose(action: () => void) {
    close(true);
    action();
  }
  const panelNames = { category: '分类操作', sort: '项目排序', view: '显示方式' };
  function menuFor(value: Panel) {
    if (panel !== value) return null;
    return (
      <div
        ref={menu}
        id={menuId}
        className="category-tool-menu"
        role="menu"
        aria-label={panelNames[value]}
        onKeyDown={(event) => {
          const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const key = event.key;
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
            event.preventDefault();
            event.stopPropagation();
            items[
              key === 'Home'
                ? 0
                : key === 'End'
                  ? items.length - 1
                  : (index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            ]?.focus();
          }
        }}
      >
        <span className="category-tool-menu-label">
          {value === 'category' ? category : panelNames[value]}
        </span>
        {value === 'category' ? (
          <>
            <button role="menuitem" onClick={() => choose(onAppearance)}>
              <Palette size={15} />
              修改分类外观
            </button>
            <button
              role="menuitem"
              aria-label={`移除分类 ${category}`}
              onClick={() => choose(onRemove)}
            >
              <EyeOff size={15} />
              移除分类
            </button>
          </>
        ) : value === 'sort' ? (
          [
            ['name', '按名称排序'],
            ['modified', '按目录修改时间'],
          ].map(([value, label]) => (
            <button
              key={value}
              role="menuitemradio"
              aria-checked={sort === value}
              onClick={() => choose(() => onSort(value))}
            >
              {sort === value ? <Check size={15} /> : <span className="tool-check-space" />}
              {label}
            </button>
          ))
        ) : (
          [
            ['grid', '卡片视图'],
            ['list', '列表视图'],
          ].map(([value, label]) => (
            <button
              key={value}
              role="menuitemradio"
              aria-checked={view === value}
              onClick={() => choose(() => onView(value))}
            >
              {value === 'grid' ? <Grid2X2 size={15} /> : <List size={15} />} {label}
              {view === value && <Check size={14} className="tool-menu-check" />}
            </button>
          ))
        )}
      </div>
    );
  }
  function trigger(value: Panel, icon: ReactNode) {
    return (
      <div className="category-tool-slot">
        <button
          ref={(element) => {
            triggers.current[value] = element;
          }}
          className="category-tool-button"
          disabled={busy}
          aria-label={panelNames[value]}
          aria-haspopup="menu"
          aria-expanded={panel === value}
          aria-controls={panel === value ? menuId : undefined}
          onClick={() => (panel === value ? close() : setPanel(value))}
        >
          {icon}
          <span className="category-tool-tooltip" aria-hidden="true">
            {panelNames[value]}
          </span>
        </button>
        {menuFor(value)}
      </div>
    );
  }
  return (
    <div
      ref={root}
      className={`category-tools ${panel ? 'has-menu' : ''}`}
      role="toolbar"
      aria-label="分类工具栏"
      aria-orientation="vertical"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))
          setPanel(null);
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('[role="menu"]')) return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '.category-tool-button:not(:disabled)',
          ),
        ];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[
          (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
      }}
    >
      {trigger('category', <MoreHorizontal size={19} />)}
      <div className="category-tools-divider" />
      {trigger('view', view === 'grid' ? <Grid2X2 size={18} /> : <List size={19} />)}
      {trigger('sort', <ArrowDownUp size={18} />)}
      <button
        className="category-tool-button"
        disabled={busy}
        aria-label="重新扫描"
        onClick={onScan}
      >
        <RefreshCw size={18} className={busy ? 'spin' : ''} />
        <span className="category-tool-tooltip" aria-hidden="true">
          重新扫描
        </span>
      </button>
      <button
        className="category-tool-button category-tool-primary"
        disabled={busy}
        aria-label="新建项目"
        onClick={onCreate}
      >
        <Plus size={21} />
        <span className="category-tool-tooltip" aria-hidden="true">
          新建项目
        </span>
      </button>
    </div>
  );
}
