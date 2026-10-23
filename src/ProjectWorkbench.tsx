import { useRef, useState, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Files,
  FolderOpen,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import type { FilePreview, WorkbenchSession } from './types';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import { ProjectTerminal } from './ProjectTerminal';
import './workbench.css';

const api = window.workspaceAPI;
const logo = new URL('../docs/assets/logo.svg', import.meta.url).href;
export default function ProjectWorkbench({
  session,
  onSettings,
  onBack,
  onExternal,
  busy,
  actionError,
  onDismissError,
}: {
  session: WorkbenchSession;
  onSettings(): void;
  onBack(): void;
  onExternal(): void;
  busy: boolean;
  actionError: string;
  onDismissError(): void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [treeWidth, setTreeWidth] = useState(236);
  const [terminalWidth, setTerminalWidth] = useState(390);
  const [leaving, setLeaving] = useState(false);
  const [terminalTools, setTerminalTools] = useState<HTMLDivElement | null>(null);
  const layout = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const drag = useRef<{ side: 'tree' | 'terminal'; startX: number; width: number } | null>(null);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function read(path: string) {
    const sequence = ++request.current;
    setSelected(path);
    setPreview(null);
    setError('');
    setLoading(true);
    try {
      const result = await api.readProjectFile(session.id, path);
      if (sequence === request.current) setPreview(result);
    } catch (reason) {
      if (sequence === request.current)
        setError(reason instanceof Error ? reason.message : '文件读取失败');
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!layout.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setTerminalWidth((value) =>
        Math.max(260, Math.min(value, entry.contentRect.width - treeWidth - 268)),
      );
    });
    observer.observe(layout.current);
    return () => observer.disconnect();
  }, [treeWidth]);
  const refreshFiles = () => {
    setRefresh((value) => value + 1);
    if (selected) void read(selected);
  };
  const resize = (side: 'tree' | 'terminal', value: number) => {
    const total = layout.current?.clientWidth || window.innerWidth;
    if (side === 'tree')
      setTreeWidth(Math.max(160, Math.min(value, 420, total - terminalWidth - 268)));
    else setTerminalWidth(Math.max(260, Math.min(value, total - treeWidth - 268)));
  };
  function separator(side: 'tree' | 'terminal') {
    return (
      <div
        className="panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={side === 'tree' ? '调整文件目录宽度' : '调整终端宽度'}
        aria-valuemin={side === 'tree' ? 160 : 260}
        aria-valuemax={
          side === 'tree'
            ? 420
            : Math.max(260, (layout.current?.clientWidth || window.innerWidth) - treeWidth - 268)
        }
        aria-valuenow={side === 'tree' ? treeWidth : terminalWidth}
        tabIndex={0}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            side,
            startX: event.clientX,
            width: side === 'tree' ? treeWidth : terminalWidth,
          };
        }}
        onPointerMove={(event) => {
          const value = drag.current;
          if (value?.side === side && event.currentTarget.hasPointerCapture(event.pointerId))
            resize(side, value.width + (event.clientX - value.startX) * (side === 'tree' ? 1 : -1));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          resize(
            side,
            (side === 'tree' ? treeWidth : terminalWidth) +
              (event.key === 'ArrowRight' ? 16 : -16) * (side === 'tree' ? 1 : -1),
          );
        }}
      />
    );
  }

  return (
    <div className={`project-workbench platform-${api.platform}`}>
      {actionError && (
        <div className="workbench-action-error" role="alert">
          <span>{actionError}</span>
          <button onClick={onDismissError}>关闭</button>
        </div>
      )}
      <div
        className="workbench-layout"
        ref={layout}
        style={{
          gridTemplateColumns: `${treeWidth}px 4px minmax(260px, 1fr) 4px ${terminalWidth}px`,
        }}
      >
        <aside className="explorer-panel" aria-label="资源管理器">
          <header className="workbench-navigation-header">
            <div className="workbench-navigation">
              <button
                className="back-projects"
                aria-label="返回项目列表"
                title="返回项目列表并关闭当前终端"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  onBack();
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <img src={logo} width="21" height="21" alt="BK Project Manager" />
              <span className="workbench-project-name">{session.project.name}</span>
            </div>
          </header>
          <div className="panel-heading">
            <span>
              <Files size={15} />
              资源管理器
            </span>
            <button
              aria-label="刷新文件目录"
              title="重新读取文件目录和当前文件"
              onClick={refreshFiles}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="explorer-root" title={session.project.path}>
            <ChevronRight size={12} className="root-chevron" />
            <FolderOpen size={14} />
            <strong>{session.project.name}</strong>
          </div>
          <div className="explorer-scroll">
            <FileTree
              key={refresh}
              sessionId={session.id}
              selected={selected}
              onSelect={(path) => void read(path)}
            />
          </div>
          <div className="explorer-hint" title={selected || session.project.path}>
            <span>{selected || session.project.category}</span>
            <small>只读预览 · 本地文件</small>
          </div>
          <div className="workbench-terminal-tools" ref={setTerminalTools} />
          <div className="workbench-tools">
            <button className="external-open" aria-label="设置" onClick={onSettings} title="设置">
              <Settings2 size={14} />
              设置
            </button>
            <button
              className="external-open"
              onClick={onExternal}
              disabled={busy}
              title="使用设置中的默认打开方式"
            >
              <ArrowUpRight size={14} />
              外部打开
            </button>
          </div>
        </aside>
        {separator('tree')}
        <FileViewer
          selected={selected}
          preview={preview}
          loading={loading}
          error={error}
          onReload={() => {
            if (selected) void read(selected);
          }}
        />
        {separator('terminal')}
        <ProjectTerminal sessionId={session.id} controlsContainer={terminalTools} />
      </div>
    </div>
  );
}
