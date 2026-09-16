import type { AppStore } from '@/lib/state';
import type { Command, HourFormat, SearchResult } from '@/types';
import { getSearchData, groupByRegion, searchTimeZones, POPULAR_ZONES } from '@/lib/timezones';
import { refreshIcons } from '@/lib/icons';

export interface SearchDeps {
  input: HTMLInputElement;
  dropdown: HTMLElement;
  store: AppStore;
  getMasterDate: () => Date;
  getHourFormat: () => HourFormat;
  onAddZone: (tz: string) => void;
  getCommands: () => Command[];
}

type FlatItem = { kind: 'command'; command: Command } | { kind: 'result'; result: SearchResult };

export function initSearch(deps: SearchDeps): { open: () => void; close: () => void } {
  const { input, dropdown, store, getMasterDate, getHourFormat, onAddZone, getCommands } = deps;
  let flatItems: FlatItem[] = [];
  let activeIndex = -1;

  function starIcon(tz: string): string {
    const active = store.isFavorite(tz);
    return `<button type="button" class="drop-star ${active ? 'active' : ''}" data-star="${tz}" title="${active ? 'Remove from favorites' : 'Add to favorites'}"><i data-lucide="star"></i></button>`;
  }

  function highlightMatch(text: string, query: string): string {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return `${text.slice(0, idx)}<mark>${text.slice(idx, idx + query.length)}</mark>${text.slice(idx + query.length)}`;
  }

  function resultRow(r: SearchResult, index: number, query = ''): string {
    return `
      <div class="drop-item" data-row-index="${index}">
        <div class="loc-info" data-add="${r.id}">
          <b>${highlightMatch(r.name, query)}</b>
          <span>${r.full} &middot; ${r.id}</span>
        </div>
        <div class="time-pre">${r.time}</div>
        ${starIcon(r.id)}
      </div>`;
  }

  function sectionLabel(text: string): string {
    return `<div class="drop-section-label">${text}</div>`;
  }

  function quickActionsRow(commands: Command[], startIndex: number): string {
    if (!commands.length) return '';
    return `<div class="quick-actions">${commands
      .map(
        (c, i) =>
          `<button type="button" class="quick-action" data-row-index="${startIndex + i}" data-cmd="${c.id}"><i data-lucide="${c.icon}"></i>${c.title}</button>`,
      )
      .join('')}</div>`;
  }

  function render(query: string): void {
    const hour12 = getHourFormat() === 12;
    const at = getMasterDate();
    flatItems = [];
    let html = '';

    const commands = getCommands().filter((c) =>
      query ? (c.keywords ?? c.title).toLowerCase().includes(query.toLowerCase()) : true,
    );

    if (!query) {
      const actionSlice = commands.slice(0, 4);
      actionSlice.forEach((command) => flatItems.push({ kind: 'command', command }));
      html += quickActionsRow(actionSlice, 0);

      if (store.favorites.length) {
        html += sectionLabel('Favorites');
        for (const tz of store.favorites) {
          const r = getSearchData(tz, hour12, at);
          flatItems.push({ kind: 'result', result: r });
          html += resultRow(r, flatItems.length - 1);
        }
      }
      if (store.recents.length) {
        html += sectionLabel('Recently added');
        for (const tz of store.recents) {
          const r = getSearchData(tz, hour12, at);
          flatItems.push({ kind: 'result', result: r });
          html += resultRow(r, flatItems.length - 1);
        }
      }
      html += sectionLabel('Popular');
      for (const tz of POPULAR_ZONES) {
        const r = getSearchData(tz, hour12, at);
        flatItems.push({ kind: 'result', result: r });
        html += resultRow(r, flatItems.length - 1);
      }
    } else {
      commands.forEach((command) => flatItems.push({ kind: 'command', command }));
      html += quickActionsRow(commands, 0);

      const results = searchTimeZones(query, hour12, at, 25);
      if (!results.length && !commands.length) {
        html += `<div class="drop-empty">No matches for &ldquo;${query}&rdquo;</div>`;
      } else {
        const groups = groupByRegion(results);
        for (const [region, items] of groups) {
          html += sectionLabel(region);
          for (const r of items) {
            flatItems.push({ kind: 'result', result: r });
            html += resultRow(r, flatItems.length - 1, query);
          }
        }
      }
    }

    dropdown.innerHTML = html;
    refreshIcons();
    activeIndex = -1;
    dropdown.classList.add('open');
  }

  function close(): void {
    dropdown.classList.remove('open');
    activeIndex = -1;
  }

  function open(): void {
    render(input.value.trim());
  }

  function setActive(index: number): void {
    const rows = dropdown.querySelectorAll<HTMLElement>('[data-row-index]');
    rows.forEach((row) => row.classList.remove('kb-active'));
    if (index < 0 || index >= flatItems.length) {
      activeIndex = -1;
      return;
    }
    activeIndex = index;
    const el = dropdown.querySelector<HTMLElement>(`[data-row-index="${index}"]`);
    el?.classList.add('kb-active');
    el?.scrollIntoView({ block: 'nearest' });
  }

  function activate(index: number): void {
    const item = flatItems[index];
    if (!item) return;
    if (item.kind === 'command') item.command.run();
    else {
      onAddZone(item.result.id);
      input.value = '';
      close();
    }
  }

  input.addEventListener('input', () => render(input.value.trim()));
  input.addEventListener('focus', () => render(input.value.trim()));

  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) activate(activeIndex);
      else if (flatItems.length) activate(0);
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });

  dropdown.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const starBtn = target.closest<HTMLElement>('[data-star]');
    if (starBtn) {
      e.stopPropagation();
      store.toggleFavorite(starBtn.dataset.star!);
      render(input.value.trim());
      return;
    }
    const cmdBtn = target.closest<HTMLElement>('[data-cmd]');
    if (cmdBtn) {
      const cmd = getCommands().find((c) => c.id === cmdBtn.dataset.cmd);
      cmd?.run();
      return;
    }
    const addEl = target.closest<HTMLElement>('[data-add]');
    if (addEl) {
      onAddZone(addEl.dataset.add!);
      input.value = '';
      close();
    }
  });

  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.search-area')) close();
  });

  return { open, close };
}
