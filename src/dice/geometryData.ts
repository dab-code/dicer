import type { PhysicalDieType, Vec3 } from '../core/types';

/**
 * Canonical geometry per die type — single source of truth for rendering,
 * physics colliders, and result reading. Pure data, no three/rapier imports.
 */
export interface DieSpec {
  type: PhysicalDieType;
  sides: number;
  /** Vertices at ~unit circumradius, canonical orientation. */
  vertices: Vec3[];
  /** Polygon faces as vertex-index loops, CCW viewed from outside. */
  faces: number[][];
  /** Unit outward normal per face. */
  faceNormals: Vec3[];
  /** Scored value per face (digits for d10/d10tens; see core/notation for scoring). */
  faceValues: number[];
  /** Printed label per face. */
  faceLabels: string[];
  /** d4 reads the face resting on the table instead of the face pointing up. */
  readsDownFace: boolean;
  /** Max tilt of the winning normal from vertical before the die counts as cocked. */
  cockedThresholdDeg: number;
}

// ---------------------------------------------------------------------------
// Vector helpers (pure, dependency-free; shared with faceLayout)
// ---------------------------------------------------------------------------

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / length(a));

export function centroid(points: Vec3[]): Vec3 {
  const c = points.reduce((acc, p) => v3(acc.x + p.x, acc.y + p.y, acc.z + p.z), v3(0, 0, 0));
  return scale(c, 1 / points.length);
}

/** Newell's method — robust polygon normal for (near-)planar loops. */
function polygonNormal(points: Vec3[]): Vec3 {
  const n = v3(0, 0, 0);
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return normalize(n);
}

// ---------------------------------------------------------------------------
// Face construction
// ---------------------------------------------------------------------------

/**
 * For each support direction, collect the vertices extremal along it (the face
 * of the convex polyhedron whose outward normal is that direction) and order
 * them CCW viewed from outside.
 */
function facesFromSupportDirections(vertices: Vec3[], dirs: Vec3[]): number[][] {
  return dirs.map((rawDir) => {
    const d = normalize(rawDir);
    const dots = vertices.map((v) => dot(v, d));
    const max = Math.max(...dots);
    const idx = vertices.map((_, i) => i).filter((i) => dots[i]! > max - 1e-6);
    if (idx.length < 3) throw new Error('support direction does not define a face');
    const c = centroid(idx.map((i) => vertices[i]!));
    const u = normalize(sub(vertices[idx[0]!]!, c));
    const w = cross(d, u); // (u, w, d) right-handed → ascending angle = CCW from outside
    const angle = (i: number) => {
      const p = sub(vertices[i]!, c);
      return Math.atan2(dot(p, w), dot(p, u));
    };
    return idx.slice().sort((a, b) => angle(a) - angle(b));
  });
}

/**
 * Fix each face loop so it winds CCW viewed from outside (origin-centered
 * convex solid) and return the outward unit normals. Mutates `faces` in place;
 * idempotent.
 */
function orientFacesOutward(vertices: Vec3[], faces: number[][]): Vec3[] {
  return faces.map((loop, i) => {
    const points = loop.map((vi) => vertices[vi]!);
    let normal = polygonNormal(points);
    if (dot(normal, centroid(points)) < 0) {
      faces[i] = loop.slice().reverse();
      normal = scale(normal, -1);
    }
    return normal;
  });
}

/** Pair faces by antipodal normals; pair k gets (values[k], values[N-1-k]). */
function assignOppositeValues(normals: Vec3[], sortedValues: number[]): number[] {
  const n = normals.length;
  const result = new Array<number>(n).fill(NaN);
  const used = new Set<number>();
  let pair = 0;
  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue;
    const j = normals.findIndex((m, k) => !used.has(k) && k !== i && dot(normals[i]!, m) < -0.9999);
    if (j === -1) throw new Error('die is not centrosymmetric; cannot pair opposite faces');
    used.add(i).add(j);
    result[i] = sortedValues[pair]!;
    result[j] = sortedValues[n - 1 - pair]!;
    pair++;
  }
  return result;
}

interface BuildOptions {
  faceValues: number[];
  faceLabels?: string[];
  readsDownFace?: boolean;
  cockedThresholdDeg: number;
}

function buildSpec(
  type: PhysicalDieType,
  vertices: Vec3[],
  faces: number[][],
  opts: BuildOptions,
): DieSpec {
  const faceNormals = orientFacesOutward(vertices, faces);
  return {
    type,
    sides: faces.length,
    vertices,
    faces,
    faceNormals,
    faceValues: opts.faceValues,
    faceLabels: opts.faceLabels ?? opts.faceValues.map(String),
    readsDownFace: opts.readsDownFace ?? false,
    cockedThresholdDeg: opts.cockedThresholdDeg,
  };
}

// ---------------------------------------------------------------------------
// Die definitions
// ---------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;

function buildD4(): DieSpec {
  const vertices = [v3(1, 1, 1), v3(-1, -1, 1), v3(-1, 1, -1), v3(1, -1, -1)].map(normalize);
  // each face is opposite one vertex; its outward normal is −(that vertex)
  const faces = facesFromSupportDirections(
    vertices,
    vertices.map((v) => scale(v, -1)),
  );
  // base-numbered: resting on face i ⇒ result is faceValues[i]; the textures
  // print each neighbor's value along the shared edge so the result reads
  // along the bottom edge of every visible face
  return buildSpec('d4', vertices, faces, {
    faceValues: [1, 2, 3, 4],
    readsDownFace: true,
    cockedThresholdDeg: 10,
  });
}

