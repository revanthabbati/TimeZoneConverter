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

// ---------- Time math (mirrors src/lib/time.ts) ----------

function pad(n) {
  return String(n).padStart(2, '0');
}

function getZoneParts(tz, at) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(at);
  const hour24 = parseInt((parts.find((p) => p.type === 'hour') || {}).value || '0', 10);
  const minute = parseInt((parts.find((p) => p.type === 'minute') || {}).value || '0', 10);
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  const dateISO = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
  return { hour24, minute, hour12, ampm, dateISO, pickerValue: `${pad(hour24)}:${pad(minute)}` };
}

// Converts a wall-clock date+time as observed in `tz` into the real instant it represents.
// Standard round-trip trick since Intl has no direct "zoned wall time -> instant" API.
function zonedWallTimeToInstant(dateStr, timeStr, tz) {
  const iso = `${dateStr}T${timeStr}:00`;
  const guess = new Date(iso);
  const asInZone = new Date(guess.toLocaleString('en-US', { timeZone: tz }));
  return new Date(guess.getTime() + (guess.getTime() - asInZone.getTime()));
}

function withAmPm(at, tz, target) {
  const { hour24 } = getZoneParts(tz, at);
  const next = new Date(at);
  if (target === 'AM' && hour24 >= 12) next.setHours(next.getHours() - 12);
  if (target === 'PM' && hour24 < 12) next.setHours(next.getHours() + 12);
  return next;
}

function parseTimeInput12(raw, ampm) {
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hrs = parseInt(m[1], 10);
  const mins = m[2];
  if (ampm === 'PM' && hrs < 12) hrs += 12;
  if (ampm === 'AM' && hrs === 12) hrs = 0;
  if (hrs > 23) return null;
  return `${pad(hrs)}:${mins}`;
}

// ---------- State ----------

const state = {
  zones: ['Asia/Kolkata'],
  theme: 'dark',
  hourFormat: 24,
};

let masterDate = new Date();
let isLive = true;

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
  nowBtn: document.getElementById('nowBtn'),
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

function setLive(next) {
  isLive = next;
  els.nowBtn.classList.toggle('active', isLive);
}

function zoneCardHtml(tz, i) {
  const hour12 = state.hourFormat === 12;
  const parts = getZoneParts(tz, masterDate);
  const timeValue = hour12 ? `${pad(parts.hour12)}:${pad(parts.minute)}` : parts.pickerValue;
  return `
    <div class="zone-card" data-tz="${tz}">
      <div class="zone-top">
        <div class="zone-info">
          <div class="zone-name">${displayName(tz)}</div>
          <div class="zone-meta">${abbrOf(tz, masterDate)} &middot; ${longNameOf(tz, masterDate)}</div>
        </div>
        <button type="button" class="remove-btn" data-remove="${i}" aria-label="Remove ${displayName(tz)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>
      </div>
      <div class="zone-edit">
        <input type="date" class="edit-date" data-role="date" value="${parts.dateISO}" aria-label="Date in ${displayName(tz)}">
        <input type="${hour12 ? 'text' : 'time'}" class="edit-time" data-role="time" value="${timeValue}" aria-label="Time in ${displayName(tz)}">
        ${
          hour12
            ? `<div class="ampm-toggle">
                <button type="button" class="ampm-btn ${parts.ampm === 'AM' ? 'active' : ''}" data-ampm="AM">AM</button>
                <button type="button" class="ampm-btn ${parts.ampm === 'PM' ? 'active' : ''}" data-ampm="PM">PM</button>
              </div>`
            : ''
        }
      </div>
    </div>`;
}

function renderList() {
  if (!state.zones.length) {
    els.list.innerHTML = '<div class="empty">No cities yet — search above to add one.</div>';
    return;
  }
  els.list.innerHTML = state.zones.map((tz, i) => zoneCardHtml(tz, i)).join('');
}

/** Updates every card's inputs except `skipTz` in place, so the field the user is actively
 * editing keeps focus and cursor position instead of being torn down mid-keystroke. */
