import * as THREE from 'three';
import type { DieSpec } from './geometryData';
import { computeFaceLayout } from './faceLayout';

const ATLAS_SIZE = 1024;

export interface DiceSet {
  id: string;
  name: string;
  base: string;
  text: string;
}

/** Selectable dice colorways: muted ink tones, vivid candy, and light sets. */
export const DICE_SETS: DiceSet[] = [
  { id: 'ink', name: 'Ink', base: '#2b2b2e', text: '#ffffff' },
  { id: 'crimson', name: 'Crimson', base: '#8e2f39', text: '#ffffff' },
  { id: 'indigo', name: 'Indigo', base: '#38456e', text: '#ffffff' },
  { id: 'forest', name: 'Forest', base: '#2f5d46', text: '#ffffff' },
  { id: 'ochre', name: 'Ochre', base: '#a06b22', text: '#ffffff' },
  { id: 'plum', name: 'Plum', base: '#5d3a64', text: '#ffffff' },
  { id: 'cherry', name: 'Cherry', base: '#e2384a', text: '#ffffff' },
  { id: 'cobalt', name: 'Cobalt', base: '#2563eb', text: '#ffffff' },
  { id: 'emerald', name: 'Emerald', base: '#10a35e', text: '#ffffff' },
  { id: 'tangerine', name: 'Tangerine', base: '#f97316', text: '#ffffff' },
  { id: 'bone', name: 'Bone', base: '#ece6d9', text: '#26262a' },
  { id: 'sky', name: 'Sky', base: '#cfe3f5', text: '#26262a' },
];

export const DEFAULT_SET_ID = 'ink';

export function getDiceSet(id: string): DiceSet {
  return DICE_SETS.find((set) => set.id === id) ?? DICE_SETS[0]!;
}

// --- color helpers -----------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** amount > 0 blends toward white, < 0 toward black. */
function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** The d100 tens die uses a shifted shade so percentile pairs stay tellable. */
function baseFor(spec: DieSpec, set: DiceSet): string {
  if (spec.type !== 'd10tens') return set.base;
  return isLight(set.base) ? shade(set.base, -0.22) : shade(set.base, 0.3);
}

// --- texture painting --------------------------------------------------------

/** Labels that read as another number upside down get an underline. */
function needsUnderline(label: string): boolean {
  return label === '6' || label === '9' || label === '60' || label === '90';
}

const toCanvas = (uv: { u: number; v: number }) => ({
  x: uv.u * ATLAS_SIZE,
  y: (1 - uv.v) * ATLAS_SIZE, // UV v-up → canvas y-down (flipY texture)
});

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  fontPx: number,
  color: string,
  angle = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `700 ${Math.round(fontPx)}px 'Arial', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const maxWidth = fontPx * 1.7;
  ctx.fillText(label, 0, 0, maxWidth);
  if (needsUnderline(label)) {
    const width = Math.min(ctx.measureText(label).width, maxWidth);
    ctx.lineWidth = Math.max(3, fontPx * 0.07);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(-width / 2, fontPx * 0.62);
    ctx.lineTo(width / 2, fontPx * 0.62);
    ctx.stroke();
  }
  ctx.restore();
}

export function createDieTexture(spec: DieSpec, set: DiceSet): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  const base = baseFor(spec, set);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  for (let f = 0; f < spec.sides; f++) {
    const layout = computeFaceLayout(spec, f);
    const inradiusPx = layout.inradius * ATLAS_SIZE;

    if (spec.type === 'd4') {
      // base-numbered: along each edge, print the value of the face on the
      // other side, upright when that edge is at the bottom — so the rolled
      // (table-resting) face's value reads along the bottom of every visible
      // face
      const loop = spec.faces[f]!;
      layout.edges.forEach((edge, k) => {
        const a = loop[k]!;
        const b = loop[(k + 1) % loop.length]!;
        const neighbor = spec.faces.findIndex(
          (other, g) => g !== f && other.includes(a) && other.includes(b),
        );
        const p = toCanvas(edge);
        const inward = edge.angle + Math.PI; // text-up points away from the edge
        const canvasAngle = Math.atan2(-Math.sin(inward), Math.cos(inward));
        drawLabel(
          ctx,
          String(spec.faceValues[neighbor]!),
          p.x,
          p.y,
          inradiusPx * 0.52,
          set.text,
          canvasAngle + Math.PI / 2,
        );
      });
    } else {
      const p = toCanvas(layout.centroid);
      const isTwoDigit = spec.faceLabels[f]!.length > 1;
      const fontPx = inradiusPx * (isTwoDigit ? 0.95 : 1.25);
      drawLabel(ctx, spec.faceLabels[f]!, p.x, p.y, fontPx, set.text);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createDieMaterial(spec: DieSpec, set: DiceSet): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createDieTexture(spec, set),
    roughness: 0.35,
    metalness: 0.05,
  });
}
