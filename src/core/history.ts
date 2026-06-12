import type { RollResult } from './types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HistoryStore {
  /** Newest first. */
  list(): readonly RollResult[];
  add(result: RollResult): void;
  clear(): void;
}

const KEY = 'dicer3d.history';
const MAX_ENTRIES = 100;

export function createHistory(storage?: StorageLike): HistoryStore {
  let entries: RollResult[] = load(storage);

  return {
    list: () => entries,
    add(result) {
      entries = [result, ...entries].slice(0, MAX_ENTRIES);
      persist(storage, entries);
    },
    clear() {
      entries = [];
      storage?.removeItem(KEY);
    },
  };
}

function load(storage?: StorageLike): RollResult[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RollResult[]) : [];
  } catch {
    return [];
  }
}

function persist(storage: StorageLike | undefined, entries: RollResult[]): void {
  try {
    storage?.setItem(KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — history just won't persist
  }
}
