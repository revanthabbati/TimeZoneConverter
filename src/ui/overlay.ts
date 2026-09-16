import { refreshIcons } from '@/lib/icons';

export interface OverlayHandle {
  root: HTMLElement;
  close: () => void;
}

/** Shared mount/teardown for the settings drawer, shortcuts modal, and export dialog. */
export function openOverlay(kind: 'modal' | 'drawer', innerHtml: string): OverlayHandle {
  const backdrop = document.createElement('div');
  backdrop.className = kind === 'modal' ? 'overlay-backdrop' : 'drawer-backdrop';

  const panel = document.createElement('div');
  panel.className = kind === 'modal' ? 'modal-panel' : 'drawer-panel';
  panel.innerHTML = innerHtml;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  if (kind === 'modal') {
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
  } else {
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  }

  const previouslyFocused = document.activeElement as HTMLElement | null;

  function close(): void {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    panel.remove();
    previouslyFocused?.focus?.();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);

  refreshIcons();
  panel.querySelector<HTMLElement>('[data-autofocus]')?.focus();

  return { root: panel, close };
}
