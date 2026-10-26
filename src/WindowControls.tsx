import { useEffect, useState } from 'react';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';

const api = window.workspaceAPI;

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (api.platform !== 'win32') return;
    let active = true;
    const update = (state: { maximized: boolean }) => {
      if (active) setMaximized(state.maximized);
    };
    const unsubscribe = api.onWindowStateChanged(update);
    void api.getWindowState().then(update);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (api.platform !== 'win32') return null;

  return (
    <div className="window-controls" role="group" aria-label="窗口控制">
      <button
        className="window-control window-close"
        aria-label="关闭窗口"
        title="关闭窗口"
        onClick={() => void api.controlWindow('close')}
      >
        <X size={9} strokeWidth={2.5} />
      </button>
      <button
        className="window-control window-minimize"
        aria-label="最小化窗口"
        title="最小化窗口"
        onClick={() => void api.controlWindow('minimize')}
      >
        <Minus size={9} strokeWidth={2.5} />
      </button>
      <button
        className="window-control window-maximize"
        aria-label={maximized ? '还原窗口' : '最大化窗口'}
        title={maximized ? '还原窗口' : '最大化窗口'}
        onClick={() => void api.controlWindow('maximize')}
      >
        {maximized ? (
          <Minimize2 size={8} strokeWidth={2.5} />
        ) : (
          <Maximize2 size={8} strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
