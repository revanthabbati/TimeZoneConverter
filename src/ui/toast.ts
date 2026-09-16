import { refreshIcons } from '@/lib/icons';

let stack: HTMLElement | null = null;

function ensureStack(): HTMLElement {
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

export function showToast(message: string, icon = 'check-circle-2'): void {
  const container = ensureStack();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  container.appendChild(el);
  refreshIcons();

  window.setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 2600);
}
