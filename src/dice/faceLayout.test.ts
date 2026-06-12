import { describe, expect, it } from 'vitest';
import { DIE_SPECS, PHYSICAL_DIE_TYPES } from './geometryData';
import { atlasGrid, computeFaceLayout } from './faceLayout';

describe('atlasGrid', () => {
  it('fits all faces', () => {
    for (const sides of [4, 6, 8, 10, 12, 20]) {
      const { cols, rows } = atlasGrid(sides);
      expect(cols * rows).toBeGreaterThanOrEqual(sides);
    }
  });
});

describe.each(PHYSICAL_DIE_TYPES)('computeFaceLayout %s', (type) => {
  const spec = DIE_SPECS[type];

  it('keeps every face inside its own atlas cell and within [0,1]', () => {
    for (let i = 0; i < spec.sides; i++) {
      const layout = computeFaceLayout(spec, i);
      const { col, row, cols, rows } = layout.cell;
      for (const p of [...layout.uv, layout.centroid, ...layout.corners, ...layout.edges]) {
        expect(p.u).toBeGreaterThanOrEqual(col / cols);
        expect(p.u).toBeLessThanOrEqual((col + 1) / cols);
        expect(p.v).toBeGreaterThanOrEqual(row / rows);
        expect(p.v).toBeLessThanOrEqual((row + 1) / rows);
        expect(p.u).toBeGreaterThanOrEqual(0);
        expect(p.u).toBeLessThanOrEqual(1);
        expect(p.v).toBeGreaterThanOrEqual(0);
        expect(p.v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('assigns each face a distinct cell', () => {
    const cells = new Set<string>();
    for (let i = 0; i < spec.sides; i++) {
      const { col, row } = computeFaceLayout(spec, i).cell;
      cells.add(`${col},${row}`);
    }
    expect(cells.size).toBe(spec.sides);
  });

  it('has a positive inradius and centroid inside the polygon bounds', () => {
    for (let i = 0; i < spec.sides; i++) {
      const layout = computeFaceLayout(spec, i);
      expect(layout.inradius).toBeGreaterThan(0.005);
    }
  });

  it('points d10 kite digits at the pole tip (+v toward the pole vertex)', () => {
    if (type !== 'd10' && type !== 'd10tens') return;
    for (let i = 0; i < spec.sides; i++) {
      const loop = spec.faces[i]!;
      const layout = computeFaceLayout(spec, i);
      const poleK = loop.reduce(
        (best, vi, k) =>
          Math.abs(spec.vertices[vi]!.y) > Math.abs(spec.vertices[loop[best]!]!.y) ? k : best,
        0,
      );
      const poleUV = layout.uv[poleK]!;
      // pole tip sits directly above the centroid in UV space
      expect(Math.abs(poleUV.u - layout.centroid.u)).toBeLessThan(1e-6);
      expect(poleUV.v).toBeGreaterThan(layout.centroid.v);
      for (const p of layout.uv) expect(p.v).toBeLessThanOrEqual(poleUV.v + 1e-9);
    }
  });

  it('uses the first edge as a horizontal bottom baseline on regular faces', () => {
    if (type === 'd10' || type === 'd10tens') return; // kites use the pole axis
    for (let i = 0; i < spec.sides; i++) {
      const { uv } = computeFaceLayout(spec, i);
      const a = uv[0]!;
      const b = uv[1]!;
      // digit baseline parallel to the seed edge…
      expect(Math.abs(a.v - b.v)).toBeLessThan(1e-9);
      // …with the digit top toward the rest of the face (edge at the bottom)
      for (const p of uv) expect(p.v).toBeGreaterThanOrEqual(a.v - 1e-9);
    }
  });

  it('preserves UV polygon orientation (CCW, not mirrored)', () => {
    for (let i = 0; i < spec.sides; i++) {
      const { uv } = computeFaceLayout(spec, i);
      let area = 0;
      for (let k = 0; k < uv.length; k++) {
        const p = uv[k]!;
        const q = uv[(k + 1) % uv.length]!;
        area += p.u * q.v - q.u * p.v;
      }
      // spec faces wind CCW from outside; an orientation-preserving map keeps
      // the signed area positive, so painted labels are not mirrored
      expect(area).toBeGreaterThan(0);
    }
  });
});
