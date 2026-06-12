import * as THREE from 'three';
import type { Vec3 } from '../core/types';
import type { DieSpec } from './geometryData';
import { computeFaceLayout } from './faceLayout';

/** Fraction of each face pulled toward its centroid to form the edge bevels. */
const CHAMFER = 0.16;
/** UV sample in an atlas cell's padding corner — always plain base color. */
const BLANK_U = 0.002;
const BLANK_V = 0.002;

interface UV {
  u: number;
  v: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/**
 * Build a chamfered, flat-faced BufferGeometry from a die spec:
 * - each polygon face is inset toward its centroid (still in its plane, so
 *   resting contact matches the sharp physics hull),
 * - edges become quads whose two sides carry the adjacent faces' normals
 *   (smooth-shaded bevel),
 * - vertices become blended corner caps.
 * Number UVs shrink with the face so labels keep their size; bevels sample a
 * blank corner of the atlas so they render in the base color.
 */
export function buildDieGeometry(spec: DieSpec, radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const push = (p: Vec3, n: Vec3, uv: UV): void => {
    positions.push(p.x * radius, p.y * radius, p.z * radius);
    normals.push(n.x, n.y, n.z);
    uvs.push(uv.u, uv.v);
  };
  const tri = (a: [Vec3, Vec3, UV], b: [Vec3, Vec3, UV], c: [Vec3, Vec3, UV]): void => {
    push(...a);
    push(...b);
    push(...c);
  };
  const BLANK: UV = { u: BLANK_U, v: BLANK_V };

  // Per-face inset vertices (3D, unit scale) and matching inset UVs.
  // shrunk[f][k] corresponds to spec.faces[f][k].
  const shrunk: Vec3[][] = [];
  const shrunkUV: UV[][] = [];
  for (let f = 0; f < spec.faces.length; f++) {
    const loop = spec.faces[f]!;
    const verts = loop.map((vi) => spec.vertices[vi]!);
    const c: Vec3 = {
      x: verts.reduce((s, p) => s + p.x, 0) / verts.length,
      y: verts.reduce((s, p) => s + p.y, 0) / verts.length,
      z: verts.reduce((s, p) => s + p.z, 0) / verts.length,
    };
    shrunk.push(
      verts.map((p) => ({
        x: c.x + (p.x - c.x) * (1 - CHAMFER),
        y: c.y + (p.y - c.y) * (1 - CHAMFER),
        z: c.z + (p.z - c.z) * (1 - CHAMFER),
      })),
    );
    const layout = computeFaceLayout(spec, f);
    shrunkUV.push(
      layout.uv.map((p) => ({
        u: layout.centroid.u + (p.u - layout.centroid.u) * (1 - CHAMFER),
        v: layout.centroid.v + (p.v - layout.centroid.v) * (1 - CHAMFER),
      })),
    );
  }

  // 1) inset face polygons (flat shading, numbered texture)
  for (let f = 0; f < spec.faces.length; f++) {
    const n = spec.faceNormals[f]!;
    const loop = shrunk[f]!;
    const uv = shrunkUV[f]!;
    for (let k = 1; k < loop.length - 1; k++) {
      tri([loop[0]!, n, uv[0]!], [loop[k]!, n, uv[k]!], [loop[k + 1]!, n, uv[k + 1]!]);
    }
  }

  // 2) bevel quads along each edge, smooth-shaded between the two face normals
  interface EdgeSide {
    face: number;
    ia: number; // index of edge start within the face loop
    ib: number;
  }
  const edges = new Map<string, EdgeSide[]>();
  spec.faces.forEach((loop, f) => {
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k]!;
      const b = loop[(k + 1) % loop.length]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const sides = edges.get(key) ?? [];
      sides.push({ face: f, ia: k, ib: (k + 1) % loop.length });
      edges.set(key, sides);
    }
  });
  for (const sides of edges.values()) {
    const [s1, s2] = sides as [EdgeSide, EdgeSide];
    const n1 = spec.faceNormals[s1.face]!;
    const n2 = spec.faceNormals[s2.face]!;
    // s1 traverses the edge a→b; s2 traverses it b→a (consistent CCW loops)
    const A1 = shrunk[s1.face]![s1.ia]!;
    const B1 = shrunk[s1.face]![s1.ib]!;
    const B2 = shrunk[s2.face]![s2.ia]!;
    const A2 = shrunk[s2.face]![s2.ib]!;
    // outward winding check for the quad [A1, B1, B2, A2]
    const wind = cross(sub(B1, A1), sub(B2, A1));
    const outward = { x: n1.x + n2.x, y: n1.y + n2.y, z: n1.z + n2.z };
    if (dot(wind, outward) >= 0) {
      tri([A1, n1, BLANK], [B1, n1, BLANK], [B2, n2, BLANK]);
      tri([A1, n1, BLANK], [B2, n2, BLANK], [A2, n2, BLANK]);
    } else {
      tri([A1, n1, BLANK], [B2, n2, BLANK], [B1, n1, BLANK]);
      tri([A1, n1, BLANK], [A2, n2, BLANK], [B2, n2, BLANK]);
    }
  }

  // 3) corner caps where the inset faces meet around each original vertex
  for (let v = 0; v < spec.vertices.length; v++) {
    const corner: { p: Vec3; n: Vec3 }[] = [];
    spec.faces.forEach((loop, f) => {
      const k = loop.indexOf(v);
      if (k !== -1) corner.push({ p: shrunk[f]![k]!, n: spec.faceNormals[f]! });
    });
    if (corner.length < 3) continue;
    const d = normalize(spec.vertices[v]!);
    const c: Vec3 = {
      x: corner.reduce((s, e) => s + e.p.x, 0) / corner.length,
      y: corner.reduce((s, e) => s + e.p.y, 0) / corner.length,
      z: corner.reduce((s, e) => s + e.p.z, 0) / corner.length,
    };
    const u0 = normalize(sub(corner[0]!.p, c));
    const w0 = cross(d, u0);
    corner.sort((a, b) => {
      const pa = sub(a.p, c);
      const pb = sub(b.p, c);
      return Math.atan2(dot(pa, w0), dot(pa, u0)) - Math.atan2(dot(pb, w0), dot(pb, u0));
    });
    for (let k = 1; k < corner.length - 1; k++) {
      tri(
        [corner[0]!.p, corner[0]!.n, BLANK],
        [corner[k]!.p, corner[k]!.n, BLANK],
        [corner[k + 1]!.p, corner[k + 1]!.n, BLANK],
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}
