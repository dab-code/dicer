import { totalModifier } from '../core/notation';
import type { RollResult } from '../core/types';

export interface Toast {
  show(result: RollResult): void;
  hide(): void;
}

/**
 * Result popup sliding in from the top. Stays visible until the next roll
 * starts (main.ts calls hide()) or the user dismisses it.
 */
export function createToast(container: HTMLElement): Toast {
  const el = document.createElement('div');
  el.className = 'toast';
  const body = document.createElement('div');
  body.className = 'toast-body';
  const total = document.createElement('div');
  total.className = 'toast-total';
  const meta = document.createElement('div');
  meta.className = 'toast-meta';
  const notation = document.createElement('span');
  notation.className = 'toast-notation';
  const detail = document.createElement('span');
  detail.className = 'toast-detail';
  meta.append(notation, detail);
  body.append(total, meta);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss result');
  closeBtn.textContent = '✕';
  el.append(body, closeBtn);
  container.appendChild(el);

  const hide = (): void => el.classList.remove('visible');
  closeBtn.addEventListener('click', hide);

  return {
    show(result) {
      total.textContent = String(result.total);
      notation.textContent = result.notation;
      const values = result.dice
        .map((d) => (d.parts ? `${d.parts.tens === 0 ? '00' : d.parts.tens}+${d.parts.units}` : String(d.value)))
        .join(' · ');
      const mod = totalModifier(result.request);
      detail.textContent = `${values}${mod > 0 ? `  +${mod}` : mod < 0 ? `  −${-mod}` : ''}`;

      el.classList.remove('visible');
      void el.offsetWidth; // restart the slide-in transition
      el.classList.add('visible');
    },
    hide,
  };
}
