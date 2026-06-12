import type { Quat, Vec3 } from '../core/types';
import type { DieSpec } from './geometryData';

export type FaceRead =
  | { kind: 'ok'; faceIndex: number; value: number }
  | { kind: 'cocked'; faceIndex: number; value: number };

/** v' = v + 2w(q×v) + 2(q×(q×v)) for unit quaternion q. */
export function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/**
 * Read a settled die: find the face whose outward normal points most directly
 * up (down for the d4) in world space. If even the best face is tilted past
 * the spec's cocked threshold, the die is leaning on something.
 */
export function readFace(spec: DieSpec, q: Quat): FaceRead {
  const sign = spec.readsDownFace ? -1 : 1;
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < spec.faceNormals.length; i++) {
    const world = rotateVecByQuat(spec.faceNormals[i]!, q);
    const score = world.y * sign;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  const kind =
    bestScore >= Math.cos((spec.cockedThresholdDeg * Math.PI) / 180) ? 'ok' : 'cocked';
  return { kind, faceIndex: bestIndex, value: spec.faceValues[bestIndex]! };
}
