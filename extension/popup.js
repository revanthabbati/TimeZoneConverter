// Mirrors the search/time logic in ../src/lib/timezones.ts and time.ts, kept as plain JS
// (no build step) so this extension loads unpacked with zero tooling. Storage is local to the
// extension (chrome.storage.local) — it is intentionally not synced with the web app's
// localStorage, since a popup can't reach another origin's storage.

const APP_URL = 'https://revanthabbati.github.io/TimeZoneConverter/';

const ABBR_MAP = {
  ist: 'Asia/Kolkata',
  est: 'America/New_York',
  edt: 'America/New_York',
  cst: 'America/Chicago',
  cdt: 'America/Chicago',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  mst: 'America/Denver',
  mdt: 'America/Denver',
  gmt: 'UTC',
  utc: 'UTC',
  bst: 'Europe/London',
  cet: 'Europe/Berlin',
  sgt: 'Asia/Singapore',
  jst: 'Asia/Tokyo',
  aest: 'Australia/Sydney',
  kolkata: 'Asia/Kolkata',
  calcutta: 'Asia/Kolkata',
  india: 'Asia/Kolkata',
};

const POPULAR_ZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
];

let allZonesCache = null;
function allTimeZones() {
  if (!allZonesCache) allZonesCache = Intl.supportedValuesOf('timeZone');
  return allZonesCache;
}

function displayName(tz) {
  return (tz.split('/').pop() || tz).replace(/_/g, ' ');
}

function longNameOf(tz, at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).format(at);
  return parts.split(',').pop().trim();
}

function abbrOf(tz, at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at);
  return (parts.find((p) => p.type === 'timeZoneName') || {}).value || '';
}

function searchTimeZones(query, limit) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const scored = [];
  const seen = new Set();
  const consider = (tz, score) => {
    if (seen.has(tz)) return;
    seen.add(tz);
    scored.push({ tz, score });
  };
  if (ABBR_MAP[q]) consider(ABBR_MAP[q], 100);
  for (const tz of allTimeZones()) {
    const city = displayName(tz).toLowerCase();
    if (city === q) consider(tz, 90);
    else if (city.startsWith(q)) consider(tz, 80);
    else if (city.includes(q)) consider(tz, 60);
    else if (tz.toLowerCase().includes(q)) consider(tz, 20);
  }
  return scored
    .sort((a, b) => b.score - a.score || a.tz.localeCompare(b.tz))
    .slice(0, limit)
    .map((s) => s.tz);
}

const state = {
  zones: ['Asia/Kolkata'],
  theme: 'dark',
  hourFormat: 24,
};

async function loadState() {
  const stored = await chrome.storage.local.get(['zones', 'theme', 'hourFormat']);
  if (Array.isArray(stored.zones) && stored.zones.length) state.zones = stored.zones;
  if (stored.theme === 'light' || stored.theme === 'dark') state.theme = stored.theme;
  if (stored.hourFormat === 12 || stored.hourFormat === 24) state.hourFormat = stored.hourFormat;
}

function saveState() {
  chrome.storage.local.set({ zones: state.zones, theme: state.theme, hourFormat: state.hourFormat });
}

const els = {
  search: document.getElementById('search'),
  dropdown: document.getElementById('dropdown'),
  list: document.getElementById('list'),
  themeBtn: document.getElementById('themeBtn'),
  formatBtn: document.getElementById('formatBtn'),
  openApp: document.getElementById('openApp'),
};

function themeIconSvg(isDark) {
  return isDark
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
}

function applyTheme() {
  document.body.setAttribute('data-theme', state.theme);
  els.themeBtn.innerHTML = themeIconSvg(state.theme === 'dark');
}

function applyFormat() {
  els.formatBtn.textContent = state.hourFormat === 24 ? '24h' : '12h';
}

function renderList() {
  const at = new Date();
  if (!state.zones.length) {
    els.list.innerHTML = '<div class="empty">No cities yet — search above to add one.</div>';
    return;
  }
  els.list.innerHTML = state.zones
    .map((tz, i) => {
      const hour12 = state.hourFormat === 12;
      const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12 }).format(at);
      const date = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(at);
      return `
        <div class="zone-card">
          <div class="zone-info">
            <div class="zone-name">${displayName(tz)}</div>
            <div class="zone-meta">${abbrOf(tz, at)} &middot; ${longNameOf(tz, at)}</div>
          </div>
          <div class="zone-right">
            <div>
              <div class="zone-time">${time}</div>
              <div class="zone-date">${date}</div>
            </div>
            <button type="button" class="remove-btn" data-remove="${i}" aria-label="Remove ${displayName(tz)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
        </div>`;
    })
    .join('');
}

function renderDropdown(query) {
  const results = query ? searchTimeZones(query, 8) : POPULAR_ZONES.filter((tz) => !state.zones.includes(tz)).slice(0, 6);
  if (!results.length) {
    els.dropdown.innerHTML = `<div class="drop-empty">${query ? 'No matches' : 'All popular cities already added'}</div>`;
  } else {
    const at = new Date();
    els.dropdown.innerHTML = results
      .map(
        (tz) => `
        <div class="drop-item" data-add="${tz}">
          <div style="min-width:0">
            <b>${displayName(tz)}</b>
            <div class="sub">${longNameOf(tz, at)}</div>
          </div>
          <span class="time">${new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: state.hourFormat === 12 }).format(at)}</span>
        </div>`,
      )
      .join('');
  }
  els.dropdown.classList.add('open');
}

function closeDropdown() {
  els.dropdown.classList.remove('open');
}

function addZone(tz) {
  if (!state.zones.includes(tz)) {
    state.zones.push(tz);
    saveState();
    renderList();
    updateOpenAppLink();
  }
  els.search.value = '';
  closeDropdown();
}

function updateOpenAppLink() {
  const url = new URL(APP_URL);
  url.searchParams.set('zones', state.zones.join(','));
  url.searchParams.set('f', String(state.hourFormat));
  els.openApp.href = url.toString();
}

els.search.addEventListener('input', () => renderDropdown(els.search.value.trim()));
els.search.addEventListener('focus', () => renderDropdown(els.search.value.trim()));
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-area') && !e.target.closest('.dropdown')) closeDropdown();
});
els.dropdown.addEventListener('click', (e) => {
  const item = e.target.closest('[data-add]');
  if (item) addZone(item.dataset.add);
});
els.list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (btn) {
    state.zones.splice(Number(btn.dataset.remove), 1);
    saveState();
    renderList();
    updateOpenAppLink();
  }
});
els.themeBtn.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
});
els.formatBtn.addEventListener('click', () => {
  state.hourFormat = state.hourFormat === 24 ? 12 : 24;
  saveState();
  applyFormat();
  renderList();
  updateOpenAppLink();
});

async function init() {
  await loadState();
  applyTheme();
  applyFormat();
  renderList();
  updateOpenAppLink();
  setInterval(renderList, 1000);
}

init();
