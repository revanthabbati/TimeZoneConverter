import type { AppStore } from '@/lib/state';
import type { HourFormat } from '@/types';
import { BROWSER_TZ, POPULAR_ZONES, abbrOf, displayName, longNameOf, offsetDiffMinutes, sameZone } from '@/lib/timezones';
import {
  clockHandDegrees,
  dayPhase,
  getZoneParts,
  isWeekendIn,
  parseTimeInput,
  relativeOffsetLabel,
  withAmPm,
  zonedWallTimeToInstant,
} from '@/lib/time';
import { refreshIcons } from '@/lib/icons';
import { showToast } from './toast';

const PHASE_ICON = { dawn: 'sunrise', day: 'sun', dusk: 'sunset', night: 'moon' } as const;

export interface CardsViewDeps {
  container: HTMLElement;
  store: AppStore;
  getMasterDate: () => Date;
  /** Updates the shared master instant only — callers decide how to re-render. */
  setMasterDate: (d: Date) => void;
  getHourFormat: () => HourFormat;
  onAddZone: (tz: string) => void;
}

export function createCardsView(deps: CardsViewDeps) {
  const { container, store, getMasterDate, setMasterDate, getHourFormat, onAddZone } = deps;

  function render(): void {
    const at = getMasterDate();
    const hour12 = getHourFormat() === 12;
    container.innerHTML = '';

    if (!store.zones.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="globe-2"></i>
          <h3>No timezones added yet</h3>
          <p>Search above, or try one of these:</p>
          <div class="chip-row">
            ${POPULAR_ZONES.slice(0, 6)
              .map((tz) => `<button type="button" class="chip" data-quick-add="${tz}">${displayName(tz)}</button>`)
              .join('')}
          </div>
        </div>`;
      refreshIcons();
      return;
    }

    store.zones.forEach((tz, i) => {
      const { hour24: hh, minute: mm, ampm, dateISO, pickerValue } = getZoneParts(tz, at);
      const hour12Val = hh % 12 || 12;
      const dispTime = hour12
        ? `${hour12Val.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
        : pickerValue;
      const fullTz = longNameOf(tz, at);
      const gmt = abbrOf(tz, at);
      const weekend = isWeekendIn(tz, at);
      const { hourDeg, minuteDeg } = clockHandDegrees(hh, mm);
      const fav = store.isFavorite(tz);
      const phase = dayPhase(hh);
      const isYou = sameZone(tz, BROWSER_TZ, at);
      const offset = relativeOffsetLabel(offsetDiffMinutes(tz, BROWSER_TZ, at));

      const card = document.createElement('div');
      card.className = `card phase-${phase}`;
      card.draggable = true;
      card.dataset.index = String(i);
      card.dataset.tz = tz;
      card.style.animationDelay = `${Math.min(i, 8) * 40}ms`;
      card.innerHTML = `
        <div class="card-left">
          <div class="clock-wrap">
            <svg class="clock-svg" viewBox="0 0 100 100">
              <circle class="clock-face" cx="50" cy="50" r="45" />
              ${Array.from({ length: 12 })
                .map((_, j) => `<line class="clock-tick" x1="50" y1="8" x2="50" y2="14" transform="rotate(${j * 30} 50 50)" />`)
                .join('')}
              <line class="clock-hand h-hand" x1="50" y1="50" x2="50" y2="30" style="transform: rotate(${hourDeg}deg)"/>
              <line class="clock-hand m-hand" x1="50" y1="50" x2="50" y2="18" style="transform: rotate(${minuteDeg}deg)"/>
              <circle cx="50" cy="50" r="3" fill="var(--primary)"/>
            </svg>
            <span class="phase-badge phase-${phase}" title="${phase}"><i data-lucide="${PHASE_ICON[phase]}"></i></span>
          </div>
          <div class="card-info">
            <div class="name-row">
              <h3>${displayName(tz)}</h3>
              ${isYou ? '<span class="tl-tag">You</span>' : ''}
              <button type="button" class="star-btn ${fav ? 'active' : ''}" data-fav="${tz}" title="${fav ? 'Unfavorite' : 'Favorite'}" aria-label="Toggle favorite"><i data-lucide="star"></i></button>
            </div>
            <span class="tz-full">${fullTz}</span>
            <div class="badge-row">
              <span class="badge">${gmt}</span>
              <span class="badge offset">${offset.label}</span>
              ${weekend ? '<span class="badge weekend">Weekend</span>' : ''}
              <span class="badge muted">${tz}</span>
            </div>
          </div>
        </div>
        <div class="card-right">
          <button type="button" class="icon-btn" data-copy="${tz}" title="Copy formatted time" aria-label="Copy time"><i data-lucide="copy"></i></button>
          <div class="input-box"><label>Date</label><input type="date" value="${dateISO}" data-role="date" aria-label="Date in ${displayName(tz)}"></div>
          <div class="input-box">
            <label>Time</label>
            <div class="time-wrapper">
              <input type="${hour12 ? 'text' : 'time'}" value="${dispTime}" data-role="time" aria-label="Time in ${displayName(tz)}">
              ${
                hour12
                  ? `
                <div class="picker-container">
                  <i data-lucide="clock"></i>
                  <input type="time" class="native-hidden-input" value="${pickerValue}" data-role="picker" aria-label="Pick time in ${displayName(tz)}">
                </div>
                <div class="ampm-toggle">
                  <button type="button" class="ampm-btn ${ampm === 'AM' ? 'active' : ''}" data-ampm="AM">AM</button>
                  <button type="button" class="ampm-btn ${ampm === 'PM' ? 'active' : ''}" data-ampm="PM">PM</button>
                </div>`
                  : ''
              }
            </div>
          </div>
          <button type="button" class="icon-btn btn-del" data-remove="${i}" aria-label="Remove ${displayName(tz)}"><i data-lucide="trash-2"></i></button>
        </div>
      `;

      card.addEventListener('dragstart', () => card.classList.add('dragging'));
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        updateZoneOrder();
      });

      container.appendChild(card);
    });

    refreshIcons();
  }

  function sync(skipTz?: string): void {
    const at = getMasterDate();
    const hour12 = getHourFormat() === 12;
    const cards = container.querySelectorAll<HTMLElement>('.card');
    store.zones.forEach((tz, i) => {
      const card = cards[i];
      if (!card) return;
      const { hour24: hh, minute: mm } = getZoneParts(tz, at);
      const { hourDeg, minuteDeg } = clockHandDegrees(hh, mm);
      const hHand = card.querySelector<HTMLElement>('.h-hand');
      const mHand = card.querySelector<HTMLElement>('.m-hand');
      if (hHand) hHand.style.transform = `rotate(${hourDeg}deg)`;
      if (mHand) mHand.style.transform = `rotate(${minuteDeg}deg)`;
      if (tz === skipTz) return;

      const hour12Val = hh % 12 || 12;
      const disp = hour12
        ? `${hour12Val.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
        : `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      const timeInput = card.querySelector<HTMLInputElement>('[data-role="time"]');
      const dateInput = card.querySelector<HTMLInputElement>('[data-role="date"]');
      if (timeInput) timeInput.value = disp;
      if (dateInput) dateInput.value = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);

      if (hour12) {
        const btns = card.querySelectorAll<HTMLElement>('.ampm-btn');
        btns[0]?.classList.toggle('active', hh < 12);
        btns[1]?.classList.toggle('active', hh >= 12);
      }
    });
  }

  function updateZoneOrder(): void {
    const cards = [...container.querySelectorAll<HTMLElement>('.card')];
    const newOrder = cards.map((c) => store.zones[Number(c.dataset.index)]).filter((z): z is string => !!z);
    store.reorderZones(newOrder);
    render();
  }

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = container.querySelector<HTMLElement>('.dragging');
    if (!dragging) return;
    const after = getDragAfterElement(container, e.clientY);
    if (after == null) container.appendChild(dragging);
    else container.insertBefore(dragging, after);
  });

  function getDragAfterElement(c: HTMLElement, y: number): Element | null {
    const draggables = [...c.querySelectorAll('.card:not(.dragging)')];
    return draggables.reduce<{ offset: number; element: Element | null }>(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null },
    ).element;
  }

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const quickAdd = target.closest<HTMLElement>('[data-quick-add]');
    if (quickAdd) {
      onAddZone(quickAdd.dataset.quickAdd!);
      return;
    }

    const favBtn = target.closest<HTMLElement>('[data-fav]');
    if (favBtn) {
      store.toggleFavorite(favBtn.dataset.fav!);
      render();
      return;
    }

    const removeBtn = target.closest<HTMLElement>('[data-remove]');
    if (removeBtn) {
      store.removeZone(Number(removeBtn.dataset.remove));
      render();
      return;
    }

    const copyBtn = target.closest<HTMLElement>('[data-copy]');
    if (copyBtn) {
      const tz = copyBtn.dataset.copy!;
      const label = `${displayName(tz)}: ${new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: getHourFormat() === 12,
      }).format(getMasterDate())} (${abbrOf(tz, getMasterDate())})`;
      navigator.clipboard?.writeText(label).then(() => showToast('Time copied to clipboard', 'copy'));
      return;
    }

    const ampmBtn = target.closest<HTMLElement>('[data-ampm]');
    if (ampmBtn) {
      const card = ampmBtn.closest<HTMLElement>('.card')!;
      const tz = card.dataset.tz!;
      setMasterDate(withAmPm(getMasterDate(), tz, ampmBtn.dataset.ampm as 'AM' | 'PM'));
      sync();
    }
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const card = target.closest<HTMLElement>('.card');
    if (!card) return;
    const tz = card.dataset.tz!;
    const role = target.dataset.role;
    if (!role) return;

    try {
      const dateVal = card.querySelector<HTMLInputElement>('[data-role="date"]')!.value;
      const hour12 = getHourFormat() === 12;

      if (role === 'picker') {
        // Came from the native OS time popup, not the visible text field: re-render fully
        // so this card's own displayed time and AM/PM state pick up the chosen value too.
        setMasterDate(zonedWallTimeToInstant(dateVal, target.value, tz));
        render();
        return;
      }

      let timeVal = card.querySelector<HTMLInputElement>('[data-role="time"]')!.value;
      if (role === 'time' && hour12) {
        const active = card.querySelector<HTMLElement>('.ampm-btn.active');
        const ampm = (active?.textContent as 'AM' | 'PM') ?? 'AM';
        const parsed = parseTimeInput(timeVal, true, ampm);
        if (!parsed) return;
        timeVal = parsed;
      }
      setMasterDate(zonedWallTimeToInstant(dateVal, timeVal, tz));
      sync(tz);
    } catch {
      /* invalid intermediate input while typing — ignore until it parses */
    }
  });

  return { render, sync };
}
