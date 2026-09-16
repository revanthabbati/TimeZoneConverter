import type { AppStore } from '@/lib/state';
import type { HourFormat } from '@/types';
import { BROWSER_TZ, abbrOf, displayName, sameZone } from '@/lib/timezones';
import { getZoneParts } from '@/lib/time';

export interface TimelineViewDeps {
  container: HTMLElement;
  store: AppStore;
  getMasterDate: () => Date;
  setMasterDate: (d: Date) => void;
  getHourFormat: () => HourFormat;
}

const PAST_HOURS = 3;
const WINDOW_HOURS = 24;

function windowStartFor(at: Date): Date {
  const start = new Date(at);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - PAST_HOURS);
  return start;
}

function cellHourLabel(tz: string, at: Date, hour12: boolean): string {
  if (hour12) {
    const { hour12: h, ampm } = getZoneParts(tz, at);
    return `${h}${ampm[0]?.toLowerCase()}`;
  }
  const { hour24 } = getZoneParts(tz, at);
  return String(hour24);
}

function shadeClass(hour24: number): string {
  if (hour24 >= 9 && hour24 < 18) return 'business';
  if ((hour24 >= 6 && hour24 < 9) || (hour24 >= 18 && hour24 < 21)) return 'twilight';
  return 'night';
}

function localDateKey(tz: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
}

function isWeekendAt(tz: string, at: Date): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(at);
  return weekday === 'Sat' || weekday === 'Sun';
}

export function createTimelineView(deps: TimelineViewDeps) {
  const { container, store, getMasterDate, setMasterDate, getHourFormat } = deps;

  function rowsToShow(): string[] {
    const zones = [...store.zones];
    if (!zones.some((z) => sameZone(z, BROWSER_TZ))) zones.unshift(BROWSER_TZ);
    return zones;
  }

  function trackHtml(tz: string, windowStart: Date, nowFraction: number): string {
    const hour12 = getHourFormat() === 12;
    let prevDateKey = '';
    let cells = '';
    for (let i = 0; i < WINDOW_HOURS; i++) {
      const cellAt = new Date(windowStart.getTime() + i * 3_600_000);
      const { hour24 } = getZoneParts(tz, cellAt);
      const dateKey = localDateKey(tz, cellAt);
      const isBoundary = i > 0 && dateKey !== prevDateKey;
      prevDateKey = dateKey;
      const classes = [
        'timeline-cell',
        shadeClass(hour24),
        isWeekendAt(tz, cellAt) ? 'weekend' : '',
        isBoundary ? 'date-boundary' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const pill = isBoundary
        ? `<span class="date-pill">${new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(cellAt)}</span>`
        : '';
      cells += `<div class="${classes}" data-cell="${i}">${pill}${cellHourLabel(tz, cellAt, hour12)}</div>`;
    }
    const leftPct = Math.min(100, Math.max(0, nowFraction * 100));
    return `${cells}<div class="now-line" style="left:${leftPct}%"></div>`;
  }

  function render(): void {
    const at = getMasterDate();
    const windowStart = windowStartFor(at);
    const nowFraction = (at.getTime() - windowStart.getTime()) / (WINDOW_HOURS * 3_600_000);
    const zones = rowsToShow();

    if (!store.zones.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="globe-2"></i>
          <h3>No timezones added yet</h3>
          <p>Search above to add a city, then drag across the timeline to plan a meeting.</p>
        </div>`;
      return;
    }

    const legend = `
      <div class="timeline-legend">
        <span><span class="dot" style="background:var(--hour-business)"></span>Business hours</span>
        <span><span class="dot" style="background:var(--hour-twilight)"></span>Early/late</span>
        <span><span class="dot" style="background:var(--hour-night)"></span>Overnight</span>
      </div>`;

    const rows = zones
      .map((tz) => {
        const parts = getZoneParts(tz, at);
        const isYou = tz === BROWSER_TZ && !store.zones.some((z) => sameZone(z, BROWSER_TZ));
        return `
        <div class="timeline-row ${isYou ? 'you' : ''}" data-tz="${tz}">
          <div class="timeline-label">
            <div class="tl-name">${displayName(tz)} ${isYou ? '<span class="tl-tag">You</span>' : ''}</div>
            <div class="tl-meta">${parts.pickerValue} &middot; ${abbrOf(tz, at)}</div>
          </div>
          <div class="timeline-track" data-track="${tz}">${trackHtml(tz, windowStart, nowFraction)}</div>
        </div>`;
      })
      .join('');

    container.innerHTML = `
      ${legend}
      <div class="timeline-view">${rows}</div>
      <div class="timeline-hint">Click or drag anywhere on the timeline to change the time for every zone.</div>
    `;

    bindTracks();
  }

  function instantFromPointer(track: HTMLElement, clientX: number): Date {
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const at = getMasterDate();
    const windowStart = windowStartFor(at);
    const ms = windowStart.getTime() + fraction * WINDOW_HOURS * 3_600_000;
    const rounded = Math.round(ms / (5 * 60_000)) * 5 * 60_000;
    return new Date(rounded);
  }

  function bindTracks(): void {
    container.querySelectorAll<HTMLElement>('.timeline-track').forEach((track) => {
      let dragging = false;

      const move = (clientX: number) => {
        setMasterDate(instantFromPointer(track, clientX));
        render();
      };

      track.addEventListener('pointerdown', (e) => {
        dragging = true;
        track.setPointerCapture(e.pointerId);
        move(e.clientX);
      });
      track.addEventListener('pointermove', (e) => {
        if (dragging) move(e.clientX);
      });
      track.addEventListener('pointerup', () => {
        dragging = false;
      });
      track.addEventListener('pointercancel', () => {
        dragging = false;
      });
    });
  }

  return { render };
}
