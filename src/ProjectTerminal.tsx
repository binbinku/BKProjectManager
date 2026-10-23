import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { TerminalEvent } from './types';
import '@xterm/xterm/css/xterm.css';
import { currentPaletteColors } from './palettes';

const api = window.workspaceAPI;

export function ProjectTerminal({ sessionId }: { sessionId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ restart(): void; clear(): void } | null>(null);
  const [status, setStatus] = useState('正在启动');
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
      const colors = currentPaletteColors();
      terminal.options.theme = dark
        ? {
            background: colors.canvas,
            foreground: colors.text,
            cursor: colors.text,
            selectionBackground: `${colors.focus}70`,
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
            background: colors.canvas,
            foreground: colors.text,
            cursor: colors.text,
            selectionBackground: `${colors.focus}60`,
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
      attributeFilter: ['data-theme', 'data-palette'],
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
          `\r\n\x1b[90m进程已退出，代码 ${event.exitCode}。通过系统菜单「终端 → 重新启动终端」继续。\x1b[0m`,
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
      }
    };
    controls.current = {
      restart: () => void start(),
      clear: () => {
        terminal.clear();
        terminal.focus();
      },
    };
    const unsubscribeMenu = api.onMenuAction((action) => {
      if (action === 'terminal-clear') controls.current?.clear();
      if (action === 'terminal-restart') controls.current?.restart();
    });
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
      unsubscribeMenu();
      input.dispose();
      if (terminalId) void api.stopTerminal(sessionId, terminalId).catch(() => {});
      terminal.dispose();
    };
  }, [sessionId]);

  return (
    <section className="terminal-panel" aria-label="项目终端">
      {error && (
        <div className="terminal-error" role="alert">
          {error}
        </div>
      )}
      <div className="terminal-host" data-running={running} data-status={status}>
        <div className="terminal-surface" ref={host} />
      </div>
    </section>
  );
}
