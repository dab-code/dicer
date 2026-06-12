export interface MobileDockHandlers {
  onRoll(): void;
  onClear(): void;
  onHistory(): void;
  onSettings(): void;
}

export interface MobileDock {
  /** Hosts for the picker rows and the notation preview line. */
  pickerContainer: HTMLElement;
  previewEl: HTMLElement;
  update(state: { rolling: boolean; canRoll: boolean }): void;
  close(): void;
}

const DIE_ICON = `
<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
  <rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="8.3" cy="8.3" r="1.7" fill="currentColor"/>
  <circle cx="15.7" cy="8.3" r="1.7" fill="currentColor"/>
  <circle cx="12" cy="12" r="1.7" fill="currentColor"/>
  <circle cx="8.3" cy="15.7" r="1.7" fill="currentColor"/>
  <circle cx="15.7" cy="15.7" r="1.7" fill="currentColor"/>
</svg>`;

/**
 * Floating dice UI: a popover sheet anchored to the bottom-right with the
 * dice picker, plus a Roll FAB. On mobile a die pill toggles the sheet; on
 * desktop the sheet is always open and the pill is hidden (CSS).
 */
export function createMobileDock(container: HTMLElement, handlers: MobileDockHandlers): MobileDock {
  const backdrop = document.createElement('div');
  backdrop.className = 'dock-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'dock-sheet';
  const sheetBody = document.createElement('div');
  sheetBody.className = 'dock-sheet-body';
  const header = document.createElement('div');
  header.className = 'dock-header';
  const headerTitle = document.createElement('span');
  headerTitle.className = 'dock-title';
  headerTitle.textContent = 'Choose your dice';
  const historyBtn = document.createElement('button');
  historyBtn.type = 'button';
  historyBtn.className = 'dock-icon-btn';
  historyBtn.title = 'Roll history';
  historyBtn.setAttribute('aria-label', 'Roll history');
  historyBtn.innerHTML = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="1 4 1 10 7 10"/>
  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  <polyline points="12 7 12 12 15.5 14"/>
</svg>`;
  const cogBtn = document.createElement('button');
  cogBtn.type = 'button';
  cogBtn.className = 'dock-icon-btn';
  cogBtn.title = 'Settings';
  cogBtn.setAttribute('aria-label', 'Settings');
  cogBtn.innerHTML = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3.2"/>
  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>
</svg>`;
  const headerActions = document.createElement('div');
  headerActions.className = 'dock-actions';
  headerActions.append(historyBtn, cogBtn);
  header.append(headerTitle, headerActions);
  const previewEl = document.createElement('div');
  previewEl.id = 'notation-preview';
  previewEl.setAttribute('aria-live', 'polite');
  const pickerContainer = document.createElement('div');
  pickerContainer.id = 'picker';
  sheetBody.append(header, previewEl, pickerContainer);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'dock-clear';
  clearBtn.textContent = 'Clear table';

  sheet.append(sheetBody, clearBtn);

  const bar = document.createElement('div');
  bar.className = 'dock-bar';

  const rollBtn = document.createElement('button');
  rollBtn.type = 'button';
  rollBtn.className = 'dock-fab dock-roll hidden';
  rollBtn.textContent = 'Roll';

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'dock-fab dock-pill';
  pill.setAttribute('aria-label', 'Choose dice');
  pill.setAttribute('aria-expanded', 'false');
  pill.innerHTML = `<span class="pill-die">${DIE_ICON}</span><span class="pill-close">✕</span>`;

  bar.append(rollBtn, pill);
  container.append(backdrop, sheet, bar);

  function setOpen(open: boolean): void {
    container.classList.toggle('open', open);
    pill.setAttribute('aria-expanded', String(open));
  }

  pill.addEventListener('click', () => setOpen(!container.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  clearBtn.addEventListener('click', handlers.onClear);
  historyBtn.addEventListener('click', handlers.onHistory);
  cogBtn.addEventListener('click', handlers.onSettings);
  rollBtn.addEventListener('click', () => {
    setOpen(false);
    handlers.onRoll();
  });

  return {
    pickerContainer,
    previewEl,
    update({ rolling, canRoll }) {
      rollBtn.disabled = rolling || !canRoll;
      rollBtn.classList.toggle('hidden', !canRoll && !rolling);
      rollBtn.innerHTML = rolling
        ? '<span class="roll-dot"></span><span class="roll-dot"></span><span class="roll-dot"></span>'
        : 'Roll';
    },
    close: () => setOpen(false),
  };
}
