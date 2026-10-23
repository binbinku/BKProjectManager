import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  Folder,
  FolderOpen,
  Link2,
  Loader2,
} from 'lucide-react';
import type { DirectoryListing, FileEntry } from './types';

const api = window.workspaceAPI;
type Directory = { loading?: boolean; listing?: DirectoryListing; error?: string };

export function FileTree({
  sessionId,
  selected,
  onSelect,
}: {
  sessionId: string;
  selected: string | null;
  onSelect(path: string): void;
}) {
  const [directories, setDirectories] = useState<Record<string, Directory>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    setDirectories({ '': { loading: true } });
    void api.listProjectFiles(sessionId, '').then(
      (listing) => {
        if (active) setDirectories({ '': { listing } });
      },
      (error) => {
        if (active) setDirectories({ '': { error: String(error) } });
      },
    );
    return () => {
      active = false;
    };
  }, [sessionId]);

  async function toggle(entry: FileEntry) {
    const opening = !expanded.has(entry.path);
    setExpanded((old) => {
      const next = new Set(old);
      if (opening) next.add(entry.path);
      else next.delete(entry.path);
      return next;
    });
    if (!opening || directories[entry.path]?.listing || directories[entry.path]?.loading) return;
    setDirectories((old) => ({ ...old, [entry.path]: { loading: true } }));
    try {
      const listing = await api.listProjectFiles(sessionId, entry.path);
      setDirectories((old) => ({ ...old, [entry.path]: { listing } }));
    } catch (error) {
      setDirectories((old) => ({ ...old, [entry.path]: { error: String(error) } }));
    }
  }

  function renderDirectory(path: string, depth: number) {
    const directory = directories[path];
    if (directory?.loading)
      return (
        <li className="tree-message">
          <Loader2 size={13} className="spin" />
          正在读取…
        </li>
      );
    if (directory?.error)
      return (
        <li className="tree-message tree-error" role="alert">
          目录读取失败，点击刷新重试。
        </li>
      );
    if (!directory?.listing) return null;
    return (
      <>
        {directory.listing.entries.map((entry) => {
          const folder = entry.kind === 'directory';
          const open = expanded.has(entry.path);
          const disabled = entry.kind === 'link' || entry.kind === 'special';
          const Icon = folder
            ? open
              ? FolderOpen
              : Folder
            : entry.kind === 'link'
              ? Link2
              : /\.(tsx?|jsx?|json|py|rs|go|cs|java|css|html|vue|sh|ya?ml)$/i.test(entry.name)
                ? FileCode2
                : File;
          return (
            <li key={entry.path} role="none">
              <button
                role="treeitem"
                aria-level={depth + 1}
                aria-expanded={folder ? open : undefined}
                aria-selected={selected === entry.path}
                aria-label={`${folder ? (open ? '折叠' : '展开') : '查看'} ${entry.name}`}
                className={`file-tree-row ${selected === entry.path ? 'selected' : ''} ${folder ? 'directory' : ''}`}
                style={{ paddingLeft: 12 + depth * 16 }}
                disabled={disabled}
                title={disabled ? `${entry.path} · 不展开链接或特殊文件` : entry.path}
                data-file-path={entry.path}
                onClick={() => (folder ? void toggle(entry) : onSelect(entry.path))}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' && folder && !open) {
                    event.preventDefault();
                    void toggle(entry);
                  } else if (event.key === 'ArrowLeft' && folder && open) {
                    event.preventDefault();
                    void toggle(entry);
                  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    const rows = [
                      ...event.currentTarget
                        .closest('[role="tree"]')!
                        .querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
                    ];
                    rows[
                      rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)
                    ]?.focus();
                  }
                }}
              >
                <span className="tree-chevron">
                  {folder && (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                </span>
                <Icon size={15} strokeWidth={1.5} />
                <span>{entry.name}</span>
                {directories[entry.path]?.loading && <Loader2 size={12} className="spin" />}
              </button>
              {folder && open && <ul role="group">{renderDirectory(entry.path, depth + 1)}</ul>}
            </li>
          );
        })}
        {!directory.listing.entries.length && (
          <li className="tree-message" style={{ paddingLeft: 36 + depth * 16 }}>
            空文件夹
          </li>
        )}
        {directory.listing.truncated && <li className="tree-message">仅显示此目录前 1000 项。</li>}
      </>
    );
  }
  return (
    <ul className="file-tree" role="tree" aria-label="项目文件目录">
      {renderDirectory('', 0)}
    </ul>
  );
}
