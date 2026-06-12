import type { Quat } from './types';

export type Rng = () => number;

export function randRange(min: number, max: number, rng: Rng = Math.random): number {
  return min + (max - min) * rng();
}

/** Uniform random unit quaternion (Shoemake's subgroup algorithm). */
export function randomUnitQuaternion(rng: Rng = Math.random): Quat {
  const u1 = rng();
  const u2 = rng() * 2 * Math.PI;
  const u3 = rng() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return {
    x: a * Math.sin(u2),
    y: a * Math.cos(u2),
    z: b * Math.sin(u3),
    w: b * Math.cos(u3),
  };
}
