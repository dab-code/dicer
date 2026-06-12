import { REQUEST_DIE_TYPES, type DieResult, type RollRequest } from './types';

/** "2d6+3 + 1d20" — one term per die type, each with its own modifier. */
export function formatNotation(request: RollRequest): string {
  const parts: string[] = [];
  for (const type of REQUEST_DIE_TYPES) {
    const count = request.counts[type] ?? 0;
    if (count <= 0) continue;
    let term = `${count}${type}`;
    const modifier = request.modifiers[type] ?? 0;
    if (modifier > 0) term += `+${modifier}`;
    else if (modifier < 0) term += `−${-modifier}`;
    parts.push(term);
  }
  return parts.join(' + ');
}

export function totalDiceCount(request: RollRequest): number {
  return REQUEST_DIE_TYPES.reduce((sum, type) => sum + (request.counts[type] ?? 0), 0);
}

/** Sum of the per-type modifiers, counting only types actually being rolled. */
export function totalModifier(request: RollRequest): number {
  return REQUEST_DIE_TYPES.reduce(
    (sum, type) => sum + ((request.counts[type] ?? 0) > 0 ? (request.modifiers[type] ?? 0) : 0),
    0,
  );
}

/** A standalone d10 face shows digits 0–9; a rolled 0 scores 10. */
export function d10Value(digit: number): number {
  return digit === 0 ? 10 : digit;
}

/** Percentile pair: tens face (0,10..90) + units digit (0–9); a combined 0 scores 100. */
export function percentileValue(tens: number, units: number): number {
  const value = tens + units;
  return value === 0 ? 100 : value;
}

export function computeTotal(dice: readonly DieResult[], modifier: number): number {
  return dice.reduce((sum, die) => sum + die.value, modifier);
}
