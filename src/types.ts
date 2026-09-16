export type ThemeMode = 'light' | 'dark' | 'system';
export type ViewMode = 'cards' | 'timeline';
export type HourFormat = 12 | 24;

export interface ZoneEntry {
  id: string;
}

export interface SearchResult {
  id: string;
  name: string;
  region: string;
  full: string;
  abbr: string;
  time: string;
}

export interface AppSettings {
  hourFormat: HourFormat;
  theme: ThemeMode;
  view: ViewMode;
}

export interface AppState {
  zones: string[];
  favorites: string[];
  recents: string[];
  settings: AppSettings;
}

export interface Command {
  id: string;
  title: string;
  hint?: string;
  icon: string;
  keywords?: string;
  run: () => void;
}
