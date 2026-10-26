import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Code2, FolderOpen } from 'lucide-react';
import type { FilePreview, Settings, WorkbenchSession } from './types';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import type { FileLeaveGuard } from './MarkdownFile';
import { ProjectTerminal } from './ProjectTerminal';
import { GitHubButton } from './GitHubButton';
import './workbench.css';

const api = window.workspaceAPI;
export default function ProjectWorkbench({
  session,
  opener,
  onExternal,
  onGitHub,
  busy,
  actionError,
  onDismissError,
}: {
  session: WorkbenchSession;
  opener: Pick<Settings, 'opener' | 'customEditor'>;
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
  const [preferredTreeWidth, setTreeWidth] = useState(320);
  const [preferredTerminalWidth, setTerminalWidth] = useState(390);
  const [layoutWidth, setLayoutWidth] = useState(window.innerWidth);
  const header = useRef<HTMLElement>(null);
  const projectName = useRef<HTMLSpanElement>(null);
  const treeManuallyResized = useRef(false);
  const [openerInfo, setOpenerInfo] = useState<{ name: string; icon: string | null } | null>(null);
  const minTreeWidth = api.platform === 'darwin' ? 220 : 160;
  // Reserve two 1px dividers, 260px for the viewer and 260px for the terminal.
  const maxTreeWidth = Math.max(minTreeWidth, layoutWidth - 522);
  const treeWidth = Math.max(minTreeWidth, Math.min(preferredTreeWidth, maxTreeWidth));
  const terminalWidth = Math.max(
    260,
    Math.min(preferredTerminalWidth, layoutWidth - treeWidth - 262),
  );
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
  useLayoutEffect(() => {
    if (!layout.current) return;
    setLayoutWidth(layout.current.clientWidth);
    const observer = new ResizeObserver(([entry]) => setLayoutWidth(entry.contentRect.width));
    observer.observe(layout.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const navigation = projectName.current?.parentElement;
    if (!header.current || !projectName.current || !navigation) return;
    let current = true;
    const measure = () => {
      if (!current || treeManuallyResized.current || !header.current || !projectName.current)
        return;
      const nameStyle = getComputedStyle(projectName.current);
      const headerStyle = getComputedStyle(header.current);
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return;
      context.font = `${nameStyle.fontStyle} ${nameStyle.fontWeight} ${nameStyle.fontSize} ${nameStyle.fontFamily}`;
      const textWidth = context.measureText(session.project.name).width;
      const buttons = [...navigation.querySelectorAll(':scope > button')];
      const buttonWidth = buttons.reduce(
        (total, button) => total + button.getBoundingClientRect().width,
        0,
      );
      const gap = parseFloat(getComputedStyle(navigation).columnGap) || 0;
      const padding = parseFloat(headerStyle.paddingLeft) + parseFloat(headerStyle.paddingRight);
      setTreeWidth(
        Math.max(320, Math.ceil(textWidth + padding + buttonWidth + gap * buttons.length + 4)),
      );
    };
    measure();
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(navigation);
    return () => {
      current = false;
      observer.disconnect();
    };
  }, [session.project.name, session.project.githubRemotes.length]);
  const request = useRef(0);
  const fileViewer = useRef<FileLeaveGuard>(null);
  const switchingFile = useRef(false);
  const drag = useRef<{ side: 'tree' | 'terminal'; startX: number; width: number } | null>(null);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function read(path: string) {
    if (switchingFile.current) return;
    switchingFile.current = true;
    const leave = await fileViewer.current?.beforeLeave();
    if (leave === false) {
      switchingFile.current = false;
      return;
    }
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
      switchingFile.current = false;
    }
  }
  useEffect(
    () =>
      api.onWorkbenchCloseRequested(() => {
        void (async () => {
          const approved = (await fileViewer.current?.beforeLeave()) ?? true;
          await api.resolveWorkbenchClose(session.id, approved);
        })().catch(() => {
          void api.resolveWorkbenchClose(session.id, false);
        });
      }),
    [session.id],
  );
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
    if (side === 'tree') {
      treeManuallyResized.current = true;
      setTreeWidth(Math.max(minTreeWidth, Math.min(value, maxTreeWidth)));
    } else setTerminalWidth(Math.max(260, Math.min(value, layoutWidth - treeWidth - 262)));
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
          side === 'tree' ? maxTreeWidth : Math.max(260, layoutWidth - treeWidth - 262)
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
          <header ref={header} className="workbench-navigation-header">
            <div className="workbench-navigation">
              <span
                ref={projectName}
                className="workbench-project-name"
                title={session.project.path}
              >
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
          ref={fileViewer}
          sessionId={session.id}
          selected={selected}
          preview={preview}
          loading={loading}
          error={error}
          onNavigate={(path) => void read(path)}
          onSaved={setPreview}
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
