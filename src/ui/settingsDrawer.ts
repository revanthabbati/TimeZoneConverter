import type { AppStore } from '@/lib/state';
import type { ThemeMode, ViewMode } from '@/types';
import { openOverlay } from './overlay';
import { showToast } from './toast';

export interface SettingsDeps {
  store: AppStore;
  onThemeChange: (theme: ThemeMode) => void;
  onFormatChange: (is24h: boolean) => void;
  onViewChange: (view: ViewMode) => void;
  onResetAll: () => void;
}

export function openSettingsDrawer(deps: SettingsDeps): void {
  const { store, onThemeChange, onFormatChange, onViewChange, onResetAll } = deps;
  const s = store.settings;

  const html = `
    <div class="modal-header">
      <h2>Settings</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close settings"><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <h4>Appearance</h4>
        <div class="settings-row">
          <span class="label">Theme</span>
          <div class="segmented" data-theme-group>
            <button type="button" data-theme-opt="light" class="${s.theme === 'light' ? 'active' : ''}"><i data-lucide="sun"></i>Light</button>
            <button type="button" data-theme-opt="dark" class="${s.theme === 'dark' ? 'active' : ''}"><i data-lucide="moon"></i>Dark</button>
            <button type="button" data-theme-opt="system" class="${s.theme === 'system' ? 'active' : ''}"><i data-lucide="monitor"></i>Auto</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="label">Time format</span>
          <div class="segmented" data-format-group>
            <button type="button" data-format-opt="12" class="${s.hourFormat === 12 ? 'active' : ''}">12h</button>
            <button type="button" data-format-opt="24" class="${s.hourFormat === 24 ? 'active' : ''}">24h</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="label">Default view</span>
          <div class="segmented" data-view-group>
            <button type="button" data-view-opt="cards" class="${s.view === 'cards' ? 'active' : ''}"><i data-lucide="layout-grid"></i>Cards</button>
            <button type="button" data-view-opt="timeline" class="${s.view === 'timeline' ? 'active' : ''}"><i data-lucide="gantt-chart-square"></i>Timeline</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h4>Your data</h4>
        <p class="hint" style="margin-bottom:10px;">Everything is stored only in this browser — nothing is sent to a server.</p>
        <div class="settings-row">
          <span class="label">Export saved zones &amp; settings</span>
          <button type="button" class="btn-secondary" data-export-json>Export JSON</button>
        </div>
        <div class="settings-row">
          <span class="label">Import from a file</span>
          <button type="button" class="btn-secondary" data-import-json>Import JSON</button>
          <input type="file" accept="application/json" style="display:none" data-import-input />
        </div>
      </div>

      <div class="settings-section">
        <h4>Danger zone</h4>
        <button type="button" class="btn-danger-ghost" data-reset-all>Reset all data</button>
      </div>
    </div>
  `;

  const overlay = openOverlay('drawer', html);
  const root = overlay.root;

  root.querySelector('[data-close]')?.addEventListener('click', overlay.close);

  root.querySelectorAll<HTMLElement>('[data-theme-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeOpt as ThemeMode;
      onThemeChange(theme);
      root.querySelectorAll('[data-theme-opt]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  root.querySelectorAll<HTMLElement>('[data-format-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onFormatChange(btn.dataset.formatOpt === '24');
      root.querySelectorAll('[data-format-opt]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  root.querySelectorAll<HTMLElement>('[data-view-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onViewChange(btn.dataset.viewOpt as ViewMode);
      root.querySelectorAll('[data-view-opt]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  root.querySelector('[data-export-json]')?.addEventListener('click', () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timezone-converter-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Settings exported', 'download');
  });

  const importInput = root.querySelector<HTMLInputElement>('[data-import-input]')!;
  root.querySelector('[data-import-json]')?.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store.importData(text);
      showToast('Settings imported — reloading', 'check-circle-2');
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      showToast('That file could not be imported', 'alert-triangle');
    }
  });

  root.querySelector('[data-reset-all]')?.addEventListener('click', () => {
    const btn = root.querySelector<HTMLButtonElement>('[data-reset-all]')!;
    if (btn.dataset.confirming === 'true') {
      onResetAll();
      overlay.close();
    } else {
      btn.dataset.confirming = 'true';
      btn.textContent = 'Click again to confirm';
      window.setTimeout(() => {
        btn.dataset.confirming = 'false';
        btn.textContent = 'Reset all data';
      }, 3000);
    }
  });
}
