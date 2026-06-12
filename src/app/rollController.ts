import type * as THREE from 'three';
import type { HistoryStore } from '../core/history';
import {
  computeTotal,
  d10Value,
  formatNotation,
  percentileValue,
  totalModifier,
} from '../core/notation';
import { randRange, type Rng } from '../core/random';
import {
  REQUEST_DIE_TYPES,
  type DieResult,
  type PhysicalDieType,
  type RollRequest,
  type RollResult,
} from '../core/types';
import {
  captureBodyTransform,
  createDie,
  disposeDie,
  syncMesh,
  type DieInstance,
} from '../dice/diceFactory';
import { readFace } from '../dice/faceReader';
import { resetSettleTracker, tickSettle } from '../physics/settle';
import { rethrowSingle, throwDice } from '../physics/throwDice';
import type { PhysicsWorld } from '../physics/world';

const MAX_NUDGES = 2;
const MAX_REROLLS = 1;

export interface RollControllerDeps {
  scene: THREE.Scene;
  physics: PhysicsWorld;
  history: HistoryStore;
  onResult: (result: RollResult) => void;
  onRollingChange: (rolling: boolean) => void;
  rng?: Rng;
}

export interface RollController {
  roll(request: RollRequest): void;
  /** Re-throw the last request. Returns false if there is none. */
  reroll(): boolean;
  /** Rethrow one settled die, keeping the rest. Returns false if unavailable. */
  rerollDie(die: DieInstance): boolean;
  clear(): void;
  /** Advance settle/read logic; call once per physics step. */
  tick(dtMs: number): void;
  /** Apply interpolated transforms to meshes; call once per rendered frame. */
  syncMeshes(alpha: number): void;
  isRolling(): boolean;
  allSleeping(): boolean;
  dice(): readonly DieInstance[];
  lastRequest(): RollRequest | null;
}

export function createRollController(deps: RollControllerDeps): RollController {
  const { scene, physics, history, rng = Math.random } = deps;

  let dice: DieInstance[] = [];
  let rolling = false;
  let request: RollRequest | null = null;

  function setRolling(value: boolean): void {
    if (rolling !== value) {
      rolling = value;
      deps.onRollingChange(value);
    }
  }

  function removeAllDice(): void {
    for (const die of dice) disposeDie(die, scene, physics);
    dice = [];
  }

  function expand(req: RollRequest): DieInstance[] {
    const spawned: DieInstance[] = [];
    let nextPair = 1;
    for (const type of REQUEST_DIE_TYPES) {
      const count = req.counts[type] ?? 0;
      for (let i = 0; i < count; i++) {
        if (type === 'd100') {
          const pairId = nextPair++;
          spawned.push(createDie('d10tens', 'd100', pairId, scene, physics));
          spawned.push(createDie('d10', 'd100', pairId, scene, physics));
        } else {
          spawned.push(createDie(type as PhysicalDieType, type, null, scene, physics));
        }
      }
    }
    return spawned;
  }

  function nudge(die: DieInstance): void {
    const mass = die.body.mass();
    const pos = die.body.translation();
    const toCenter = Math.hypot(pos.x, pos.z) || 1;
    die.body.applyImpulse(
      {
        x: (-pos.x / toCenter) * 3 * mass + randRange(-1, 1, rng) * mass,
        y: 5 * mass,
        z: (-pos.z / toCenter) * 3 * mass + randRange(-1, 1, rng) * mass,
      },
      true,
    );
    die.body.applyTorqueImpulse(
      {
        x: randRange(-2.5, 2.5, rng) * mass,
        y: randRange(-2.5, 2.5, rng) * mass,
        z: randRange(-2.5, 2.5, rng) * mass,
      },
      true,
    );
    die.nudges += 1;
    resetSettleTracker(die.tracker);
  }

  function handleSettled(die: DieInstance): void {
    const read = readFace(die.spec, die.body.rotation());
    if (read.kind === 'ok') {
      die.read = read;
    } else if (die.nudges < MAX_NUDGES) {
      nudge(die);
    } else if (die.rerolls < MAX_REROLLS) {
      die.rerolls += 1;
      die.nudges = 0;
      rethrowSingle(die, rng);
    } else {
      die.read = read; // never deadlock — accept the best face
    }
  }

  function finalize(): void {
    if (!request) return;
    const results: DieResult[] = [];
    const pairedUnits = new Map<number, DieInstance>();
    for (const die of dice) {
      if (die.pairId !== null && die.spec.type === 'd10') pairedUnits.set(die.pairId, die);
    }
    for (const die of dice) {
      const value = die.read!.value;
      if (die.pairId !== null) {
        if (die.spec.type !== 'd10tens') continue; // pair is reported once, by its tens die
        const units = pairedUnits.get(die.pairId)!.read!.value;
        results.push({
          type: 'd100',
          value: percentileValue(value, units),
          parts: { tens: value, units },
        });
      } else if (die.requestType === 'd10') {
        results.push({ type: 'd10', value: d10Value(value) });
      } else {
        results.push({ type: die.requestType, value });
      }
    }
    const result: RollResult = {
      request,
      notation: formatNotation(request),
      dice: results,
      total: computeTotal(results, totalModifier(request)),
      timestamp: Date.now(),
    };
    history.add(result);
    setRolling(false);
    deps.onResult(result);
  }

  return {
    roll(req) {
      removeAllDice();
      request = { counts: { ...req.counts }, modifiers: { ...req.modifiers } };
      dice = expand(request);
      if (dice.length === 0) return;
      throwDice(dice, rng);
      setRolling(true);
    },

    reroll() {
      if (!request || rolling) return false;
      this.roll(request);
      return true;
    },

    rerollDie(die) {
      if (rolling || !die.read || !dice.includes(die)) return false;
      die.nudges = 0;
      die.rerolls = 0; // fresh cocked-recovery budget
      rethrowSingle(die, rng); // resets tracker, read = null, captures transform
      setRolling(true);
      return true;
    },

    clear() {
      removeAllDice();
      setRolling(false);
    },

    tick(dtMs) {
      for (const die of dice) captureBodyTransform(die);
      if (!rolling) return;
      let allRead = true;
      for (const die of dice) {
        if (die.read) continue;
        const phase = tickSettle(die.tracker, {
          linVelMag: vecMag(die.body.linvel()),
          angVelMag: vecMag(die.body.angvel()),
          dtMs,
          sleeping: die.body.isSleeping(),
        });
        if (phase === 'settled') handleSettled(die);
        if (!die.read) allRead = false;
      }
      if (allRead && dice.length > 0) finalize();
    },

    syncMeshes(alpha) {
      for (const die of dice) syncMesh(die, alpha);
    },

    isRolling: () => rolling,
    allSleeping: () => dice.every((die) => die.body.isSleeping()),
    dice: () => dice,
    lastRequest: () => request,
  };
}

function vecMag(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}
