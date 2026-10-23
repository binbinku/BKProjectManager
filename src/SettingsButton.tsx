import { Settings } from 'lucide-react';

export function SettingsButton({
  onClick,
  floating = false,
}: {
  onClick?: () => void;
  floating?: boolean;
}) {
  return (
    <button
      className={`sidebar-settings${floating ? ' sidebar-settings-floating' : ''}`}
      aria-label="设置"
      title="设置"
      aria-haspopup="dialog"
      onClick={onClick ?? (() => void window.workspaceAPI.showSettings())}
    >
      <Settings size={floating ? 20 : 17} strokeWidth={1.7} />
    </button>
  );
}
