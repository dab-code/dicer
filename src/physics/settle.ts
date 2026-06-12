/**
 * Pure per-die settle detection. Fed plain velocity magnitudes each physics
 * tick — no Rapier imports, so this is fully unit-testable.
 */

export interface SettleParams {
  linVelEps: number;
  angVelEps: number;
  /** Consecutive calm ticks required before a die counts as settled. */
  calmTicks: number;
  /** Hard cap — a die is forced settled after this long no matter what. */
  timeoutMs: number;
}

export const DEFAULT_SETTLE_PARAMS: SettleParams = {
  linVelEps: 0.08,
  angVelEps: 0.12,
  calmTicks: 20,
  timeoutMs: 8000,
};

export type SettlePhase = 'thrown' | 'settled';

export interface SettleTracker {
  phase: SettlePhase;
  calm: number;
  elapsedMs: number;
}

export interface SettleInput {
  linVelMag: number;
  angVelMag: number;
  dtMs: number;
  sleeping?: boolean;
}

export function createSettleTracker(): SettleTracker {
  return { phase: 'thrown', calm: 0, elapsedMs: 0 };
}

/** Reset after a nudge/reroll so the die must calm down again. */
export function resetSettleTracker(tracker: SettleTracker): void {
  tracker.phase = 'thrown';
  tracker.calm = 0;
  tracker.elapsedMs = 0;
}

export function tickSettle(
  tracker: SettleTracker,
  input: SettleInput,
  params: SettleParams = DEFAULT_SETTLE_PARAMS,
): SettlePhase {
  if (tracker.phase === 'settled') return 'settled';

  tracker.elapsedMs += input.dtMs;

  if (input.sleeping) {
    tracker.phase = 'settled';
    return 'settled';
  }

  if (input.linVelMag < params.linVelEps && input.angVelMag < params.angVelEps) {
    tracker.calm += 1;
  } else {
    tracker.calm = 0;
  }

  if (tracker.calm >= params.calmTicks || tracker.elapsedMs >= params.timeoutMs) {
    tracker.phase = 'settled';
  }
  return tracker.phase;
}
