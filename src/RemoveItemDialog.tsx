import { useRef, useState } from 'react';
import { ArrowUpRight, EyeOff, FolderOpen, Loader2, X } from 'lucide-react';
import type { AppState } from './types';
import { useModalFocus } from './useModalFocus';

export interface RemovalTarget {
  kind: 'category' | 'project';
  key: string;
  name: string;
  path: string;
  count?: number;
}
export function RemoveItemDialog({
  target,
  onClose,
  onRemoved,
}: {
  target: RemovalTarget;
  onClose: () => void;
  onRemoved: (next: AppState, revealed: boolean) => void;
}) {
  const [busy, setBusy] = useState<'remove' | 'reveal' | null>(null);
  const [error, setError] = useState('');
  const working = useRef(false);
  const modalRef = useModalFocus(onClose, !!busy);
  const folderName = window.workspaceAPI.platform === 'darwin' ? 'Finder' : '资源管理器';
  async function act(action: 'remove' | 'reveal') {
    if (working.current) return;
    working.current = true;
    setBusy(action);
    setError('');
    try {
      if (action === 'remove')
        onRemoved(await window.workspaceAPI.removeItem(target.kind, target.key), false);
      else {
        onRemoved(await window.workspaceAPI.revealItem(target.kind, target.key), true);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : '操作失败，请重试',
      );
    } finally {
      working.current = false;
      setBusy(null);
    }
  }
  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <section
        ref={modalRef}
        className="settings-modal management-modal remove-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-title"
        aria-describedby="remove-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <span className="modal-kicker">管理{target.kind === 'category' ? '分类' : '项目'}</span>
          <button aria-label="关闭移除对话框" disabled={!!busy} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <h2 id="remove-title">如何处理“{target.name}”？</h2>
        <p className="settings-description" id="remove-description">
          两种方式都会从软件列表中隐藏；如需删除文件，可在{folderName}中自行操作。
        </p>
        <div className="removal-path">
          <FolderOpen size={17} />
          <span>{target.path}</span>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <button className="removal-choice" disabled={!!busy} onClick={() => void act('remove')}>
          <span className="removal-choice-icon">
            {busy === 'remove' ? <Loader2 className="spin" size={21} /> : <EyeOff size={21} />}
          </span>
          <span>
            <strong>从列表移除</strong>
            <small>
              {target.kind === 'category'
                ? `隐藏这个分类及其 ${target.count ?? 0} 个可见项目。`
                : '仅在软件中隐藏这个项目。'}
              文件保留，可在设置中恢复。
            </small>
          </span>
        </button>
        <button className="removal-choice" disabled={!!busy} onClick={() => void act('reveal')}>
          <span className="removal-choice-icon">
            {busy === 'reveal' ? <Loader2 className="spin" size={21} /> : <FolderOpen size={21} />}
          </span>
          <span>
            <strong>在{folderName}中显示，手动删除</strong>
            <small>先从列表隐藏，再定位并选中文件夹，由你自行删除。可在设置中恢复显示。</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
        <div className="management-actions">
          <button className="secondary-button" disabled={!!busy} onClick={onClose}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
