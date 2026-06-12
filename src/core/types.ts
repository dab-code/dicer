/** Die types the user can request in the picker. */
export type RequestDieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

/** Physical dice that exist on the table. A d100 is rolled as a d10tens + d10 pair. */
export type PhysicalDieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd10tens' | 'd12' | 'd20';

export const REQUEST_DIE_TYPES: readonly RequestDieType[] = [
  'd4',
  'd6',
  'd8',
  'd10',
  'd12',
  'd20',
  'd100',
];

export interface RollRequest {
  counts: Partial<Record<RequestDieType, number>>;
  /** Flat bonus per die type, applied once per type (e.g. 2d6+3 adds 3 once). */
  modifiers: Partial<Record<RequestDieType, number>>;
}

/** One scored die in a finished roll. For d100, `parts` holds the tens/units digits. */
export interface DieResult {
  type: RequestDieType;
  value: number;
  parts?: { tens: number; units: number };
}

export interface RollResult {
  request: RollRequest;
  notation: string;
  dice: DieResult[];
  total: number;
  timestamp: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}
