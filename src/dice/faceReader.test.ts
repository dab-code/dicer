import { describe, expect, it } from 'vitest';
import type { Quat, Vec3 } from '../core/types';
import { DIE_SPECS, PHYSICAL_DIE_TYPES } from './geometryData';
import { readFace, rotateVecByQuat } from './faceReader';

// --- quaternion test helpers ------------------------------------------------

function quatFromUnitVectors(from: Vec3, to: Vec3): Quat {
  const d = from.x * to.x + from.y * to.y + from.z * to.z;
  if (d < -0.999999) {
    // antiparallel: rotate 180° around any perpendicular axis
    let axis: Vec3 = { x: -from.z, y: 0, z: from.x }; // from × (0,1,0) variant
    let len = Math.hypot(axis.x, axis.y, axis.z);
    if (len < 1e-6) {
      axis = { x: 0, y: -from.z, z: from.y }; // from × (1,0,0)
      len = Math.hypot(axis.x, axis.y, axis.z);
    }
    return { x: axis.x / len, y: axis.y / len, z: axis.z / len, w: 0 };
  }
  const cx = from.y * to.z - from.z * to.y;
  const cy = from.z * to.x - from.x * to.z;
  const cz = from.x * to.y - from.y * to.x;
  const w = 1 + d;
  const len = Math.hypot(cx, cy, cz, w);
  return { x: cx / len, y: cy / len, z: cz / len, w: w / len };
}

function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };
}

function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// --- tests -------------------------------------------------------------------

describe('rotateVecByQuat', () => {
  it('identity quaternion leaves vectors unchanged', () => {
    const v = rotateVecByQuat({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0, w: 1 });
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(2);
    expect(v.z).toBeCloseTo(3);
  });

  it('90° around y maps +x to −z', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    const v = rotateVecByQuat({ x: 1, y: 0, z: 0 }, q);
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });
});

describe.each(PHYSICAL_DIE_TYPES)('readFace %s', (type) => {
  const spec = DIE_SPECS[type];
  const target: Vec3 = spec.readsDownFace ? { x: 0, y: -1, z: 0 } : { x: 0, y: 1, z: 0 };
  const rng = makeRng(1234);

  it('reads every face when rotated to rest exactly on it (with random twist)', () => {
    spec.faceNormals.forEach((normal, i) => {
      for (let trial = 0; trial < 10; trial++) {
        const align = quatFromUnitVectors(normal, target);
        const twist = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, rng() * Math.PI * 2);
        const q = quatMultiply(twist, align);
        const read = readFace(spec, q);
        expect(read.kind).toBe('ok');
        expect(read.faceIndex).toBe(i);
        expect(read.value).toBe(spec.faceValues[i]);
      }
    });
  });

  it('reports cocked when tilted well past the threshold', () => {
    const normal = spec.faceNormals[0]!;
    const align = quatFromUnitVectors(normal, target);
    const tilt = quatFromAxisAngle(
      { x: 1, y: 0, z: 0 },
      ((spec.cockedThresholdDeg + 8) * Math.PI) / 180,
    );
    const read = readFace(spec, quatMultiply(tilt, align));
    expect(read.kind).toBe('cocked');
  });

  it('stays ok within the threshold', () => {
    const normal = spec.faceNormals[0]!;
    const align = quatFromUnitVectors(normal, target);
    const tilt = quatFromAxisAngle(
      { x: 1, y: 0, z: 0 },
      ((spec.cockedThresholdDeg - 3) * Math.PI) / 180,
    );
    const read = readFace(spec, quatMultiply(tilt, align));
    expect(read.kind).toBe('ok');
    expect(read.faceIndex).toBe(0);
  });
});
