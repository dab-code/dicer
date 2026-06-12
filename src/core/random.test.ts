import { describe, expect, it } from 'vitest';
import { randRange, randomUnitQuaternion } from './random';

// Deterministic LCG so tests don't depend on Math.random.
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('randomUnitQuaternion', () => {
  it('always returns unit-length quaternions', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      const q = randomUnitQuaternion(rng);
      const len = Math.hypot(q.x, q.y, q.z, q.w);
      expect(len).toBeCloseTo(1, 10);
    }
  });
});

describe('randRange', () => {
  it('stays within bounds', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = randRange(-3, 5, rng);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
    }
  });
});
