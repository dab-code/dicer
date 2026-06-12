import { describe, expect, it } from 'vitest';
import {
  computeTotal,
  d10Value,
  formatNotation,
  percentileValue,
  totalDiceCount,
  totalModifier,
} from './notation';
import type { DieResult, RollRequest } from './types';

const req = (
  counts: RollRequest['counts'],
  modifiers: RollRequest['modifiers'] = {},
): RollRequest => ({ counts, modifiers });

describe('formatNotation', () => {
  it('formats a single die type', () => {
    expect(formatNotation(req({ d20: 1 }))).toBe('1d20');
  });

  it('formats multiple die types in canonical order', () => {
    expect(formatNotation(req({ d20: 1, d6: 2 }))).toBe('2d6 + 1d20');
  });

  it('attaches positive modifiers to their term', () => {
    expect(formatNotation(req({ d6: 2 }, { d6: 3 }))).toBe('2d6+3');
  });

  it('attaches negative modifiers to their term', () => {
    expect(formatNotation(req({ d8: 1 }, { d8: -2 }))).toBe('1d8−2');
  });

  it('keeps modifiers per type', () => {
    expect(formatNotation(req({ d6: 2, d20: 1 }, { d6: 3, d20: -1 }))).toBe('2d6+3 + 1d20−1');
  });

  it('handles d100', () => {
    expect(formatNotation(req({ d100: 2, d4: 1 }, { d100: 5 }))).toBe('1d4 + 2d100+5');
  });

  it('omits modifiers for types with zero count', () => {
    expect(formatNotation(req({ d6: 0, d12: 3 }, { d6: 4 }))).toBe('3d12');
  });

  it('returns empty string for empty request', () => {
    expect(formatNotation(req({}))).toBe('');
  });
});

describe('totalDiceCount', () => {
  it('sums all requested dice', () => {
    expect(totalDiceCount(req({ d4: 2, d6: 1, d100: 3 }))).toBe(6);
  });
});

describe('totalModifier', () => {
  it('sums modifiers of rolled types only', () => {
    expect(totalModifier(req({ d6: 2, d20: 1 }, { d6: 3, d20: -1, d8: 5 }))).toBe(2);
  });

  it('is zero with no modifiers', () => {
    expect(totalModifier(req({ d6: 2 }))).toBe(0);
  });
});

describe('d10Value', () => {
  it('maps face 0 to 10', () => {
    expect(d10Value(0)).toBe(10);
  });
  it('keeps 1-9 as-is', () => {
    for (let d = 1; d <= 9; d++) expect(d10Value(d)).toBe(d);
  });
});

describe('percentileValue', () => {
  it('combines tens and units', () => {
    expect(percentileValue(70, 4)).toBe(74);
    expect(percentileValue(0, 7)).toBe(7);
    expect(percentileValue(90, 0)).toBe(90);
  });
  it('maps 00 + 0 to 100', () => {
    expect(percentileValue(0, 0)).toBe(100);
  });
});

describe('computeTotal', () => {
  it('sums dice and modifier', () => {
    const dice: DieResult[] = [
      { type: 'd6', value: 4 },
      { type: 'd6', value: 2 },
    ];
    expect(computeTotal(dice, 3)).toBe(9);
  });
  it('handles negative modifiers below zero', () => {
    expect(computeTotal([{ type: 'd4', value: 1 }], -5)).toBe(-4);
  });
});
