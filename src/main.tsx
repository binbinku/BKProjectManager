import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  Check,
  Clock3,
  Trash2,
  Folder,
  FolderOpen,
  GitBranch,
  Grid2X2,
  Layers3,
  Loader2,
  Plus,
  Star,
  Terminal,
  X,
} from 'lucide-react';
import type { AppState, Project, ThemePreference, WorkbenchSession } from './types';
import { ThemeSelector } from './ThemeSelector';
import { GlassTransparency } from './GlassTransparency';
import { PaletteSelector } from './PaletteSelector';
import { GitHubButton } from './GitHubButton';
import { applyPalette } from './palettes';
import { ProjectTools } from './ProjectTools';
import { CategoryIcon, defaultCategoryStyle } from './categories';
import { ProjectManagerDialog, type ManagementDialog } from './ProjectManagerDialog';
import { RemoveItemDialog, type RemovalTarget } from './RemoveItemDialog';
import './styles.css';
import { version as appVersion } from '../package.json';

const logo = new URL('../docs/assets/logo.svg', import.meta.url).href;
const vscodeIcon = new URL('./material-icon-theme/vscode.svg', document.baseURI).href;
const ProjectWorkbench = lazy(() => import('./ProjectWorkbench'));
const api = window.workspaceAPI;
const projectWindow = window.location.hash === '#project';
const typeColors: Record<string, string> = {
  Unity: 'purple',
  Unreal: 'purple',
  Android: 'green',
  Flutter: 'blue',
  JavaScript: 'orange',
  Rust: 'orange',
  Go: 'teal',
  Python: 'blue',
  '.NET': 'purple',
  Java: 'pink',
  Folder: 'gray',
};
function relativeTime(time: number) {
  const days = Math.floor((Date.now() - time) / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  return new Date(time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState('all');
  const [sort, setSort] = useState('name');
  const [recentSort, setRecentSort] = useState('opened');
  const [view, setView] = useState('grid');
  const [settings, setSettings] = useState(false);
  const [glassPreview, setGlassPreview] = useState<number | null>(null);
  const [managementDialog, setManagementDialog] = useState<ManagementDialog | null>(null);
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null);
  const [session, setSession] = useState<WorkbenchSession | null>(null);
  const theme = state?.settings.theme ?? 'system';
  const glassMode = state?.settings.glassMode ?? 'full';
  const nativeGlass = state?.nativeGlass ?? false;
  const glassTransparency = state?.settings.glassTransparency ?? 60;
  const palette = state?.settings.palette ?? 'default';
  async function perform(task: () => Promise<AppState>, success?: string) {
    setBusy(true);
    setError('');
    try {
      setState(await task());
      if (success) setMessage(success);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : '操作失败，请重试',
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const unsubscribeState = api.onStateChanged(setState);
    const unsubscribeMenu = api.onMenuAction((action) => {
      if (action === 'settings' && !document.querySelector('.management-modal')) setSettings(true);
    });
    void (async () => {
      try {
        const [initial, currentSession] = await Promise.all([
          api.getState(),
          api.getCurrentWorkbench(),
        ]);
        setState(initial);
        setSession(currentSession);
        if (!projectWindow && initial.settings.workspace) setState(await api.scan());
      } catch (e) {
        setError(e instanceof Error ? e.message : '工作空间读取失败');
      } finally {
        setBusy(false);
      }
    })();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettings(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      unsubscribeMenu();
      unsubscribeState();
      document.removeEventListener('keydown', handleKey);
    };
  }, []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useLayoutEffect(() => {
    document.documentElement.dataset.glass = glassMode;
    document.documentElement.dataset.nativeGlass = String(nativeGlass);
  }, [glassMode, nativeGlass]);
  useEffect(() => {
    if (!settings) setGlassPreview(null);
  }, [settings]);
  useLayoutEffect(() => {
    const transparency = glassPreview ?? glassTransparency;
    document.documentElement.style.setProperty('--glass-tint', `${100 - transparency}%`);
    document.documentElement.style.setProperty(
      '--glass-content-tint',
      `${(1000 - transparency * 6) / 10}%`,
    );
  }, [glassPreview, glassTransparency]);
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.add('theme-changing');
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      applyPalette(document.documentElement, palette);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() =>
          document.documentElement.classList.remove('theme-changing'),
        );
      });
    };
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('theme-changing');
    };
  }, [theme, palette]);
  useEffect(() => {
    if (!settings) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('.settings-modal');
    modal?.querySelector<HTMLElement>('button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modal) return;
      const elements = [
        ...modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select:not(:disabled), input:not(:disabled):not([type="radio"]), input[type="radio"]:checked:not(:disabled)',
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [settings]);
  const projects = state?.snapshot?.projects ?? [];
  const categories = state?.snapshot?.categories ?? [];
  const categoryStyle = (name: string) => {
    const styles = state?.settings.categoryStyles?.[state.settings.workspace ?? ''];
    return styles && Object.hasOwn(styles, name) ? styles[name] : defaultCategoryStyle(name);
  };
  const selectedCategory = selection.startsWith('category:') ? selection.slice(9) : undefined;
  const addProject = () =>
    setManagementDialog(
      categories.some((item) => state?.snapshot?.projectContainers[item])
        ? {
            kind: 'project',
            category:
              selectedCategory && state?.snapshot?.projectContainers[selectedCategory]
                ? selectedCategory
                : undefined,
          }
        : { kind: 'category' },
    );
  const favorites = state?.settings.favorites ?? [];
  const recent = state?.settings.recent ?? {};
  const removed = state?.settings.visibility[state.settings.workspace ?? ''] ?? {
    categories: [],
    projects: [],
  };
  const removedCount = removed.categories.length + removed.projects.length;
  const favoriteCount = projects.filter((p) => favorites.includes(p.id)).length;
  const recentCount = projects.filter((p) => recent[p.id]).length;
  const activeSort = selection === 'recent' ? recentSort : sort;
  const filtered = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            selection === 'all' ||
            (selection === 'favorites'
              ? favorites.includes(project.id)
              : selection === 'recent'
                ? !!recent[project.id]
                : project.category === selection.slice(9)),
        )
        .sort((a, b) =>
          activeSort === 'opened'
            ? (recent[b.id] || 0) - (recent[a.id] || 0)
            : activeSort === 'modified'
              ? b.modifiedAt - a.modifiedAt
              : a.name.localeCompare(b.name, 'zh-CN', { numeric: true }),
        ),
    [projects, selection, activeSort, favorites, recent],
  );
  const title =
    selection === 'all'
      ? '全部项目'
      : selection === 'favorites'
        ? '我的收藏'
        : selection === 'recent'
          ? '最近打开'
          : selection.slice(9);
  const choose = () =>
    perform(async () => {
      const next = await api.chooseWorkspace();
      return next;
    });
  const changeAppearance = async (task: () => Promise<AppState>) => {
    const focused = document.activeElement as HTMLElement | null;
    await perform(task);
    requestAnimationFrame(() => {
      if (
        focused?.isConnected &&
        document.querySelector('.settings-modal')?.contains(focused) &&
        (document.activeElement === document.body || document.activeElement === focused)
      )
        focused.focus();
    });
  };
  const changeTheme = (value: ThemePreference) => changeAppearance(() => api.setTheme(value));
  const open = (
    project: Project,
    action: 'default' | 'folder' | 'terminal' | 'vscode' = 'default',
  ) => perform(() => api.openProject(project.id, action), `已打开 ${project.name}`);
  async function enterProject(project: Project) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.openWorkbench(project.id);
      setState(result.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目打开失败');
    } finally {
      setBusy(false);
    }
  }
  const platform = api?.platform;
  const folderName = platform === 'darwin' ? 'Finder' : '资源管理器';
  const openerLabels: Record<string, string> = {
    folder: folderName,
    vscode: 'VS Code',
    cursor: 'Cursor',
    custom: '自定义编辑器',
  };
  const select = (value: string) => {
    setSelection(value);
  };

  const settingsDialog = settings && (
    <div className="modal-backdrop" onClick={() => setSettings(false)}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <span className="modal-kicker">偏好设置</span>
          <button aria-label="关闭设置" onClick={() => setSettings(false)}>
            <X size={20} />
          </button>
        </div>
        <h2 id="settings-title">设置</h2>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <p className="settings-description">管理外观、工作空间和默认编辑器。</p>
        <h3 className="settings-label">外观</h3>
        <ThemeSelector value={theme} onChange={changeTheme} disabled={busy} />
        <p className="theme-help">立即生效并自动保存。跟随系统会使用系统的外观设置。</p>
        <h3 className="settings-label">毛玻璃效果</h3>
        <div className="glass-selector" role="radiogroup" aria-label="毛玻璃效果">
          {(
            [
              { value: 'off', label: '关闭', detail: '关闭全部效果' },
              { value: 'medium', label: '中等', detail: '仅顶栏与工具栏' },
              { value: 'full', label: '完整', detail: '所有区域按比例开启' },
            ] as const
          ).map(({ value, label, detail }) => (
            <label key={value} className={`glass-option ${glassMode === value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="settings-glass"
                value={value}
                aria-label={label}
                checked={glassMode === value}
                disabled={busy}
                onChange={() => void changeAppearance(() => api.setGlassMode(value))}
              />
              <span>
                {label}
                {glassMode === value && <Check size={13} />}
              </span>
              <small>{detail}</small>
            </label>
          ))}
        </div>
        <p className="theme-help">
          完整模式按区域比例应用透明度；中等仅保留工具栏效果，关闭则全部恢复实色。
        </p>
        <GlassTransparency
          value={glassTransparency}
          disabled={busy || glassMode === 'off'}
          onPreview={setGlassPreview}
          onSave={async (value) => {
            try {
              setState(await api.setGlassTransparency(value));
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '透明度保存失败');
              throw reason;
            }
          }}
        />
        <p className="theme-help" id="glass-transparency-help">
          越往右越通透，松开后保存。完整模式下，侧栏与终端 {glassPreview ?? glassTransparency}%，
          项目区与代码区 {((glassPreview ?? glassTransparency) * 6) / 10}%。
        </p>
        <h3 className="settings-label">配色主题</h3>
        <PaletteSelector
          value={palette}
          onChange={(value) => void changeAppearance(() => api.setPalette(value))}
          disabled={busy}
        />
        <p className="theme-help">七款内置配色，搭配任意亮暗模式。切换仅改变颜色，布局保持一致。</p>
        <label className="settings-label">工作空间目录</label>
        <div className="settings-path">{state?.settings.workspace || '尚未选择工作空间'}</div>
        <button className="secondary-button" disabled={busy} onClick={choose}>
          <FolderOpen size={15} />
          {state?.settings.workspace ? '更换工作空间' : '选择工作空间'}
        </button>
        <div className="settings-rule">
          <Layers3 size={17} />
          <p>
            一级目录作为分类；优先扫描分类中的
            Projects，否则扫描分类的直接子目录。已识别的工程作为一个项目收纳。
          </p>
        </div>
        <label className="settings-label" htmlFor="default-opener">
          默认打开方式
        </label>
        <select
          id="default-opener"
          className="settings-select"
          value={state?.settings.opener || 'folder'}
          disabled={busy}
          onChange={(e) => perform(() => api.setOpener(e.target.value))}
        >
          {Object.entries(openerLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="text-button choose-editor"
          disabled={busy}
          onClick={() => perform(api.chooseEditor)}
        >
          <Plus size={14} />
          选择编辑器程序
        </button>
        {state?.settings.customEditor && (
          <p className="editor-path">{state.settings.customEditor}</p>
        )}
        {state?.settings.workspace && (
          <section className="removed-settings" aria-label="已移除的内容">
            <div className="removed-heading">
              <h3 className="settings-label">
                已移除的内容 <small>{removedCount}</small>
              </h3>
              {removedCount > 0 && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => perform(() => api.restoreItem('all'), '已恢复所有可用分类和项目')}
                >
                  全部恢复
                </button>
              )}
            </div>
            <p className="theme-help">
              仅对当前工作空间隐藏，重新扫描也会保留。恢复不会创建或修改文件。
            </p>
            {removedCount > 0 ? (
              <div className="removed-list">
                {removed.categories.map((category) => (
                  <div className="removed-item" key={`category:${category}`}>
                    <CategoryIcon style={categoryStyle(category)} />
                    <div>
                      <strong>{category}</strong>
                      <small>分类及其项目</small>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      aria-label={`恢复分类 ${category}`}
                      onClick={() =>
                        perform(() => api.restoreItem('category', category), '分类已恢复')
                      }
                    >
                      恢复
                    </button>
                  </div>
                ))}
                {removed.projects.map((relativePath) => {
                  const parts = relativePath.split(platform === 'win32' ? '\\' : '/');
                  const parentHidden = removed.categories.includes(parts[0]);
                  return (
                    <div className="removed-item" key={`project:${relativePath}`}>
                      <Folder size={17} />
                      <div>
                        <strong>{parts.at(-1)}</strong>
                        <small title={relativePath}>
                          {relativePath}
                          {parentHidden ? ' · 请先恢复所属分类' : ''}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        disabled={busy || parentHidden}
                        aria-label={`恢复项目 ${relativePath}`}
                        title={parentHidden ? '请先恢复所属分类' : '恢复到项目列表'}
                        onClick={() =>
                          perform(() => api.restoreItem('project', relativePath), '项目已恢复')
                        }
                      >
                        {parentHidden ? '先恢复分类' : '恢复'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="removed-empty">没有已移除的分类或项目。</p>
            )}
          </section>
        )}
        <div className="settings-bottom">
          <span>BK Project Manager · {appVersion}</span>
          <button className="primary-button" onClick={() => setSettings(false)}>
            完成
            <Check size={15} />
          </button>
        </div>
      </section>
    </div>
  );

  if (session)
    return (
      <>
        <Suspense
          fallback={
            <div className="viewer-empty">
              <Loader2 className="spin" size={30} />
              正在打开项目工作台
            </div>
          }
        >
          <ProjectWorkbench
            session={session}
            opener={state!.settings}
            onExternal={() => open(session.project)}
            onGitHub={() => void perform(() => api.openGitHub(session.project.id))}
            busy={busy}
            actionError={settings ? '' : error}
            onDismissError={() => setError('')}
          />
        </Suspense>
        {settingsDialog}
      </>
    );

  if (projectWindow)
    return (
      <div className="viewer-empty" role="status">
        {error || (
          <>
            <Loader2 className="spin" size={30} />
            正在打开项目工作台
          </>
        )}
      </div>
    );

  return (
    <div className={`app platform-${platform} ${state?.settings.workspace ? 'project-page' : ''}`}>
      <aside className="sidebar">
        <header className="brand">
          <span className="brand-mark">
            <img src={logo} alt="BK Project Manager" width="22" height="22" />
          </span>
          <span className="brand-name" title="Project Manager">
            Project Manager
          </span>
        </header>
        <div className="nav-caption">工作台</div>
        <nav aria-label="项目导航">
          <button
            className={`nav-item ${selection === 'all' ? 'active' : ''}`}
            onClick={() => select('all')}
          >
            <Grid2X2 size={17} />
            <span>全部项目</span>
            <b>{projects.length}</b>
          </button>
          <button
            className={`nav-item ${selection === 'favorites' ? 'active' : ''}`}
            onClick={() => select('favorites')}
          >
            <Star size={17} />
            <span>我的收藏</span>
            <b>{favoriteCount}</b>
          </button>
          <button
            className={`nav-item ${selection === 'recent' ? 'active' : ''}`}
            onClick={() => select('recent')}
          >
            <Clock3 size={17} />
            <span>最近打开</span>
            <b>{recentCount}</b>
          </button>
        </nav>
        <div className="nav-caption category-caption">
          <span>
            项目分类 <small>{categories.length}</small>
          </span>
          <button
            aria-label="新增分类"
            title="新增分类"
            disabled={busy || !state?.settings.workspace}
            onClick={() => setManagementDialog({ kind: 'category' })}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="category-nav" aria-label="项目分类">
          {categories.map((category) => (
            <button
              key={category}
              className={`nav-item ${selection === `category:${category}` ? 'active' : ''}`}
              onClick={() => select(`category:${category}`)}
            >
              <CategoryIcon style={categoryStyle(category)} />
              <span>{category}</span>
              <b>{projects.filter((p) => p.category === category).length}</b>
            </button>
          ))}
          {!categories.length && <p className="sidebar-hint">选择工作空间后，分类会出现在这里。</p>}
        </nav>
      </aside>
      <main>
        <div className="project-window-drag" aria-hidden="true" />
        <div className="content">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="关闭错误">
                <X size={16} />
              </button>
            </div>
          )}
          {!state?.settings.workspace ? (
            <section className="onboarding">
              <div className="welcome-icon">
                <img src={logo} alt="BK Project Manager" width="64" height="64" />
              </div>
              <h1>从一个工作空间开始</h1>
              <p>
                选择项目所在的文件夹，自动发现并整理你的项目。
                <br />
                保留熟悉的目录结构，随时打开，继续工作。
              </p>
              <button className="primary-button welcome-button" disabled={busy} onClick={choose}>
                {busy ? <Loader2 className="spin" size={18} /> : <FolderOpen size={18} />}
                选择工作空间
                <ArrowRight size={17} />
              </button>
              <div className="welcome-example">
                <Folder size={15} />
                <span>例如 ~/Workspace 或 D:\Workspace</span>
              </div>
              <div className="welcome-features">
                <span>
                  <Check size={14} />
                  自动收纳 Projects 目录
                </span>
                <span>
                  <Check size={14} />
                  保留原有目录结构
                </span>
                <span>
                  <Check size={14} />
                  所有数据本地保存
                </span>
              </div>
            </section>
          ) : (
            <>
              <h1 className="sr-only">{title}</h1>
              {!!state.snapshot?.warnings.length && (
                <div className="scan-warning" role="status">
                  {state.snapshot.warnings.join('；')}
                </div>
              )}
              {filtered.length ? (
                <section
                  className={`project-grid ${view === 'list' ? 'list-view' : ''}`}
                  aria-label="项目列表"
                >
                  {filtered.map((project) => {
                    const running = state?.runningProjects.includes(project.id) ?? false;
                    const focusProject = () => void perform(() => api.focusWorkbench(project.id));
                    return (
                      <article
                        className={`project-card ${running ? 'is-running' : ''}`}
                        key={project.id}
                        onClick={
                          running
                            ? (event) => {
                                if (
                                  !(event.target as HTMLElement).closest('button, a, input, select')
                                )
                                  focusProject();
                              }
                            : undefined
                        }
                        onKeyDown={
                          running
                            ? (event) => {
                                if (
                                  event.target === event.currentTarget &&
                                  (event.key === 'Enter' || event.key === ' ')
                                ) {
                                  event.preventDefault();
                                  focusProject();
                                }
                              }
                            : undefined
                        }
                        tabIndex={running ? 0 : undefined}
                        aria-label={
                          running ? `${project.name}，运行中，点击切换到项目窗口` : undefined
                        }
                      >
                        <div className="card-head">
                          <span
                            className={`card-category ${categoryStyle(project.category).color}`}
                          >
                            <CategoryIcon style={categoryStyle(project.category)} size={12} />
                            <span>{project.category}</span>
                          </span>
                          <button
                            className={`favorite-button ${favorites.includes(project.id) ? 'is-favorite' : ''}`}
                            aria-label={`${favorites.includes(project.id) ? '取消收藏' : '收藏'} ${project.name}`}
                            aria-pressed={favorites.includes(project.id)}
                            disabled={busy}
                            onClick={() => perform(() => api.toggleFavorite(project.id))}
                          >
                            <Star
                              size={17}
                              fill={favorites.includes(project.id) ? 'currentColor' : 'none'}
                            />
                          </button>
                        </div>
                        <div className="card-body">
                          <h2 title={project.name}>{project.name}</h2>
                          <p className="project-path" title={project.path}>
                            {project.relativePath}
                          </p>
                          <div className="project-meta">
                            <span className={`type-tag ${typeColors[project.type] || 'gray'}`}>
                              <span />
                              {project.type === 'Folder' ? '文件夹' : project.type}
                            </span>
                            {project.git && (
                              <span className="git-tag">
                                <GitBranch size={12} />
                                Git
                              </span>
                            )}
                            <span className="modified-time" title="目录修改时间">
                              <Clock3 size={12} />
                              {relativeTime(project.modifiedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="card-footer">
                          <div className="card-tools">
                            <GitHubButton
                              project={project}
                              busy={busy}
                              onOpen={() => void perform(() => api.openGitHub(project.id))}
                            />
                            <button
                              title="移除项目或手动删除"
                              aria-label={`移除项目 ${project.name}`}
                              disabled={busy}
                              onClick={() =>
                                setRemovalTarget({
                                  kind: 'project',
                                  key: project.id,
                                  name: project.name,
                                  path: project.path,
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              title={`在 ${folderName} 中打开`}
                              aria-label={`打开 ${project.name} 文件夹`}
                              disabled={busy}
                              onClick={() => open(project, 'folder')}
                            >
                              <FolderOpen size={16} />
                            </button>
                            <button
                              title="在 VS Code 中打开"
                              aria-label={`在 VS Code 中打开 ${project.name}`}
                              disabled={busy}
                              onClick={() => open(project, 'vscode')}
                            >
                              <img src={vscodeIcon} width={16} height={16} alt="" />
                            </button>
                            <button
                              title="在终端中打开"
                              aria-label={`打开 ${project.name} 终端`}
                              disabled={busy}
                              onClick={() => open(project, 'terminal')}
                            >
                              <Terminal size={16} />
                            </button>
                          </div>
                          <button
                            className={`open-project ${running ? 'is-running' : ''}`}
                            title={running ? '切换到项目窗口' : '在独立窗口中打开项目'}
                            disabled={busy}
                            onClick={running ? focusProject : () => void enterProject(project)}
                          >
                            {running && <span className="running-dot" aria-hidden="true" />}
                            <span>{running ? '运行中' : '启动项目'}</span>
                            {!running && <ArrowRight size={14} />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </section>
              ) : (
                <div className="empty-state">
                  {busy ? (
                    <Loader2 size={32} className="spin" />
                  ) : selection === 'favorites' ? (
                    <Star size={32} />
                  ) : selection === 'recent' ? (
                    <Clock3 size={32} />
                  ) : (
                    <FolderOpen size={32} />
                  )}
                  <h2>
                    {busy
                      ? '正在寻找你的项目'
                      : selection === 'favorites'
                        ? '把喜欢的项目，留在这里'
                        : selection === 'recent'
                          ? '还没有打开过项目'
                          : selectedCategory
                            ? '这个分类暂时没有项目'
                            : '工作空间中还没有项目'}
                  </h2>
                  <p>
                    {selection === 'favorites'
                      ? '点击项目卡片右上角的星标，即可收藏。'
                      : selection === 'recent'
                        ? '打开一个项目后，就能在这里快速找回。'
                        : '点击右下角的新建项目，创建第一个项目文件夹。'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {state?.settings.workspace && (
        <ProjectTools
          key={selection}
          category={selectedCategory}
          recent={selection === 'recent'}
          busy={busy}
          obscured={settings || !!managementDialog || !!removalTarget}
          sort={activeSort}
          view={view}
          onSort={selection === 'recent' ? setRecentSort : setSort}
          onView={setView}
          onScan={() => void perform(api.scan)}
          onCreate={addProject}
          onAppearance={() =>
            selectedCategory &&
            setManagementDialog({ kind: 'appearance', category: selectedCategory })
          }
          onRemove={() =>
            selectedCategory &&
            setRemovalTarget({
              kind: 'category',
              key: selectedCategory,
              name: selectedCategory,
              path: `${state.snapshot?.workspace ?? state.settings.workspace}${platform === 'win32' ? '\\' : '/'}${selectedCategory}`,
              count: projects.filter((project) => project.category === selectedCategory).length,
            })
          }
        />
      )}
      {message && (
        <div className="toast" role="status">
          <Check size={16} />
          {message}
        </div>
      )}
      {settingsDialog}
      {removalTarget && (
        <RemoveItemDialog
          target={removalTarget}
          onClose={() => setRemovalTarget(null)}
          onRemoved={(next, revealed) => {
            setState(next);
            if (removalTarget.kind === 'category') select('all');
            setRemovalTarget(null);
            setMessage(
              revealed
                ? `已从列表移除，并在 ${folderName} 中定位，请自行删除文件夹`
                : '已从列表移除，文件仍在原位置，可在设置中恢复',
            );
          }}
        />
      )}
      {managementDialog && state && (
        <ProjectManagerDialog
          dialog={managementDialog}
          state={state}
          getStyle={categoryStyle}
          onClose={() => setManagementDialog(null)}
          onSaved={(next, category) => {
            setState(next);
            select(`category:${category}`);
            setMessage(
              managementDialog.kind === 'appearance'
                ? '分类外观已更新'
                : managementDialog.kind === 'category'
                  ? '分类已创建，可以新建项目了'
                  : '空项目已创建',
            );
            setManagementDialog(null);
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
