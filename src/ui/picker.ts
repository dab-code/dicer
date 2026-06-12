import { formatNotation } from '../core/notation';
import { REQUEST_DIE_TYPES, type RequestDieType, type RollRequest } from '../core/types';

/** Die silhouettes shown before each row label (16×16, stroke = currentColor). */
const DIE_GLYPHS: Record<RequestDieType, string> = {
  d4: '<polygon points="8,2.2 14,13.4 2,13.4"/>',
  d6: '<rect x="3" y="3" width="10" height="10" rx="1.8"/>',
  d8: '<polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/>',
  d10: '<polygon points="8,1.5 13.6,6.8 8,14.5 2.4,6.8"/>',
  d12: '<polygon points="8,1.9 14.2,6.4 11.8,13.7 4.2,13.7 1.8,6.4"/>',
  d20: '<polygon points="8,1.2 13.9,4.6 13.9,11.4 8,14.8 2.1,11.4 2.1,4.6"/>',
  d100:
    '<polygon points="5.6,2.5 10.4,7 5.6,13.5 0.8,7"/>' +
    '<polygon points="11.2,4.5 15.2,8.2 11.2,13.5 7.2,8.2"/>',
};

function glyphFor(type: RequestDieType): string {
  return `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${DIE_GLYPHS[type]}</svg>`;
}

const MAX_PHYSICAL_DICE = 20;
const MODIFIER_RANGE = 20;

export interface Picker {
  getRequest(): RollRequest;
  reset(): void;
}

function physicalCount(counts: Partial<Record<RequestDieType, number>>): number {
  return REQUEST_DIE_TYPES.reduce(
    (sum, type) => sum + (counts[type] ?? 0) * (type === 'd100' ? 2 : 1),
    0,
  );
}

export function createPicker(
  container: HTMLElement,
  preview: HTMLElement,
  onChange: () => void,
): Picker {
  const counts: Partial<Record<RequestDieType, number>> = {};
  const modifiers: Partial<Record<RequestDieType, number>> = {};

  const countEls = new Map<RequestDieType, HTMLElement>();
  const modInputs = new Map<RequestDieType, HTMLInputElement>();
  const rowEls = new Map<RequestDieType, HTMLElement>();

  function update(): void {
    for (const [type, el] of countEls) el.textContent = String(counts[type] ?? 0);
    for (const [type, input] of modInputs) input.value = String(modifiers[type] ?? 0);
    for (const [type, row] of rowEls) row.classList.toggle('active', (counts[type] ?? 0) > 0);
    const notation = formatNotation({ counts, modifiers });
    preview.textContent = notation || 'Select dice to roll';
    onChange();
  }

  for (const type of REQUEST_DIE_TYPES) {
    const row = document.createElement('div');
    row.className = 'picker-row';
    rowEls.set(type, row);

    const name = document.createElement('span');
    name.className = 'picker-label';
    name.innerHTML = `${glyphFor(type)}<span>${type}</span>`;

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'step';
    minus.textContent = '−';

    const count = document.createElement('span');
    count.className = 'picker-count';
    countEls.set(type, count);

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'step';
    plus.textContent = '+';

    const step = (delta: number): void => {
      const next = Math.max(0, (counts[type] ?? 0) + delta);
      const nextCounts = { ...counts, [type]: next };
      if (physicalCount(nextCounts) > MAX_PHYSICAL_DICE) return;
      counts[type] = next;
      update();
    };
    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(1));

    const mod = document.createElement('input');
    mod.type = 'number';
    mod.inputMode = 'numeric';
    mod.className = 'picker-mod-input';
    mod.min = String(-MODIFIER_RANGE);
    mod.max = String(MODIFIER_RANGE);
    mod.title = `${type} modifier`;
    mod.addEventListener('change', () => {
      const parsed = Number.parseInt(mod.value, 10);
      modifiers[type] = Number.isNaN(parsed)
        ? 0
        : Math.max(-MODIFIER_RANGE, Math.min(MODIFIER_RANGE, parsed));
      update();
    });
    modInputs.set(type, mod);

    row.append(name, minus, count, plus, mod);
    container.appendChild(row);
  }

  update();

  return {
    getRequest: () => ({ counts: { ...counts }, modifiers: { ...modifiers } }),
    reset() {
      for (const type of REQUEST_DIE_TYPES) {
        counts[type] = 0;
        modifiers[type] = 0;
      }
      update();
    },
  };
}
