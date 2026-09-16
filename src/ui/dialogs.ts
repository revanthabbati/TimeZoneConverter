import { openOverlay } from './overlay';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { showToast } from './toast';
import type { HourFormat } from '@/types';

export function openShortcutsModal(): void {
  const shortcuts: [string, string][] = [
    ['Ctrl / Cmd + K', 'Focus search &amp; quick actions'],
    ['/', 'Focus search'],
    ['T', 'Cycle theme'],
    ['F', 'Toggle 12h / 24h format'],
    ['V', 'Switch cards / timeline view'],
    ['Ctrl / Cmd + Shift + C', 'Copy shareable link'],
    ['?', 'Show this list'],
    ['Esc', 'Close any panel'],
  ];

  const html = `
    <div class="modal-header">
      <h2>Keyboard shortcuts</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body">
      ${shortcuts
        .map(
          ([keys, desc]) => `
        <div class="shortcut-row">
          <span>${desc}</span>
          <span class="keys">${keys
            .split('+')
            .map((k) => `<kbd>${k.trim()}</kbd>`)
            .join('<span>+</span>')}</span>
        </div>`,
        )
        .join('')}
    </div>
  `;

  const overlay = openOverlay('modal', html);
  overlay.root.querySelector('[data-close]')?.addEventListener('click', overlay.close);
}

export interface ExportDialogDeps {
  zones: string[];
  at: Date;
  hourFormat: HourFormat;
}

export function openExportDialog(deps: ExportDialogDeps): void {
  const html = `
    <div class="modal-header">
      <h2>Export to calendar</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body">
      <div class="field-group">
        <label for="ics-title">Event title</label>
        <input type="text" id="ics-title" value="Meeting" data-autofocus />
      </div>
      <div class="field-group">
        <label for="ics-duration">Duration</label>
        <select id="ics-duration">
          <option value="15">15 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
        </select>
      </div>
      <p class="hint">Downloads a .ics file at the currently selected time, with every zone's local time listed in the event description.</p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancel</button>
        <button type="button" class="btn-primary" data-download><i data-lucide="calendar-plus"></i>Download .ics</button>
      </div>
    </div>
  `;

  const overlay = openOverlay('modal', html);
  const root = overlay.root;
  root.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', overlay.close));

  root.querySelector('[data-download]')?.addEventListener('click', () => {
    const title = root.querySelector<HTMLInputElement>('#ics-title')?.value.trim() || 'Meeting';
    const duration = Number(root.querySelector<HTMLSelectElement>('#ics-duration')?.value ?? '30');
    const ics = buildIcs({
      start: deps.at,
      durationMinutes: duration,
      title,
      zones: deps.zones,
      hour12: deps.hourFormat === 12,
    });
    downloadIcs(title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'meeting', ics);
    showToast('Calendar file downloaded', 'calendar-plus');
    overlay.close();
  });
}
