import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/timeline.css';
import './styles/responsive.css';

import { AppStore } from '@/lib/state';
import { refreshIcons } from '@/lib/icons';
import { createCardsView } from '@/ui/cardsView';
import { createTimelineView } from '@/ui/timelineView';
import { initSearch } from '@/ui/search';
import { showToast } from '@/ui/toast';
import { openSettingsDrawer } from '@/ui/settingsDrawer';
import { openShortcutsModal, openExportDialog } from '@/ui/dialogs';
import { encodeShareUrl, decodeShareUrl, clearShareParams } from '@/lib/share';
import type { Command, HourFormat, ThemeMode } from '@/types';

const store = new AppStore();
let masterDate = new Date();

const shared = decodeShareUrl();
if (shared) {
  if (shared.zones?.length) store.zones = shared.zones;
  if (shared.at) masterDate = shared.at;
  if (shared.hourFormat) store.settings.hourFormat = shared.hourFormat;
  clearShareParams();
}

const els = {
  cardsList: document.getElementById('cardsList') as HTMLElement,
  timelineWrap: document.getElementById('timelineWrap') as HTMLElement,
  dropdown: document.getElementById('dropdown') as HTMLElement,
  search: document.getElementById('mainSearch') as HTMLInputElement,
  formatBtn: document.getElementById('formatBtn') as HTMLButtonElement,
  themeBtn: document.getElementById('themeBtn') as HTMLButtonElement,
  shareBtn: document.getElementById('shareBtn') as HTMLButtonElement,
  exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
  settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
  currentTimeBtn: document.getElementById('currentTimeBtn') as HTMLButtonElement,
  brandBtn: document.getElementById('brandBtn') as HTMLButtonElement,
  viewToggle: document.getElementById('viewToggle') as HTMLElement,
};

function getMasterDate(): Date {
  return masterDate;
}
function setMasterDate(d: Date): void {
  masterDate = d;
}

function addZoneWithFeedback(tz: string): void {
  const added = store.addZone(tz);
  if (added) {
    renderActive();
    showToast(`Added ${tz.split('/').pop()?.replace(/_/g, ' ')}`, 'plus-circle');
  }
}

const cardsView = createCardsView({
  container: els.cardsList,
  store,
  getMasterDate,
  setMasterDate,
  getHourFormat: () => store.settings.hourFormat,
  onAddZone: addZoneWithFeedback,
});

const timelineView = createTimelineView({
  container: els.timelineWrap,
  store,
  getMasterDate,
  setMasterDate,
  getHourFormat: () => store.settings.hourFormat,
});

function renderActive(): void {
  if (store.settings.view === 'timeline') timelineView.render();
  else cardsView.render();
}

function switchView(view: 'cards' | 'timeline'): void {
  store.setView(view);
  els.cardsList.style.display = view === 'cards' ? '' : 'none';
  els.timelineWrap.style.display = view === 'timeline' ? '' : 'none';
  els.viewToggle.querySelectorAll<HTMLElement>('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderActive();
}

function getEffectiveTheme(): 'light' | 'dark' {
  if (store.settings.theme === 'light' || store.settings.theme === 'dark') return store.settings.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode): void {
  store.setTheme(theme);
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);

  const eff = getEffectiveTheme();
  // lucide replaces the <i data-lucide> placeholder with an <svg> in place, so there's no
  // element left to just flip an attribute on — swap in a fresh placeholder and re-inflate it.
  els.themeBtn.innerHTML = `<i data-lucide="${eff === 'dark' ? 'moon' : 'sun'}"></i>`;
  refreshIcons();
}

function applyFormat(fmt: HourFormat): void {
  store.setHourFormat(fmt);
  els.formatBtn.textContent = fmt === 24 ? '24-HOUR' : '12-HOUR';
  renderActive();
}

async function copyShareLink(): Promise<void> {
  const url = encodeShareUrl({
    zones: store.zones,
    at: masterDate,
    hourFormat: store.settings.hourFormat,
  });
  try {
    await navigator.clipboard.writeText(url);
    showToast('Shareable link copied to clipboard', 'link-2');
  } catch {
    showToast('Could not access clipboard', 'alert-triangle');
  }
}

function resetToNow(): void {
  masterDate = new Date();
  renderActive();
}

