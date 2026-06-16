// Generates the source app-icon / splash images that @capacitor/assets consumes.
// Run with: node scripts/generate-app-assets.mjs
// Re-run whenever the brand mark changes, then `npx cap-assets generate`.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');

const INK = '#1f1f23';
const PAPER = '#faf9f6';

/** A rounded-square die showing the quincunx (5) face, centred in a `box` canvas. */
function die(box, side, opts = {}) {
  const r = side * 0.21;
  const x = (box - side) / 2;
  const y = (box - side) / 2;
  const cx = box / 2;
  const cy = box / 2;
  const d = side * 0.26;
  const pip = side * 0.082;
  const face = opts.face ?? PAPER;
  const ink = opts.pip ?? INK;
  const pips = [
    [cx, cy],
    [cx - d, cy - d],
    [cx + d, cy - d],
    [cx - d, cy + d],
    [cx + d, cy + d],
  ];
  return `
    <rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${r}" ry="${r}"
      fill="${face}" />
    ${pips
      .map(([px, py]) => `<circle cx="${px}" cy="${py}" r="${pip}" fill="${ink}" />`)
      .join('\n    ')}`;
}

function svg(box, body, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
    ${bg ? `<rect width="${box}" height="${box}" fill="${bg}" />` : ''}
    ${body}
  </svg>`;
}

async function png(name, markup) {
  await writeFile(join(out, name), await sharp(Buffer.from(markup)).png().toBuffer());
  console.log('wrote', name);
}

await mkdir(out, { recursive: true });

// Adaptive icon: transparent foreground (die in the safe zone) + solid background.
await png('icon-foreground.png', svg(1024, die(1024, 560), null));
await png('icon-background.png', svg(1024, '', INK));
// Non-adaptive / iOS icon: full-bleed die on ink.
await png('icon-only.png', svg(1024, die(1024, 680), INK));
// Splash screens (light + dark both use the dark table look).
await png('splash.png', svg(2732, die(2732, 760), INK));
await png('splash-dark.png', svg(2732, die(2732, 760), INK));
