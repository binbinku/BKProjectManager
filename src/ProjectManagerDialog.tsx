import { useRef, useState } from 'react';
import { useModalFocus } from './useModalFocus';
import { Check, Loader2, X } from 'lucide-react';
import type { AppState, CategoryStyle } from './types';
import {
  CategoryIcon,
  categoryColors,
  categoryIcons,
  colorLabels,
  iconLabels,
  defaultCategoryStyle,
} from './categories';

export type ManagementDialog = { kind: 'category' | 'project' | 'appearance'; category?: string };
export function ProjectManagerDialog({
  dialog,
  state,
  onSaved,
  onClose,
  getStyle,
}: {
  dialog: ManagementDialog;
  state: AppState;
  onSaved: (state: AppState, category: string) => void;
  onClose: () => void;
  getStyle: (category: string) => CategoryStyle;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(
    dialog.category ??
      state.snapshot?.categories.find((item) => state.snapshot?.projectContainers[item]) ??
      '',
  );
  const [style, setStyle] = useState<CategoryStyle>(getStyle(dialog.category ?? ''));
  const [customStyle, setCustomStyle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const modalRef = useModalFocus(onClose, saving);
  const appearance = dialog.kind !== 'project';
  const title =
    dialog.kind === 'category' ? '新增分类' : dialog.kind === 'project' ? '新建项目' : '分类外观';
  const container = state.snapshot?.projectContainers[category];
  const selectedPath = container
    ? `${container}${window.workspaceAPI.platform === 'win32' ? '\\' : '/'}${name.trim() || '项目名称'}`
    : null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const api = window.workspaceAPI;
      const next =
        dialog.kind === 'category'
          ? await api.createCategory(name, style)
          : dialog.kind === 'appearance'
            ? await api.setCategoryStyle(category, style)
            : await api.createProject(category, name);
      onSaved(next, dialog.kind === 'category' ? name.trim().normalize('NFC') : category);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : '操作失败，请重试',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <section
        ref={modalRef}
        className="settings-modal management-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <div className="modal-heading">
            <span className="modal-kicker">工作空间管理</span>
            <button type="button" aria-label="关闭对话框" disabled={saving} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <h2 id="management-title">{title}</h2>
          <p className="settings-description">
            {dialog.kind === 'category'
              ? '为同类项目准备一个专属空间。'
              : dialog.kind === 'project'
                ? '在选定分类中创建一个空文件夹，随时开始工作。'
                : '为这个分类选择容易辨认的颜色和图标。'}
          </p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <fieldset disabled={saving}>
            {dialog.kind === 'project' && (
              <>
                <label className="settings-label" htmlFor="project-category">
                  所属分类
                </label>
                <select
                  id="project-category"
                  className="settings-select"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {state.snapshot?.categories.map((item) => (
                    <option
                      key={item}
                      value={item}
                      disabled={!state.snapshot?.projectContainers[item]}
                    >
                      {item}
                      {!state.snapshot?.projectContainers[item] ? '（工程根目录）' : ''}
                    </option>
                  ))}
                </select>
              </>
            )}
            {dialog.kind !== 'appearance' ? (
              <>
                <label className="settings-label" htmlFor="creation-name">
                  {dialog.kind === 'category' ? '分类名称' : '项目名称'}
                </label>
                <input
                  id="creation-name"
                  className="creation-input"
                  value={name}
                  required
                  maxLength={100}
                  placeholder={dialog.kind === 'category' ? '例如 DesignDev' : '例如 MyProject'}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (dialog.kind === 'category' && !customStyle)
                      setStyle(defaultCategoryStyle(event.target.value));
                  }}
                />
              </>
            ) : (
              <div className="category-preview">
                <CategoryIcon style={style} size={24} />
                <strong>{category}</strong>
              </div>
            )}
            {appearance && (
              <>
                <div className="settings-label" id="category-color-label">
                  颜色
                </div>
                <div className="color-options" role="group" aria-labelledby="category-color-label">
                  {categoryColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${color}`}
                      aria-label={colorLabels[color]}
                      aria-pressed={style.color === color}
                      onClick={() => {
                        setCustomStyle(true);
                        setStyle({ ...style, color });
                      }}
                    >
                      {style.color === color && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <div className="settings-label" id="category-icon-label">
                  图标
                </div>
                <div className="icon-options" role="group" aria-labelledby="category-icon-label">
                  {Object.keys(categoryIcons).map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className="icon-option"
                      aria-label={iconLabels[icon]}
                      aria-pressed={style.icon === icon}
                      onClick={() => {
                        setCustomStyle(true);
                        setStyle({ ...style, icon });
                      }}
                    >
                      <CategoryIcon style={{ ...style, icon }} size={22} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {dialog.kind === 'category' && (
              <p className="creation-path">
                创建位置：{state.settings.workspace}
                {window.workspaceAPI.platform === 'win32' ? '\\' : '/'}
                {name.trim() || '分类名称'}
                {window.workspaceAPI.platform === 'win32' ? '\\Projects' : '/Projects'}
              </p>
            )}
            {dialog.kind === 'project' && (
              <p className="creation-path">
                {selectedPath
                  ? `创建位置：${selectedPath}`
                  : '沿用分类中的 Projects 收纳目录；没有收纳目录时，直接创建在分类下。'}
              </p>
            )}
          </fieldset>
          <div className="management-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={
                saving ||
                (dialog.kind !== 'appearance' && !name.trim()) ||
                (dialog.kind === 'project' && !category)
              }
            >
              {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}{' '}
              {saving
                ? '正在保存'
                : dialog.kind === 'appearance'
                  ? '保存外观'
                  : dialog.kind === 'category'
                    ? '创建分类'
                    : '创建项目'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
