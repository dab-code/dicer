import { describe, expect, it } from 'vitest';
import { createHistory, type StorageLike } from './history';
import type { RollResult } from './types';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const roll = (total: number, timestamp = 1000): RollResult => ({
  request: { counts: { d6: 2 }, modifiers: {} },
  notation: '2d6',
  dice: [
    { type: 'd6', value: Math.ceil(total / 2) },
    { type: 'd6', value: Math.floor(total / 2) },
  ],
  total,
  timestamp,
});

describe('createHistory', () => {
  it('adds entries newest first', () => {
    const h = createHistory();
    h.add(roll(5));
    h.add(roll(9));
    expect(h.list().map((r) => r.total)).toEqual([9, 5]);
  });

  it('persists to storage and reloads', () => {
    const storage = fakeStorage();
    const h1 = createHistory(storage);
    h1.add(roll(7, 1234));
    const h2 = createHistory(storage);
    expect(h2.list()).toHaveLength(1);
    expect(h2.list()[0]!.total).toBe(7);
    expect(h2.list()[0]!.timestamp).toBe(1234);
  });

  it('clears entries and storage', () => {
    const storage = fakeStorage();
    const h = createHistory(storage);
    h.add(roll(3));
    h.clear();
    expect(h.list()).toHaveLength(0);
    expect(createHistory(storage).list()).toHaveLength(0);
  });

  it('survives corrupt storage', () => {
    const storage = fakeStorage();
    storage.setItem('dicer3d.history', '{not json');
    expect(createHistory(storage).list()).toEqual([]);
  });

  it('caps stored entries at 100', () => {
    const h = createHistory();
    for (let i = 0; i < 150; i++) h.add(roll(i));
    expect(h.list()).toHaveLength(100);
    expect(h.list()[0]!.total).toBe(149);
  });
});
