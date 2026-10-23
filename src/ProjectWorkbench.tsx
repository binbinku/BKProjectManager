import { useRef, useState, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Code2, FolderOpen } from 'lucide-react';
import type { FilePreview, Settings, WorkbenchSession } from './types';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import { ProjectTerminal } from './ProjectTerminal';
import { GitHubButton } from './GitHubButton';
import { WindowControls } from './WindowControls';
import './workbench.css';

const api = window.workspaceAPI;
export default function ProjectWorkbench({
  session,
  opener,
  onBack,
  onExternal,
  onGitHub,
  busy,
  actionError,
  onDismissError,
}: {
  session: WorkbenchSession;
  opener: Pick<Settings, 'opener' | 'customEditor'>;
  onBack(): void;
  onExternal(): void;
  onGitHub(): void;
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
  const [openerInfo, setOpenerInfo] = useState<{ name: string; icon: string | null } | null>(null);
  const minTreeWidth = ['darwin', 'win32'].includes(api.platform) ? 220 : 160;
  useEffect(() => {
    let current = true;
    setOpenerInfo(null);
    void api
      .getOpenerInfo()
      .then((info) => {
        if (current) setOpenerInfo(info);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [opener.opener, opener.customEditor]);
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
        Math.max(260, Math.min(value, entry.contentRect.width - treeWidth - 262)),
      );
    });
    observer.observe(layout.current);
    return () => observer.disconnect();
  }, [treeWidth]);
  useEffect(
    () =>
      api.onMenuAction((action) => {
        if (action === 'refresh-files') {
          setRefresh((value) => value + 1);
          if (selected) void read(selected);
        }
      }),
    [selected, session.id],
  );
  const resize = (side: 'tree' | 'terminal', value: number) => {
    const total = layout.current?.clientWidth || window.innerWidth;
    if (side === 'tree')
      setTreeWidth(Math.max(minTreeWidth, Math.min(value, 420, total - terminalWidth - 262)));
    else setTerminalWidth(Math.max(260, Math.min(value, total - treeWidth - 262)));
  };
  function separator(side: 'tree' | 'terminal') {
    return (
      <div
        className="panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={side === 'tree' ? '调整文件目录宽度' : '调整终端宽度'}
        aria-valuemin={side === 'tree' ? minTreeWidth : 260}
        aria-valuemax={
          side === 'tree'
            ? 420
            : Math.max(260, (layout.current?.clientWidth || window.innerWidth) - treeWidth - 262)
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
          gridTemplateColumns: `${treeWidth}px 1px minmax(260px, 1fr) 1px ${terminalWidth}px`,
        }}
      >
        <aside className="explorer-panel" aria-label="资源管理器">
          <header className="workbench-navigation-header">
            <WindowControls />
            <div className="workbench-navigation">
              <button
                className="back-projects"
                aria-label="返回项目列表"
                title="显示项目列表，项目保持运行"
                onClick={onBack}
              >
                <ArrowLeft size={16} />
              </button>
              <span className="workbench-project-name" title={session.project.path}>
                {session.project.name}
              </span>
              <GitHubButton project={session.project} busy={busy} onOpen={onGitHub} workbench />
              <button
                className="external-open"
                aria-label={openerInfo ? `在 ${openerInfo.name} 中打开` : '外部打开'}
                title={openerInfo ? `在 ${openerInfo.name} 中打开` : '外部打开'}
                onClick={onExternal}
                disabled={busy}
              >
                {openerInfo?.icon ? (
                  <img src={openerInfo.icon} width="20" height="20" alt="" />
                ) : opener.opener === 'folder' ? (
                  <FolderOpen size={18} />
                ) : (
                  <Code2 size={18} />
                )}
              </button>
            </div>
          </header>
          <div className="explorer-scroll">
            <FileTree
              key={refresh}
              sessionId={session.id}
              selected={selected}
              onSelect={(path) => void read(path)}
            />
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
        <ProjectTerminal sessionId={session.id} />
      </div>
    </div>
  );
}
