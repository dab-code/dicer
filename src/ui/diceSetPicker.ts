import { DICE_SETS, DEFAULT_SET_ID, getDiceSet } from '../dice/textures';

const KEY = 'dicer3d.diceset';

export function loadDiceSetId(): string {
  try {
    return getDiceSet(window.localStorage.getItem(KEY) ?? DEFAULT_SET_ID).id;
  } catch {
    return DEFAULT_SET_ID;
  }
}

/** Grid of colorway swatches (used in the settings modal); choice persists. */
export function buildDiceSetGrid(
  container: HTMLElement,
  initialId: string,
  onChange: (setId: string) => void,
): void {
  const grid = document.createElement('div');
  grid.className = 'swatch-grid';

  const swatches = new Map<string, HTMLButtonElement>();
  for (const set of DICE_SETS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'dice-swatch';
    swatch.style.setProperty('--swatch', set.base);
    swatch.title = set.name;
    swatch.setAttribute('aria-label', `${set.name} dice`);
    swatch.addEventListener('click', () => {
      select(set.id);
      onChange(set.id);
    });
    swatches.set(set.id, swatch);
    grid.appendChild(swatch);
  }

  function select(id: string): void {
    for (const [setId, el] of swatches) el.classList.toggle('selected', setId === id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // persistence is best-effort
    }
  }

  select(initialId);
  container.appendChild(grid);
}
