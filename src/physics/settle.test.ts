import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTLE_PARAMS,
  createSettleTracker,
  resetSettleTracker,
  tickSettle,
} from './settle';

const DT = 1000 / 60;
const calm = { linVelMag: 0.01, angVelMag: 0.01, dtMs: DT };
const moving = { linVelMag: 5, angVelMag: 10, dtMs: DT };

describe('tickSettle', () => {
  it('settles after the required consecutive calm ticks', () => {
    const t = createSettleTracker();
    for (let i = 0; i < DEFAULT_SETTLE_PARAMS.calmTicks - 1; i++) {
      expect(tickSettle(t, calm)).toBe('thrown');
    }
    expect(tickSettle(t, calm)).toBe('settled');
  });

  it('resets the calm counter when the die moves again', () => {
    const t = createSettleTracker();
    for (let i = 0; i < DEFAULT_SETTLE_PARAMS.calmTicks - 1; i++) tickSettle(t, calm);
    tickSettle(t, moving); // jitter resets the streak
    for (let i = 0; i < DEFAULT_SETTLE_PARAMS.calmTicks - 1; i++) {
      expect(tickSettle(t, calm)).toBe('thrown');
    }
    expect(tickSettle(t, calm)).toBe('settled');
  });

  it('forces settle at the timeout even while moving', () => {
    const t = createSettleTracker();
    const ticks = Math.ceil(DEFAULT_SETTLE_PARAMS.timeoutMs / DT);
    for (let i = 0; i < ticks - 1; i++) {
      expect(tickSettle(t, moving)).toBe('thrown');
    }
    expect(tickSettle(t, moving)).toBe('settled');
  });

  it('short-circuits when the physics engine reports sleep', () => {
    const t = createSettleTracker();
    expect(tickSettle(t, { ...moving, sleeping: true })).toBe('settled');
  });

  it('stays settled once settled', () => {
    const t = createSettleTracker();
    tickSettle(t, { ...calm, sleeping: true });
    expect(tickSettle(t, moving)).toBe('settled');
  });

  it('can be reset for nudges', () => {
    const t = createSettleTracker();
    tickSettle(t, { ...calm, sleeping: true });
    resetSettleTracker(t);
    expect(tickSettle(t, moving)).toBe('thrown');
  });
});
