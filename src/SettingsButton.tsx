import { Settings } from 'lucide-react';

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="sidebar-settings"
      aria-label="设置"
      title="设置"
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <Settings size={17} strokeWidth={1.7} />
    </button>
  );
}
