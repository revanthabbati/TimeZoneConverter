import type { AppSettings, HourFormat, ThemeMode, ViewMode } from '@/types';

const KEYS = {
  zones: 'cs_sov_zones',
  format: 'cs_sov_format',
  theme: 'cs_sov_theme',
  view: 'tzc_view',
  favorites: 'tzc_favorites',
  recents: 'tzc_recents',
} as const;

const MAX_RECENTS = 6;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — state just won't persist */
  }
}

export class AppStore {
  zones: string[];
  favorites: string[];
  recents: string[];
  settings: AppSettings;

  constructor() {
    this.zones = readJSON(KEYS.zones, ['Asia/Kolkata']);
    this.favorites = readJSON(KEYS.favorites, [] as string[]);
    this.recents = readJSON(KEYS.recents, [] as string[]);
    const storedIs24h = readJSON<boolean>(KEYS.format, true);
    this.settings = {
      hourFormat: (storedIs24h ? 24 : 12) as HourFormat,
      theme: readJSON<ThemeMode>(KEYS.theme, 'dark'),
      view: readJSON<ViewMode>(KEYS.view, 'cards'),
    };
  }

  saveZones(): void {
    writeJSON(KEYS.zones, this.zones);
  }

  addZone(tz: string): boolean {
    if (this.zones.includes(tz)) return false;
    this.zones.push(tz);
    this.saveZones();
    this.pushRecent(tz);
    return true;
  }

  removeZone(index: number): void {
    this.zones.splice(index, 1);
    this.saveZones();
  }

  reorderZones(newOrder: string[]): void {
    this.zones = newOrder;
    this.saveZones();
  }

  toggleFavorite(tz: string): void {
    this.favorites = this.favorites.includes(tz)
      ? this.favorites.filter((z) => z !== tz)
      : [...this.favorites, tz];
    writeJSON(KEYS.favorites, this.favorites);
  }

  isFavorite(tz: string): boolean {
    return this.favorites.includes(tz);
  }

  pushRecent(tz: string): void {
    this.recents = [tz, ...this.recents.filter((z) => z !== tz)].slice(0, MAX_RECENTS);
    writeJSON(KEYS.recents, this.recents);
  }

  setHourFormat(fmt: HourFormat): void {
    this.settings.hourFormat = fmt;
    writeJSON(KEYS.format, fmt === 24);
  }

  setTheme(theme: ThemeMode): void {
    this.settings.theme = theme;
    writeJSON(KEYS.theme, theme);
  }

  setView(view: ViewMode): void {
    this.settings.view = view;
    writeJSON(KEYS.view, view);
  }

  exportData(): string {
    return JSON.stringify(
      {
        zones: this.zones,
        favorites: this.favorites,
        settings: this.settings,
        exportedAt: new Date().toISOString(),
        version: 2,
      },
      null,
      2,
    );
  }

  importData(json: string): void {
    const parsed = JSON.parse(json) as {
      zones?: unknown;
      favorites?: unknown;
      settings?: Partial<AppSettings>;
    };
    if (Array.isArray(parsed.zones) && parsed.zones.every((z) => typeof z === 'string')) {
      this.zones = parsed.zones;
      this.saveZones();
    }
    if (Array.isArray(parsed.favorites) && parsed.favorites.every((z) => typeof z === 'string')) {
      this.favorites = parsed.favorites;
      writeJSON(KEYS.favorites, this.favorites);
    }
    if (parsed.settings) {
      if (parsed.settings.hourFormat === 12 || parsed.settings.hourFormat === 24) {
        this.setHourFormat(parsed.settings.hourFormat);
      }
      if (
        parsed.settings.theme === 'light' ||
        parsed.settings.theme === 'dark' ||
        parsed.settings.theme === 'system'
      ) {
        this.setTheme(parsed.settings.theme);
      }
      if (parsed.settings.view === 'cards' || parsed.settings.view === 'timeline') {
        this.setView(parsed.settings.view);
      }
    }
  }

  resetAll(): void {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
    this.zones = ['Asia/Kolkata'];
    this.favorites = [];
    this.recents = [];
    this.settings = { hourFormat: 24, theme: 'dark', view: 'cards' };
  }
}
