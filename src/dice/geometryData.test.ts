import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/types';
import { DIE_SPECS, PHYSICAL_DIE_TYPES, type DieSpec } from './geometryData';

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);

function faceCentroid(spec: DieSpec, i: number): Vec3 {
  const pts = spec.faces[i]!.map((vi) => spec.vertices[vi]!);
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  };
}

const EXPECTED_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d10tens: 10, d12: 12, d20: 20 } as const;
const OPPOSITE_SUM = { d6: 7, d8: 9, d10: 9, d10tens: 90, d12: 13, d20: 21 } as const;

describe.each(PHYSICAL_DIE_TYPES)('%s geometry', (type) => {
  const spec = DIE_SPECS[type];

  it('has the right number of faces, values, labels and normals', () => {
    expect(spec.faces).toHaveLength(EXPECTED_SIDES[type]);
    expect(spec.faceValues).toHaveLength(spec.faces.length);
    expect(spec.faceLabels).toHaveLength(spec.faces.length);
    expect(spec.faceNormals).toHaveLength(spec.faces.length);
  });

  it('has the correct multiset of face values', () => {
    const sorted = [...spec.faceValues].sort((a, b) => a - b);
    const expected = {
      d4: [1, 2, 3, 4],
      d6: [1, 2, 3, 4, 5, 6],
      d8: [1, 2, 3, 4, 5, 6, 7, 8],
      d10: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      d10tens: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
      d12: Array.from({ length: 12 }, (_, i) => i + 1),
      d20: Array.from({ length: 20 }, (_, i) => i + 1),
    }[type];
    expect(sorted).toEqual(expected);
  });

  it('has unit outward normals', () => {
    spec.faceNormals.forEach((n, i) => {
      expect(len(n)).toBeCloseTo(1, 9);
      expect(dot(n, faceCentroid(spec, i))).toBeGreaterThan(0);
    });
  });

  it('has planar faces', () => {
    spec.faces.forEach((loop, i) => {
      const n = spec.faceNormals[i]!;
      const d = dot(n, spec.vertices[loop[0]!]!);
      for (const vi of loop) {
        expect(dot(n, spec.vertices[vi]!)).toBeCloseTo(d, 6);
      }
    });
  });

  it('has vertices at ~unit circumradius', () => {
    for (const v of spec.vertices) {
      expect(len(v)).toBeGreaterThan(0.98);
      expect(len(v)).toBeLessThan(1.02);
    }
  });

  it('has every edge shared by exactly two faces', () => {
    const edgeCount = new Map<string, number>();
    for (const loop of spec.faces) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]!;
        const b = loop[(i + 1) % loop.length]!;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }
    for (const count of edgeCount.values()) expect(count).toBe(2);
    // Euler: V − E + F = 2
    expect(spec.vertices.length - edgeCount.size + spec.faces.length).toBe(2);
  });

  it('faces wind CCW from outside (right-hand rule matches stored normal)', () => {
    spec.faces.forEach((loop, i) => {
      const a = spec.vertices[loop[0]!]!;
      const b = spec.vertices[loop[1]!]!;
      const c = spec.vertices[loop[2]!]!;
      const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const windNormal = {
        x: ab.y * ac.z - ab.z * ac.y,
        y: ab.z * ac.x - ab.x * ac.z,
        z: ab.x * ac.y - ab.y * ac.x,
      };
      expect(dot(windNormal, spec.faceNormals[i]!)).toBeGreaterThan(0);
    });
  });
});

describe('opposite face sums', () => {
  for (const [type, sum] of Object.entries(OPPOSITE_SUM)) {
    it(`${type} opposite faces sum to ${sum}`, () => {
      const spec = DIE_SPECS[type as keyof typeof OPPOSITE_SUM];
      spec.faceNormals.forEach((n, i) => {
        const j = spec.faceNormals.findIndex((m) => dot(n, m) < -0.9999);
        expect(j).toBeGreaterThanOrEqual(0);
        expect(spec.faceValues[i]! + spec.faceValues[j]!).toBe(sum);
      });
    });
  }
});

describe('d4 specifics', () => {
  const spec = DIE_SPECS.d4;

  it('reads the down face', () => {
    expect(spec.readsDownFace).toBe(true);
  });

  it('every face has exactly three neighbors, one per edge', () => {
    spec.faces.forEach((loop, f) => {
      for (let k = 0; k < loop.length; k++) {
        const a = loop[k]!;
        const b = loop[(k + 1) % loop.length]!;
        const neighbors = spec.faces.filter(
          (other, g) => g !== f && other.includes(a) && other.includes(b),
        );
        expect(neighbors).toHaveLength(1);
      }
    });
  });
});

describe('d10 labels', () => {
  it('units die shows digits 0-9', () => {
    expect([...DIE_SPECS.d10.faceLabels].sort()).toEqual(
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].sort(),
    );
  });
  it('tens die shows 00-90', () => {
    expect([...DIE_SPECS.d10tens.faceLabels].sort()).toEqual(
      ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'].sort(),
    );
  });
});
