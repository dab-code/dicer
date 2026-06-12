import { randRange, randomUnitQuaternion, type Rng } from '../core/random';
import { DIE_RADIUS, captureBodyTransform, type DieInstance } from '../dice/diceFactory';
import { resetSettleTracker } from './settle';
import { TABLE } from './world';

const SPACING = DIE_RADIUS * 2.5;
const SPAWN_HEIGHT = 5;

/**
 * Place all dice in a spawn grid above one half of the table and hurl them at
 * the middle. The grid is bounded in x and z so it always stays inside the
 * walls; overflow stacks into additional layers above.
 */
export function throwDice(dice: DieInstance[], rng: Rng = Math.random): void {
  const perRow = Math.max(1, Math.floor((TABLE.width - 4) / SPACING));
  const zRows = Math.max(1, Math.floor((TABLE.depth - 4) / SPACING));
  const perLayer = perRow * zRows;
  dice.forEach((die, i) => {
    const layer = Math.floor(i / perLayer);
    const idx = i % perLayer;
    const row = Math.floor(idx / perRow);
    const col = idx % perRow;
    const rowCount = Math.min(perRow, dice.length - layer * perLayer - row * perRow);
    const x = (col - (rowCount - 1) / 2) * SPACING + randRange(-0.4, 0.4, rng);
    const z = -TABLE.depth / 2 + 2 + row * SPACING + randRange(-0.3, 0.3, rng);
    launchDie(die, { x, y: SPAWN_HEIGHT + layer * 2.6, z }, rng);
  });
}

/** Respawn a single die (stuck/cocked) from above the table center area. */
export function rethrowSingle(die: DieInstance, rng: Rng = Math.random): void {
  launchDie(
    die,
    { x: randRange(-4, 4, rng), y: SPAWN_HEIGHT + 1, z: randRange(-3, 0, rng) },
    rng,
  );
}

function launchDie(
  die: DieInstance,
  pos: { x: number; y: number; z: number },
  rng: Rng,
): void {
  const targetX = randRange(-TABLE.width * 0.25, TABLE.width * 0.25, rng);
  const targetZ = randRange(-TABLE.depth * 0.25, TABLE.depth * 0.25, rng);
  const dx = targetX - pos.x;
  const dz = targetZ - pos.z;
  const horiz = Math.hypot(dx, dz) || 1;
  const speed = randRange(10, 16, rng);

  die.body.setTranslation(pos, true);
  die.body.setRotation(randomUnitQuaternion(rng), true);
  die.body.setLinvel(
    { x: (dx / horiz) * speed, y: randRange(-5, -2, rng), z: (dz / horiz) * speed },
    true,
  );
  die.body.setAngvel(
    { x: randRange(-25, 25, rng), y: randRange(-25, 25, rng), z: randRange(-25, 25, rng) },
    true,
  );
  resetSettleTracker(die.tracker);
  die.read = null;
  captureBodyTransform(die, true);
}
