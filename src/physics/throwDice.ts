import { randRange, randomUnitQuaternion, type Rng } from '../core/random';
import { DIE_RADIUS, captureBodyTransform, type DieInstance } from '../dice/diceFactory';
import { resetSettleTracker } from './settle';
import { TABLE } from './world';

const SPACING = DIE_RADIUS * 2.5;
const SPAWN_HEIGHT = 5;

/**
 * Place all dice in a spawn grid above the table along a randomly chosen edge
 * and hurl them at the middle — varying the approach each roll so identical
 * trajectories can't bias low-tumble dice like the d4. The grid is bounded so
 * it always stays inside the walls; overflow stacks into additional layers.
 */
export function throwDice(dice: DieInstance[], rng: Rng = Math.random): void {
  const side = Math.floor(rng() * 4); // table edge to throw from
  const alongWall = side < 2 ? TABLE.width : TABLE.depth;
  const perRow = Math.max(1, Math.floor((alongWall - 4) / SPACING));
  const rows = Math.max(1, Math.floor(((side < 2 ? TABLE.depth : TABLE.width) - 4) / SPACING));
  const perLayer = perRow * rows;
  dice.forEach((die, i) => {
    const layer = Math.floor(i / perLayer);
    const idx = i % perLayer;
    const row = Math.floor(idx / perRow);
    const col = idx % perRow;
    const rowCount = Math.min(perRow, dice.length - layer * perLayer - row * perRow);
    // throw-local frame: u along the spawn edge, v stepping toward the center
    const u = (col - (rowCount - 1) / 2) * SPACING + randRange(-0.6, 0.6, rng);
    const v = row * SPACING + randRange(-0.3, 0.3, rng);
    const pos =
      side === 0
        ? { x: u, z: -TABLE.depth / 2 + 2 + v }
        : side === 1
          ? { x: -u, z: TABLE.depth / 2 - 2 - v }
          : side === 2
            ? { x: -TABLE.width / 2 + 2 + v, z: -u }
            : { x: TABLE.width / 2 - 2 - v, z: u };
    // height jitter, capped so stacked layers stay clear of the ceiling
    const y = Math.min(
      SPAWN_HEIGHT + randRange(0, 1.5, rng) + layer * 2.6,
      TABLE.wallHeight - DIE_RADIUS - 0.4,
    );
    launchDie(die, { ...pos, y }, rng);
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
