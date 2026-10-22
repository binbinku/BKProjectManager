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
  projects: Project[];
  warnings: string[];
  scannedAt: number;
}
export type ThemePreference = 'light' | 'dark' | 'system';
export interface Settings {
  workspace: string | null;
  favorites: string[];
  recent: Record<string, number>;
  opener: string;
  customEditor: string | null;
  theme: ThemePreference;
}
export interface AppState {
  settings: Settings;
  snapshot: Snapshot | null;
}
export interface WorkspaceAPI {
  platform: string;
  getState(): Promise<AppState>;
  chooseWorkspace(): Promise<AppState>;
  scan(): Promise<AppState>;
  toggleFavorite(id: string): Promise<AppState>;
  openProject(id: string, action?: 'default' | 'folder' | 'terminal'): Promise<AppState>;
  setOpener(value: string): Promise<AppState>;
  setTheme(value: ThemePreference): Promise<AppState>;
  chooseEditor(): Promise<AppState>;
}
declare global {
  interface Window {
    workspaceAPI: WorkspaceAPI;
  }
}
