import { lazy, Suspense, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import type { FilePreview } from './types';
import { MarkdownPreview } from './MarkdownPreview';
const MarkdownEditor = lazy(() =>
  import('./MarkdownEditor').then((module) => ({ default: module.MarkdownEditor })),
);

const api = window.workspaceAPI;
type TextFile = Extract<FilePreview, { kind: 'text' }>;
const normalize = (content: string) => content.replace(/\r\n|\r/g, '\n');
export interface FileLeaveGuard {
  beforeLeave(): Promise<boolean>;
}

export function MarkdownFile({
  preview,
  sessionId,
  onNavigate,
  onSaved,
  ref,
}: {
  preview: TextFile;
  sessionId: string;
  onNavigate(path: string): void;
  onSaved(preview: FilePreview): void;
  ref: Ref<FileLeaveGuard>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => normalize(preview.content));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const original = useRef(preview);
  const baseline = useRef(normalize(preview.content));
  const draftRef = useRef(draft);
  const saveJob = useRef<Promise<boolean> | null>(null);
  const leaveJob = useRef<Promise<boolean> | null>(null);
  const dirty = draft !== baseline.current;

  function change(value: string) {
    draftRef.current = value;
    setDraft(value);
    void api.setMarkdownDirty(sessionId, value !== baseline.current).catch(() => {});
  }
  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (draftRef.current !== baseline.current || saveJob.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => {
      window.removeEventListener('beforeunload', preventUnload);
      void api.setMarkdownDirty(sessionId, false).catch(() => {});
    };
  }, [sessionId]);

  function save(): Promise<boolean> {
    if (saveJob.current) return saveJob.current;
    if (draftRef.current === baseline.current) {
      setEditing(false);
      return Promise.resolve(true);
    }
    const job = (async () => {
      setSaving(true);
      setError('');
      try {
        const result = await api.saveMarkdown(
          sessionId,
          preview.path,
          draftRef.current,
          original.current.revision,
        );
        if (result.kind !== 'text') throw new Error('保存后无法读取文件，请重新打开检查。');
        original.current = result;
        baseline.current = normalize(result.content);
        draftRef.current = baseline.current;
        setDraft(baseline.current);
        onSaved(result);
        await api.setMarkdownDirty(sessionId, false);
        setEditing(false);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '保存失败，请保留当前修改后重试。');
        return false;
      } finally {
        setSaving(false);
        saveJob.current = null;
      }
    })();
    saveJob.current = job;
    return job;
  }

  function beforeLeave(): Promise<boolean> {
    if (leaveJob.current) return leaveJob.current;
    const job = (async () => {
      if (saveJob.current && !(await saveJob.current)) return false;
      if (draftRef.current === baseline.current) return true;
      try {
        const choice = await api.confirmMarkdownChanges(sessionId, preview.path);
        if (choice === 'cancel') return false;
        if (choice === 'save') return save();
        draftRef.current = baseline.current;
        setDraft(baseline.current);
        setEditing(false);
        await api.setMarkdownDirty(sessionId, false);
        setError('');
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '无法处理未保存的修改');
        return false;
      }
    })();
    leaveJob.current = job;
    void job.finally(() => {
      leaveJob.current = null;
    });
    return job;
  }
  useImperativeHandle(ref, () => ({ beforeLeave }));

  return (
    <div className={`markdown-surface${editing ? ' is-editing' : ''}`}>
      {editing ? (
        <Suspense
          fallback={
            <div className="viewer-empty">
              <Loader2 className="spin" size={24} />
            </div>
          }
        >
          <MarkdownEditor
            value={draft}
            readOnly={saving}
            onChange={change}
            onSave={() => void save()}
          />
        </Suspense>
      ) : (
        <MarkdownPreview
          content={draft}
          path={preview.path}
          sessionId={sessionId}
          onNavigate={onNavigate}
          onError={setError}
        />
      )}
      {error && (
        <div className="markdown-notice" role="alert">
          <span>{error}</span>
          <button aria-label="关闭 Markdown 提示" onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="markdown-tools" role="group" aria-label="Markdown 文档操作">
        {editing ? (
          <>
            <span className="markdown-edit-status" aria-live="polite">
              {saving ? '保存中' : dirty ? '未保存' : '编辑中'}
            </span>
            <button
              aria-label="取消编辑"
              title="退出编辑"
              disabled={saving}
              onClick={() => {
                void beforeLeave().then((leave) => {
                  if (leave) setEditing(false);
                });
              }}
            >
              <X size={15} />
            </button>
            <button
              className="markdown-save"
              disabled={saving}
              title={api.platform === 'darwin' ? '保存并预览（⌘S）' : '保存并预览（Ctrl+S）'}
              onClick={() => void save()}
            >
              {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
              <span>保存</span>
            </button>
          </>
        ) : (
          <button
            aria-label="编辑 Markdown"
            title="编辑 Markdown"
            onClick={() => {
              setError('');
              setEditing(true);
            }}
          >
            <Pencil size={14} />
            <span>编辑</span>
          </button>
        )}
      </div>
      {saving && <div className="markdown-saving-mask" aria-hidden="true" />}
    </div>
  );
}
