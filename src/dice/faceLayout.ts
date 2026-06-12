import type { Vec3 } from '../core/types';
import { centroid as centroidOf, cross, dot, normalize, sub, type DieSpec } from './geometryData';

/**
 * Pure 2D layout of each face into its atlas cell. Shared by the render
 * geometry (UV coordinates) and the texture painter (where to draw labels),
 * so the two can never drift apart. UV convention: v=0 at the bottom of the
 * texture (three.js CanvasTexture with default flipY).
 */

export interface UV {
  u: number;
  v: number;
}

export interface FaceLayout {
  /** Atlas UV per face-loop vertex, same order as spec.faces[faceIndex]. */
  uv: UV[];
  /** Mapped polygon centroid — where the face's label belongs. */
  centroid: UV;
  /**
   * For corner labels: a point partway from centroid toward each loop vertex
   * plus the outward angle (radians, in UV space, 0 = +u).
   */
  corners: { u: number; v: number; angle: number }[];
  /**
   * For edge labels (d4): a point partway from centroid toward each edge's
   * midpoint plus the outward angle. edges[k] is the edge loop[k]→loop[k+1].
   */
  edges: { u: number; v: number; angle: number }[];
  cell: { col: number; row: number; cols: number; rows: number };
  /** Distance (in UV units) from centroid to the nearest polygon edge. */
  inradius: number;
}

export function atlasGrid(sides: number): { cols: number; rows: number } {
  const cols = Math.ceil(Math.sqrt(sides));
  const rows = Math.ceil(sides / cols);
  return { cols, rows };
}

const PADDING = 0.12; // fraction of the cell left empty on each side

export function computeFaceLayout(spec: DieSpec, faceIndex: number): FaceLayout {
  const loop = spec.faces[faceIndex]!;
  const verts = loop.map((vi) => spec.vertices[vi]!);
  const n = spec.faceNormals[faceIndex]!;

  const center = centroidOf(verts);

  // In-plane basis, right-handed with the outward normal so labels drawn
  // "up = +y" are never mirrored.
  let ex: Vec3;
  let ey: Vec3;
  if (spec.type === 'd10' || spec.type === 'd10tens') {
    // Kite faces have a symmetry axis: +y points from the centroid toward the
    // face's pole vertex (the kite's sharp tip), so digits read along the
    // axis with their top at the tip — like physical d10s. An edge-seeded
    // basis would leave digits sideways/upside down relative to the axis.
    const poleVi = loop.reduce(
      (best, vi) =>
        Math.abs(spec.vertices[vi]!.y) > Math.abs(spec.vertices[best]!.y) ? vi : best,
      loop[0]!,
    );
    ey = normalize(sub(spec.vertices[poleVi]!, center));
    ex = cross(ey, n);
  } else {
    // Regular faces: x along the first edge (digit baseline parallel to an
    // edge, top toward the opposite side — standard on real dice).
    ex = normalize(sub(verts[1]!, verts[0]!));
    ey = cross(n, ex);
  }
  const flat = verts.map((p) => {
    const d = sub(p, center);
    return { x: dot(d, ex), y: dot(d, ey) };
  });

  const { cols, rows } = atlasGrid(spec.sides);
  const col = faceIndex % cols;
  const row = Math.floor(faceIndex / cols);

  const minX = Math.min(...flat.map((p) => p.x));
  const maxX = Math.max(...flat.map((p) => p.x));
  const minY = Math.min(...flat.map((p) => p.y));
  const maxY = Math.max(...flat.map((p) => p.y));
  const cellU = 1 / cols;
  const cellV = 1 / rows;
  const usable = Math.min(cellU, cellV) * (1 - 2 * PADDING);
  const scale = usable / Math.max(maxX - minX, maxY - minY);

  const centerU = (col + 0.5) * cellU;
  const centerV = (row + 0.5) * cellV;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const map = (p: { x: number; y: number }): UV => ({
    u: centerU + (p.x - midX) * scale,
    v: centerV + (p.y - midY) * scale,
  });

  const uv = flat.map(map);
  const centroid = map({ x: 0, y: 0 });

  const corners = uv.map((p) => {
    const du = p.u - centroid.u;
    const dv = p.v - centroid.v;
    return {
      u: centroid.u + du * 0.6,
      v: centroid.v + dv * 0.6,
      angle: Math.atan2(dv, du),
    };
  });

  const edges = uv.map((p, k) => {
    const q = uv[(k + 1) % uv.length]!;
    const du = (p.u + q.u) / 2 - centroid.u;
    const dv = (p.v + q.v) / 2 - centroid.v;
    return {
      u: centroid.u + du * 0.55,
      v: centroid.v + dv * 0.55,
      angle: Math.atan2(dv, du),
    };
  });

  let inradius = Infinity;
  for (let i = 0; i < uv.length; i++) {
    const p = uv[i]!;
    const q = uv[(i + 1) % uv.length]!;
    const eu = q.u - p.u;
    const ev = q.v - p.v;
    const len = Math.hypot(eu, ev);
    const dist = Math.abs(eu * (centroid.v - p.v) - ev * (centroid.u - p.u)) / len;
    inradius = Math.min(inradius, dist);
  }

  return { uv, centroid, corners, edges, cell: { col, row, cols, rows }, inradius };
}