function buildD6(): DieSpec {
  const s = 1 / Math.sqrt(3);
  const vertices: Vec3[] = [];
  for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) vertices.push(v3(x, y, z));
  const dirs = [v3(1, 0, 0), v3(-1, 0, 0), v3(0, 1, 0), v3(0, -1, 0), v3(0, 0, 1), v3(0, 0, -1)];
  const faces = facesFromSupportDirections(vertices, dirs);
  const normals = orientFacesOutward(vertices, faces);
  return buildSpec('d6', vertices, faces, {
    faceValues: assignOppositeValues(normals, [1, 2, 3, 4, 5, 6]),
    cockedThresholdDeg: 8,
  });
}

function buildD8(): DieSpec {
  const vertices = [v3(1, 0, 0), v3(-1, 0, 0), v3(0, 1, 0), v3(0, -1, 0), v3(0, 0, 1), v3(0, 0, -1)];
  const dirs: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) dirs.push(v3(x, y, z));
  const faces = facesFromSupportDirections(vertices, dirs);
  const normals = orientFacesOutward(vertices, faces);
  return buildSpec('d8', vertices, faces, {
    faceValues: assignOppositeValues(normals, [1, 2, 3, 4, 5, 6, 7, 8]),
    cockedThresholdDeg: 10,
  });
}

/**
 * Pentagonal trapezohedron. Ring height h = (1−cos36°)/(1+cos36°) = tan²(18°)
 * makes the kite faces exactly planar for apexes at y = ±1.
 */
function buildD10(type: 'd10' | 'd10tens'): DieSpec {
  const h = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
  const vertices: Vec3[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    vertices.push(v3(Math.cos(a), i % 2 === 0 ? h : -h, Math.sin(a)));
  }
  const TOP = 10;
  const BOT = 11;
  vertices.push(v3(0, 1, 0), v3(0, -1, 0));

  const faces: number[][] = [];
  for (let k = 0; k < 5; k++) {
    // top kite: apex, +h vert, −h tip, +h vert
    faces.push([TOP, 2 * k, 2 * k + 1, (2 * k + 2) % 10]);
    // bottom kite: apex, −h vert, +h tip, −h vert
    faces.push([BOT, 2 * k + 1, (2 * k + 2) % 10, (2 * k + 3) % 10]);
  }
  const normals = orientFacesOutward(vertices, faces);
  const digits =
    type === 'd10' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  const faceValues = assignOppositeValues(normals, digits);
  const faceLabels = faceValues.map((value) =>
    type === 'd10tens' ? (value === 0 ? '00' : String(value)) : String(value),
  );
  return buildSpec(type, vertices, faces, {
    faceValues,
    faceLabels,
    cockedThresholdDeg: 12,
  });
}

function buildD12(): DieSpec {
  const q = 1 / PHI;
  const raw: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) raw.push(v3(x, y, z));
  for (const a of [-q, q]) for (const b of [-PHI, PHI]) {
    raw.push(v3(0, a, b), v3(a, b, 0), v3(b, 0, a));
  }
  const vertices = raw.map(normalize);
  // face normals of this dodecahedron = (±1, 0, ±φ) and cyclic permutations
  const dirs: Vec3[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) {
    dirs.push(v3(a, 0, b), v3(0, b, a), v3(b, a, 0));
  }
  const faces = facesFromSupportDirections(vertices, dirs);
  const normals = orientFacesOutward(vertices, faces);
  return buildSpec('d12', vertices, faces, {
    faceValues: assignOppositeValues(normals, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    cockedThresholdDeg: 8,
  });
}

function buildD20(): DieSpec {
  const raw: Vec3[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) {
    raw.push(v3(0, a, b), v3(a, b, 0), v3(b, 0, a));
  }
  const vertices = raw.map(normalize);
  // face normals of this icosahedron = (±1,±1,±1) plus (±1/φ, 0, ±φ) and cyclic
  const dirs: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) dirs.push(v3(x, y, z));
  for (const a of [-1 / PHI, 1 / PHI]) for (const b of [-PHI, PHI]) {
    dirs.push(v3(a, 0, b), v3(0, b, a), v3(b, a, 0));
  }
  const faces = facesFromSupportDirections(vertices, dirs);
  const normals = orientFacesOutward(vertices, faces);
  return buildSpec('d20', vertices, faces, {
    faceValues: assignOppositeValues(
      normals,
      Array.from({ length: 20 }, (_, i) => i + 1),
    ),
    cockedThresholdDeg: 8,
  });
}

export const DIE_SPECS: Record<PhysicalDieType, DieSpec> = {
  d4: buildD4(),
  d6: buildD6(),
  d8: buildD8(),
  d10: buildD10('d10'),
  d10tens: buildD10('d10tens'),
  d12: buildD12(),
  d20: buildD20(),
};

export const PHYSICAL_DIE_TYPES = Object.keys(DIE_SPECS) as PhysicalDieType[];
