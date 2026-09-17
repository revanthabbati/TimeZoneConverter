import type { AppStore } from '@/lib/state';
import type { HourFormat } from '@/types';
import { BROWSER_TZ, abbrOf, displayName, sameZone } from '@/lib/timezones';
import { dayPhase, getZoneParts } from '@/lib/time';
import { refreshIcons } from '@/lib/icons';

export interface TimelineViewDeps {
  container: HTMLElement;
  store: AppStore;
  getMasterDate: () => Date;
  setMasterDate: (d: Date) => void;
  getHourFormat: () => HourFormat;
}

const PAST_HOURS = 3;
const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 3_600_000;
const PHASE_ICON = { dawn: 'sunrise', day: 'sun', dusk: 'sunset', night: 'moon' } as const;

function recenteredWindowStart(at: Date): Date {
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

function isBusinessHours(tz: string, at: Date): boolean {
  const { hour24 } = getZoneParts(tz, at);
  return hour24 >= 9 && hour24 < 18 && !isWeekendAt(tz, at);
}

export function createTimelineView(deps: TimelineViewDeps) {
  const { container, store, getMasterDate, setMasterDate, getHourFormat } = deps;

  // The visible 24h window is intentionally decoupled from the live-scrubbed instant: it only
  // re-centers when the selected time falls outside it (first render, "Now", editing a card to a
  // far-off time, prev/next-day paging). Otherwise dragging within the track would make the whole
  // window recenter under the cursor on every pointermove, which feels unusable.
  let windowAnchor: Date | null = null;
  let dragTip: HTMLElement | null = null;

  function windowStartFor(at: Date): Date {
    if (
      !windowAnchor ||
      at.getTime() < windowAnchor.getTime() ||
      at.getTime() >= windowAnchor.getTime() + WINDOW_MS
    ) {
      windowAnchor = recenteredWindowStart(at);
    }
    return windowAnchor;
  }

  function rowsToShow(): string[] {
    const zones = [...store.zones];
    if (!zones.some((z) => sameZone(z, BROWSER_TZ))) zones.unshift(BROWSER_TZ);
    return zones;
  }

  /** Which of the 24 columns have every zone simultaneously in business hours. */
  function computeOverlap(zones: string[], windowStart: Date): boolean[] {
    const overlap: boolean[] = [];
    for (let i = 0; i < WINDOW_HOURS; i++) {
      const cellAt = new Date(windowStart.getTime() + i * 3_600_000);
      overlap.push(zones.every((tz) => isBusinessHours(tz, cellAt)));
    }
    return overlap;
  }

  function overlapRulerHtml(overlap: boolean[]): string {
    const anyGood = overlap.some(Boolean);
    const cells = overlap.map((good) => `<div class="overlap-cell ${good ? 'good' : ''}"></div>`).join('');
    return `
      <div class="overlap-ruler">
        <div class="overlap-ruler-label" title="Hours where every zone below is in business hours (9am-6pm, weekdays)">
          <i data-lucide="users"></i> ${anyGood ? 'Good time to meet' : 'No fully-overlapping hours'}
        </div>
        <div class="overlap-ruler-track">${cells}</div>
      </div>`;
  }

  function nowLinePct(at: Date, windowStart: Date): number {
    return Math.min(100, Math.max(0, ((at.getTime() - windowStart.getTime()) / WINDOW_MS) * 100));
  }

  function trackHtml(tz: string, windowStart: Date, at: Date): string {
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
    return `${cells}<div class="now-line" style="left:${nowLinePct(at, windowStart)}%"><span class="now-grip"></span></div>`;
  }

  function shiftWindow(deltaHours: number): void {
    setMasterDate(new Date(getMasterDate().getTime() + deltaHours * 3_600_000));
    render();
  }

  function jumpToNextGood(overlap: boolean[], windowStart: Date): void {
    const at = getMasterDate();
    const currentIdx = Math.floor((at.getTime() - windowStart.getTime()) / 3_600_000);
    for (let step = 1; step <= WINDOW_HOURS; step++) {
      const idx = (currentIdx + step) % WINDOW_HOURS;
      if (overlap[idx]) {
        setMasterDate(new Date(windowStart.getTime() + idx * 3_600_000 + 30 * 60_000));
        render();
        return;
      }
    }
  }

  function render(): void {
    const at = getMasterDate();

    if (!store.zones.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="globe-2"></i>
          <h3>No timezones added yet</h3>
          <p>Search above to add a city, then drag across the timeline to plan a meeting.</p>
        </div>`;
      refreshIcons();
      return;
    }

    const windowStart = windowStartFor(at);
    const zones = rowsToShow();
    const overlap = computeOverlap(zones, windowStart);

    const toolbar = `
      <div class="timeline-toolbar">
        <div class="timeline-legend">
          <span><span class="dot" style="background:var(--hour-business)"></span>Business hours</span>
          <span><span class="dot" style="background:var(--hour-twilight)"></span>Early/late</span>
          <span><span class="dot" style="background:var(--hour-night)"></span>Overnight</span>
        </div>
        <div class="timeline-nav">
          <button type="button" class="icon-btn" data-shift="-24" title="Same time yesterday" aria-label="Go back one day"><i data-lucide="chevron-left"></i></button>
          <button type="button" class="tool-btn" data-jump-good>Find good time</button>
          <button type="button" class="icon-btn" data-shift="24" title="Same time tomorrow" aria-label="Go forward one day"><i data-lucide="chevron-right"></i></button>
        </div>
      </div>`;

    const rows = zones
      .map((tz) => {
        const parts = getZoneParts(tz, at);
        const isYou = tz === BROWSER_TZ && !store.zones.some((z) => sameZone(z, BROWSER_TZ));
        const fav = store.isFavorite(tz);
        const phase = dayPhase(parts.hour24);
        return `
        <div class="timeline-row ${isYou ? 'you' : ''}" data-tz="${tz}">
          <div class="timeline-label">
            <span class="tl-phase phase-${phase}"><i data-lucide="${PHASE_ICON[phase]}"></i></span>
            <div class="tl-text">
              <div class="tl-name">${displayName(tz)} ${isYou ? '<span class="tl-tag">You</span>' : ''}</div>
              <div class="tl-meta">${parts.pickerValue} &middot; ${abbrOf(tz, at)}</div>
            </div>
            <div class="tl-actions">
              <button type="button" class="icon-btn sm ${fav ? 'active-star' : ''}" data-tl-fav="${tz}" aria-label="Toggle favorite"><i data-lucide="star"></i></button>
              ${!isYou ? `<button type="button" class="icon-btn sm" data-tl-remove="${tz}" aria-label="Remove ${displayName(tz)}"><i data-lucide="trash-2"></i></button>` : ''}
            </div>
          </div>
          <div class="timeline-track" data-track="${tz}">${trackHtml(tz, windowStart, at)}</div>
        </div>`;
      })
      .join('');

    container.innerHTML = `
      ${toolbar}
      ${overlapRulerHtml(overlap)}
      <div class="timeline-view">${rows}</div>
      <div class="timeline-hint">Drag anywhere on the timeline to change the time for every zone &mdash; or click a track to jump straight there.</div>
    `;

    dragTip = null;

    container.querySelector('[data-jump-good]')?.addEventListener('click', () => jumpToNextGood(overlap, windowStart));
    container.querySelectorAll<HTMLElement>('[data-shift]').forEach((btn) => {
      btn.addEventListener('click', () => shiftWindow(Number(btn.dataset.shift)));
    });
    container.querySelectorAll<HTMLElement>('[data-tl-fav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.toggleFavorite(btn.dataset.tlFav!);
        render();
      });
    });
    container.querySelectorAll<HTMLElement>('[data-tl-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = store.zones.indexOf(btn.dataset.tlRemove!);
        if (idx >= 0) store.removeZone(idx);
        render();
      });
    });

    refreshIcons();
    bindTracks();
  }

  /** Cheap, DOM-preserving update used while actively dragging: repositions now-lines and
   * refreshes each row's live time text, without touching cell shading or rebuilding any nodes
   * (which would drop pointer capture mid-drag and fight the fixed drag window above). */
  function syncScrub(at: Date, windowStart: Date): void {
    const pct = `${nowLinePct(at, windowStart)}%`;
    container.querySelectorAll<HTMLElement>('.now-line').forEach((line) => {
      line.style.left = pct;
    });

    container.querySelectorAll<HTMLElement>('.timeline-row').forEach((row) => {
      const tz = row.dataset.tz;
      if (!tz) return;
      const parts = getZoneParts(tz, at);
      const metaEl = row.querySelector('.tl-meta');
      if (metaEl) metaEl.textContent = `${parts.pickerValue} · ${abbrOf(tz, at)}`;
    });
  }

  function instantFromFraction(fraction: number, windowStart: Date): Date {
    const ms = windowStart.getTime() + fraction * WINDOW_MS;
    const rounded = Math.round(ms / (5 * 60_000)) * 5 * 60_000;
    return new Date(rounded);
  }

  function fractionFromPointer(track: HTMLElement, clientX: number): number {
    const rect = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function ensureDragTip(): HTMLElement {
    if (!dragTip || !dragTip.isConnected) {
      dragTip = document.createElement('div');
      dragTip.className = 'scrub-tip';
      container.querySelector('.timeline-view')?.appendChild(dragTip);
    }
    return dragTip;
  }

  function showDragTip(fraction: number, target: Date): void {
    const tip = ensureDragTip();
    tip.textContent = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(target);
    tip.style.left = `${Math.min(100, Math.max(0, fraction * 100))}%`;
    tip.classList.add('visible');
  }

  function hideDragTip(): void {
    dragTip?.classList.remove('visible');
  }

  function bindTracks(): void {
    // The window is fixed for the lifetime of a single drag gesture (captured once on
    // pointerdown), so scrubbing never fights its own reference frame mid-drag.
    let dragWindowStart: Date | null = null;

    container.querySelectorAll<HTMLElement>('.timeline-track').forEach((track) => {
      const move = (clientX: number) => {
        if (!dragWindowStart) return;
        const fraction = fractionFromPointer(track, clientX);
        const target = instantFromFraction(fraction, dragWindowStart);
        setMasterDate(target);
        syncScrub(target, dragWindowStart);
        showDragTip(fraction, target);
      };

      track.addEventListener('pointerdown', (e) => {
        dragWindowStart = windowStartFor(getMasterDate());
        track.setPointerCapture(e.pointerId);
        move(e.clientX);
      });
      track.addEventListener('pointermove', (e) => {
        if (dragWindowStart) move(e.clientX);
      });
      track.addEventListener('pointerup', () => {
        dragWindowStart = null;
        hideDragTip();
        render();
      });
      track.addEventListener('pointercancel', () => {
        dragWindowStart = null;
        hideDragTip();
        render();
      });
    });
  }

  return { render };
}