function commands(): Command[] {
  const fmt = store.settings.hourFormat;
  const view = store.settings.view;
  return [
    {
      id: 'theme',
      title: 'Toggle theme',
      icon: getEffectiveTheme() === 'dark' ? 'sun' : 'moon',
      keywords: 'theme dark light appearance',
      run: () => applyTheme(getEffectiveTheme() === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'share',
      title: 'Copy share link',
      icon: 'link-2',
      keywords: 'share link copy url',
      run: () => void copyShareLink(),
    },
    {
      id: 'export',
      title: 'Export to calendar',
      icon: 'calendar-plus',
      keywords: 'export ics calendar invite meeting',
      run: () =>
        openExportDialog({ zones: store.zones, at: masterDate, hourFormat: store.settings.hourFormat }),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      keywords: 'settings preferences data export import reset',
      run: openSettings,
    },
    {
      id: 'format',
      title: fmt === 24 ? 'Switch to 12-hour' : 'Switch to 24-hour',
      icon: 'clock',
      keywords: 'format 12 24 hour am pm',
      run: () => applyFormat(fmt === 24 ? 12 : 24),
    },
    {
      id: 'view',
      title: view === 'cards' ? 'Switch to timeline view' : 'Switch to cards view',
      icon: view === 'cards' ? 'gantt-chart-square' : 'layout-grid',
      keywords: 'view timeline cards meeting planner',
      run: () => switchView(view === 'cards' ? 'timeline' : 'cards'),
    },
    {
      id: 'now',
      title: 'Reset to current time',
      icon: 'zap',
      keywords: 'now reset current',
      run: resetToNow,
    },
    {
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      icon: 'keyboard',
      keywords: 'shortcuts keyboard help',
      run: openShortcutsModal,
    },
  ];
}

function openSettings(): void {
  openSettingsDrawer({
    store,
    onThemeChange: applyTheme,
    onFormatChange: (is24h) => applyFormat(is24h ? 24 : 12),
    onViewChange: switchView,
    onResetAll: () => {
      store.resetAll();
      applyTheme('dark');
      applyFormat(24);
      switchView('cards');
      showToast('All data has been reset', 'refresh-ccw');
    },
  });
}

initSearch({
  input: els.search,
  dropdown: els.dropdown,
  store,
  getMasterDate,
  getHourFormat: () => store.settings.hourFormat,
  onAddZone: addZoneWithFeedback,
  getCommands: commands,
});

els.viewToggle.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
  if (btn) switchView(btn.dataset.view as 'cards' | 'timeline');
});
els.formatBtn.addEventListener('click', () => applyFormat(store.settings.hourFormat === 24 ? 12 : 24));
els.themeBtn.addEventListener('click', () => applyTheme(getEffectiveTheme() === 'dark' ? 'light' : 'dark'));
els.shareBtn.addEventListener('click', () => void copyShareLink());
els.exportBtn.addEventListener('click', () =>
  openExportDialog({ zones: store.zones, at: masterDate, hourFormat: store.settings.hourFormat }),
);
els.settingsBtn.addEventListener('click', openSettings);
els.currentTimeBtn.addEventListener('click', resetToNow);
els.brandBtn.addEventListener('click', resetToNow);

function isTypingTarget(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.hasAttribute('contenteditable');
}

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    els.search.focus();
    return;
  }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    void copyShareLink();
    return;
  }
  if (isTypingTarget()) return;

  if (e.key === '/') {
    e.preventDefault();
    els.search.focus();
  } else if (e.key.toLowerCase() === 't') {
    applyTheme(getEffectiveTheme() === 'dark' ? 'light' : 'dark');
  } else if (e.key.toLowerCase() === 'f') {
    applyFormat(store.settings.hourFormat === 24 ? 12 : 24);
  } else if (e.key.toLowerCase() === 'v') {
    switchView(store.settings.view === 'cards' ? 'timeline' : 'cards');
  } else if (e.key === '?') {
    openShortcutsModal();
  }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (store.settings.theme === 'system') applyTheme('system');
});

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a nice-to-have, not critical */
    });
  }
}

function init(): void {
  applyTheme(store.settings.theme);
  applyFormat(store.settings.hourFormat);
  els.viewToggle.querySelectorAll<HTMLElement>('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === store.settings.view);
  });
  els.cardsList.style.display = store.settings.view === 'cards' ? '' : 'none';
  els.timelineWrap.style.display = store.settings.view === 'timeline' ? '' : 'none';
  renderActive();
  refreshIcons();
  if (shared) showToast('Loaded a shared comparison', 'link-2');
  registerServiceWorker();
}

init();
