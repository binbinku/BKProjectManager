import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Circle, Eraser, RefreshCw, SquareTerminal } from 'lucide-react';
import type { TerminalEvent } from './types';
import '@xterm/xterm/css/xterm.css';

const api = window.workspaceAPI;

export function ProjectTerminal({ sessionId }: { sessionId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ restart(): void; clear(): void } | null>(null);
  const [status, setStatus] = useState('正在启动');
  const [shell, setShell] = useState('终端');
  const [starting, setStarting] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let terminalId: string | null = null;
    let starting = false;
    let frame = 0;
    let earlyEvents: TerminalEvent[] = [];
    let inputQueue = Promise.resolve();
    const terminal = new Terminal({
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: false,
      screenReaderMode: true,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host.current);
    // Project output is text/ANSI only; do not register terminal hyperlinks,
    // clipboard escape handlers or commands that can interact with the host.
    const applyTheme = () => {
      const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
      terminal.options.theme = dark
        ? {
            background: '#191919',
            foreground: '#deded9',
            cursor: '#d8e5d6',
            selectionBackground: '#5d735b70',
            black: '#303030',
            red: '#dc9290',
            green: '#a1bd97',
            yellow: '#d6bb86',
            blue: '#96b5d5',
            magenta: '#c6a4cb',
            cyan: '#8fbfc0',
            white: '#ddddda',
            brightBlack: '#92928b',
          }
        : {
            background: '#ffffff',
            foreground: '#333330',
            cursor: '#394e36',
            selectionBackground: '#a5b99c60',
            black: '#303030',
            red: '#a74440',
            green: '#4a7441',
            yellow: '#8e6d24',
            blue: '#426e9d',
            magenta: '#88618f',
            cyan: '#357c7e',
            white: '#b8b8b1',
            brightBlack: '#777770',
          };
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const fitTerminal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed || !host.current?.clientWidth || !host.current.clientHeight) return;
        fit.fit();
        if (terminalId)
          void api
            .resizeTerminal(sessionId, terminalId, terminal.cols, terminal.rows)
            .catch(() => {});
      });
    };
    const resizeObserver = new ResizeObserver(fitTerminal);
    resizeObserver.observe(host.current);

    const handleEvent = (event: TerminalEvent) => {
      if (disposed || event.sessionId !== sessionId) return;
      if (!terminalId) {
        if (starting) earlyEvents.push(event);
        return;
      }
      if (event.terminalId !== terminalId) return;
      if (event.type === 'data') {
        terminal.write(event.data, () => {
          if (!disposed)
            void api
              .acknowledgeTerminal(sessionId, event.terminalId, event.data.length)
              .catch(() => {});
        });
      } else {
        terminalId = null;
        terminal.writeln(
          `\r\n\x1b[90m进程已退出，代码 ${event.exitCode}。点击右上角重新启动。\x1b[0m`,
        );
        setRunning(false);
        setStatus(`已退出 · ${event.exitCode}`);
      }
    };
    const unsubscribe = api.onTerminalEvent(handleEvent);
    const input = terminal.onData((data) => {
      const id = terminalId;
      if (!id) return;
      // Large pastes are sent in bounded chunks in their original order.
      inputQueue = inputQueue
        .then(async () => {
          if (disposed || terminalId !== id) return;
          for (let index = 0; index < data.length;) {
            let end = Math.min(index + 32 * 1024, data.length);
            // Preserve surrogate pairs at chunk boundaries when pasting emoji.
            if (end < data.length && /[\uD800-\uDBFF]/.test(data[end - 1])) end--;
            await api.writeTerminal(sessionId, id, data.slice(index, end));
            index = end;
          }
        })
        .catch((reason) => {
          if (!disposed && terminalId === id) setError(String(reason));
        });
    });

    const start = async () => {
      if (starting || disposed) return;
      starting = true;
      setStarting(true);
      setError('');
      setStatus('正在启动');
      setRunning(false);
      const previous = terminalId;
      terminalId = null;
      earlyEvents = [];
      try {
        if (previous) await api.stopTerminal(sessionId, previous);
        if (disposed) return;
        terminal.reset();
        fit.fit();
        const result = await api.startTerminal(sessionId, terminal.cols, terminal.rows);
        if (disposed) {
          await api.stopTerminal(sessionId, result.id).catch(() => {});
          return;
        }
        terminalId = result.id;
        setShell(result.shell);
        setRunning(true);
        setStatus('运行中');
        for (const event of earlyEvents) handleEvent(event);
        earlyEvents = [];
        fitTerminal();
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : '终端启动失败');
          setStatus('启动失败');
        }
      } finally {
        starting = false;
        if (!disposed) setStarting(false);
      }
    };
    controls.current = {
      restart: () => void start(),
      clear: () => {
        terminal.clear();
        terminal.focus();
      },
    };
    // Wait until React has committed this mount. StrictMode's disposable first
    // mount must never leave a shell competing with the active component.
    const startup = setTimeout(() => void start(), 0);
    return () => {
      disposed = true;
      clearTimeout(startup);
      controls.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      unsubscribe();
      input.dispose();
      if (terminalId) void api.stopTerminal(sessionId, terminalId).catch(() => {});
      terminal.dispose();
    };
  }, [sessionId]);

  return (
    <section className="terminal-panel" aria-label="项目终端">
      <div className="panel-heading">
        <span>
          <SquareTerminal size={15} />
          终端 <small>{shell}</small>
        </span>
        <div className="panel-actions">
          <button
            aria-label="清空终端"
            title="清空终端显示"
            onClick={() => controls.current?.clear()}
          >
            <Eraser size={14} />
          </button>
          <button
            aria-label="重新启动终端"
            title="结束当前进程并重新启动终端"
            disabled={starting}
            onClick={() => controls.current?.restart()}
          >
            <RefreshCw size={14} className={starting ? 'spin' : ''} />
          </button>
        </div>
      </div>
      <div className="terminal-location">
        PROJECT SHELL{' '}
        <span>
          <Circle size={6} fill="currentColor" />
          {status}
        </span>
      </div>
      {error && (
        <div className="terminal-error" role="alert">
          {error}
        </div>
      )}
      <div className="terminal-host" ref={host} data-running={running} />
      <div className="terminal-hint">
        点击终端输入命令 <span>Ctrl C 中断 · exit 退出</span>
      </div>
    </section>
  );
}