function syncOtherCards(skipTz) {
  const hour12 = state.hourFormat === 12;
  els.list.querySelectorAll('.zone-card').forEach((card) => {
    const tz = card.dataset.tz;
    if (tz === skipTz) return;
    const parts = getZoneParts(tz, masterDate);
    const dateInput = card.querySelector('[data-role="date"]');
    const timeInput = card.querySelector('[data-role="time"]');
    if (dateInput) dateInput.value = parts.dateISO;
    if (timeInput) timeInput.value = hour12 ? `${pad(parts.hour12)}:${pad(parts.minute)}` : parts.pickerValue;
    const metaEl = card.querySelector('.zone-meta');
    if (metaEl) metaEl.textContent = `${abbrOf(tz, masterDate)} · ${longNameOf(tz, masterDate)}`;
    if (hour12) {
      const btns = card.querySelectorAll('.ampm-btn');
      if (btns[0]) btns[0].classList.toggle('active', parts.ampm === 'AM');
      if (btns[1]) btns[1].classList.toggle('active', parts.ampm === 'PM');
    }
  });
}

function renderDropdown(query) {
  const results = query ? searchTimeZones(query, 8) : POPULAR_ZONES.filter((tz) => !state.zones.includes(tz)).slice(0, 6);
  if (!results.length) {
    els.dropdown.innerHTML = `<div class="drop-empty">${query ? 'No matches' : 'All popular cities already added'}</div>`;
  } else {
    els.dropdown.innerHTML = results
      .map(
        (tz) => `
        <div class="drop-item" data-add="${tz}">
          <div style="min-width:0">
            <b>${displayName(tz)}</b>
            <div class="sub">${longNameOf(tz, masterDate)}</div>
          </div>
          <span class="time">${new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: state.hourFormat === 12 }).format(masterDate)}</span>
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
  url.searchParams.set('t', masterDate.toISOString());
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
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) {
    state.zones.splice(Number(removeBtn.dataset.remove), 1);
    saveState();
    renderList();
    updateOpenAppLink();
    return;
  }
  const ampmBtn = e.target.closest('[data-ampm]');
  if (ampmBtn) {
    const card = ampmBtn.closest('.zone-card');
    setLive(false);
    masterDate = withAmPm(masterDate, card.dataset.tz, ampmBtn.dataset.ampm);
    card.querySelectorAll('.ampm-btn').forEach((b) => b.classList.toggle('active', b === ampmBtn));
    syncOtherCards(card.dataset.tz);
    updateOpenAppLink();
  }
});

els.list.addEventListener('input', (e) => {
  const role = e.target.dataset.role;
  if (!role) return;
  // Stop the once-a-second live tick as soon as the user touches a field, *before* any parsing
  // that might bail out early below — otherwise a tick mid-keystroke (e.g. a native time input
  // reads as "" until both hour and minute are filled in) rebuilds the whole list and wipes
  // whatever they'd typed so far, which looks exactly like "won't let me edit".
  setLive(false);
  const card = e.target.closest('.zone-card');
  const tz = card.dataset.tz;
  const hour12 = state.hourFormat === 12;
  try {
    const dateVal = card.querySelector('[data-role="date"]').value;
    let timeVal = card.querySelector('[data-role="time"]').value;
    if (!dateVal || !timeVal) return;
    if (hour12 && role === 'time') {
      const activeBtn = card.querySelector('.ampm-btn.active');
      const parsed = parseTimeInput12(timeVal, activeBtn ? activeBtn.dataset.ampm : 'AM');
      if (!parsed) return;
      timeVal = parsed;
    }
    masterDate = zonedWallTimeToInstant(dateVal, timeVal, tz);
    syncOtherCards(tz);
    updateOpenAppLink();
  } catch {
    /* invalid intermediate input while typing -- ignore until it parses */
  }
});
els.list.addEventListener('focusin', (e) => {
  if (e.target.dataset.role) setLive(false);
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
els.nowBtn.addEventListener('click', () => {
  masterDate = new Date();
  setLive(true);
  renderList();
  updateOpenAppLink();
});

async function init() {
  await loadState();
  applyTheme();
  applyFormat();
  setLive(true);
  renderList();
  updateOpenAppLink();
  setInterval(() => {
    if (!isLive) return;
    masterDate = new Date();
    renderList();
    updateOpenAppLink();
  }, 1000);
}

init();
