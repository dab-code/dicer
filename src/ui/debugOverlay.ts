import type { DieInstance } from '../dice/diceFactory';
import { readFace } from '../dice/faceReader';
import type { SceneContext } from '../scene/renderer';

/**
 * Dev-only overlay (?debug): floats each die's live face reading above it so
 * "reported value matches visible top face" can be verified at a glance.
 */
export interface DebugOverlay {
  update(dice: readonly DieInstance[]): void;
}

export function createDebugOverlay(container: HTMLElement, ctx: SceneContext): DebugOverlay {
  const labels = new Map<number, HTMLElement>();

  return {
    update(dice) {
      const seen = new Set<number>();
      for (const die of dice) {
        seen.add(die.id);
        let label = labels.get(die.id);
        if (!label) {
          label = document.createElement('div');
          label.className = 'debug-label';
          container.appendChild(label);
          labels.set(die.id, label);
        }
        const read = readFace(die.spec, die.body.rotation());
        label.textContent = `${read.value}${read.kind === 'cocked' ? '?' : ''}`;
        label.classList.toggle('cocked', read.kind === 'cocked');
        const screen = ctx.project(die.mesh.position);
        label.style.transform = `translate(${screen.x}px, ${screen.y - 28}px)`;
        label.hidden = screen.behind;
      }
      for (const [id, label] of labels) {
        if (!seen.has(id)) {
          label.remove();
          labels.delete(id);
        }
      }
    },
  };
}
