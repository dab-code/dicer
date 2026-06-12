import type { HistoryStore } from '../core/history';

export interface HistoryModal {
  open(): void;
  refresh(): void;
}

/** Roll log in a centered modal dialog with its own clear action. */
export function createHistoryModal(container: HTMLElement, history: HistoryStore): HistoryModal {
  const dialog = document.createElement('dialog');
  dialog.className = 'history-modal';

  const header = document.createElement('div');
  header.className = 'history-modal-header';
  const title = document.createElement('h2');
  title.textContent = 'History';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'history-modal-close';
  closeBtn.setAttribute('aria-label', 'Close history');
  closeBtn.textContent = '✕';
  header.append(title, closeBtn);

  const list = document.createElement('div');
  list.className = 'history-list';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'history-clear';
  clearBtn.textContent = 'Clear history';

  dialog.append(header, list, clearBtn);
  container.appendChild(dialog);

  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // backdrop click
  });
  clearBtn.addEventListener('click', () => {
    history.clear();
    refresh();
  });

  function refresh(): void {
    list.innerHTML = '';
    const entries = history.list();
    clearBtn.hidden = entries.length === 0;
    if (entries.length === 0) {
      const p = document.createElement('p');
      p.className = 'history-empty';
      p.textContent = 'No rolls yet.';
      list.appendChild(p);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'history-entry';

      const info = document.createElement('div');
      info.className = 'history-entry-info';
      const notation = document.createElement('span');
      notation.className = 'history-notation';
      notation.textContent = entry.notation;
      const values = document.createElement('span');
      values.className = 'history-values';
      values.textContent = entry.dice.map((d) => d.value).join(' · ');
      info.append(notation, values);

      const right = document.createElement('div');
      right.className = 'history-entry-right';
      const total = document.createElement('span');
      total.className = 'history-total';
      total.textContent = String(entry.total);
      const time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = new Date(entry.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      right.append(total, time);

      row.append(info, right);
      list.appendChild(row);
    }
  }

  refresh();

  return {
    open() {
      refresh();
      dialog.showModal();
    },
    refresh,
  };
}
