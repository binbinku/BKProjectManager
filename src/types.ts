export interface Project {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  category: string;
  type: string;
  git: boolean;
  modifiedAt: number;
}
export interface Snapshot {
  workspace: string;
  categories: string[];
  projectContainers: Record<string, string | null>;
  projects: Project[];
  warnings: string[];
  scannedAt: number;
}
export type ThemePreference = 'light' | 'dark' | 'system';
export type PaletteName = 'default' | 'graphite' | 'sand' | 'forest' | 'github' | 'apple' | 'neo';
export interface CategoryStyle {
  color: string;
  icon: string;
}
export interface Settings {
  workspace: string | null;
  favorites: string[];
  recent: Record<string, number>;
  opener: string;
  customEditor: string | null;
  theme: ThemePreference;
  palette: PaletteName;
  categoryStyles: Record<string, Record<string, CategoryStyle>>;
  visibility: Record<string, { categories: string[]; projects: string[] }>;
}
export interface AppState {
  settings: Settings;
  snapshot: Snapshot | null;
}
export interface WorkspaceAPI {
  onMenuAction(callback: (action: MenuAction) => void): () => void;
  getOpenerInfo(): Promise<{ name: string; icon: string | null }>;
  openWorkbench(id: string): Promise<{ session: WorkbenchSession; state: AppState }>;
  closeWorkbench(id: string): Promise<void>;
  listProjectFiles(id: string, relative: string): Promise<DirectoryListing>;
  readProjectFile(id: string, relative: string): Promise<FilePreview>;
  startTerminal(id: string, cols: number, rows: number): Promise<{ id: string; shell: string }>;
  writeTerminal(id: string, terminalId: string, data: string): Promise<void>;
  resizeTerminal(id: string, terminalId: string, cols: number, rows: number): Promise<void>;
  acknowledgeTerminal(id: string, terminalId: string, length: number): Promise<void>;
  stopTerminal(id: string, terminalId: string): Promise<void>;
  onTerminalEvent(callback: (event: TerminalEvent) => void): () => void;
  platform: string;
  getState(): Promise<AppState>;
  chooseWorkspace(): Promise<AppState>;
  scan(): Promise<AppState>;
  removeItem(kind: 'category' | 'project', key: string): Promise<AppState>;
  restoreItem(kind: 'category' | 'project' | 'all', key?: string): Promise<AppState>;
  revealItem(kind: 'category' | 'project', key: string): Promise<AppState>;
  createCategory(name: string, style: CategoryStyle): Promise<AppState>;
  setCategoryStyle(category: string, style: CategoryStyle): Promise<AppState>;
  createProject(category: string, name: string): Promise<AppState>;
  toggleFavorite(id: string): Promise<AppState>;
  openProject(id: string, action?: 'default' | 'folder' | 'terminal'): Promise<AppState>;
  setOpener(value: string): Promise<AppState>;
  setTheme(value: ThemePreference): Promise<AppState>;
  setPalette(value: PaletteName): Promise<AppState>;
  chooseEditor(): Promise<AppState>;
}
export type MenuAction = 'settings' | 'refresh-files' | 'terminal-clear' | 'terminal-restart';
export interface WorkbenchSession {
  id: string;
  project: Project;
}
export interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory' | 'link' | 'special';
}
export interface DirectoryListing {
  entries: FileEntry[];
  truncated: boolean;
}
export type FilePreview = { path: string; size: number } & (
  | { kind: 'text'; content: string; encoding: string }
  | { kind: 'image'; dataURL: string }
  | { kind: 'unsupported'; reason: string }
);
export type TerminalEvent = { sessionId: string; terminalId: string } & (
  { type: 'data'; data: string } | { type: 'exit'; exitCode: number }
);
declare global {
  interface Window {
    workspaceAPI: WorkspaceAPI;
  }
}
