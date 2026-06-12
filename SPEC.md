# Spec: dicer-3d — 3D Dice Roller for TTRPGs

## Objective
Browser-based 3D dice roller for tabletop RPG players. Select any combination of
d4/d6/d8/d10/d12/d20/d100 plus a flat modifier, throw them with real physics on a 3D
table, and read each die's result from its settled orientation. Success: the reported
value always matches the visible top face, rolls feel natural, and a 20-die roll runs
at ~60 fps on a mid-range phone.

## Tech Stack
TypeScript ~5.6, Vite ^6, Three.js ^0.170, @dimforge/rapier3d-compat ^0.14, Vitest ^3.
No UI framework, no backend.

## Commands
Dev:   npm run dev
Build: npm run build
Test:  npm test            (vitest run)
Watch: npm test -- --watch

## Project Structure
src/core    → pure domain logic (types, notation, history, random) — no three/rapier
src/dice    → geometry data, face reader (pure), render geometry, textures, factory
src/physics → Rapier world, throw mechanics, settle detection (pure state machine)
src/scene   → renderer, table
src/app     → roll controller (orchestration)
src/ui      → picker, controls, results, history views
Tests co-located as *.test.ts next to the module they cover.

## Code Style
- Strict TS (`strict: true`); no `any` in src/core and src/dice pure modules.
- Pure modules (core/, geometryData, faceReader, settle) import neither Three.js nor
  Rapier — they take/return plain data ({x,y,z,w} quats, number magnitudes).
- Named exports; one concern per file; camelCase functions, PascalCase types.

Example:
  export function readFace(spec: DieGeometryData, q: Quat): number | 'cocked' {
    const sign = spec.readsDownFace ? -1 : 1;
    ...
  }

## Testing Strategy
Vitest, node environment. Unit-test everything pure: geometry invariants (face counts,
value multisets, opposite-face sums, unit outward normals), faceReader randomized
round-trips (rotate face i up → expect value i, all faces, all 7 specs), notation/total
math incl. d100 edge cases, settle state machine on synthetic velocity streams, history
store, UV bounds. Rendering/physics feel verified manually via a `?debug` overlay that
prints each die's read value above it.

## Boundaries
- Always: run `npm test` before considering a task done; keep pure modules free of
  three/rapier imports; dispose meshes/bodies on clear.
- Ask first: adding dependencies beyond the listed ones; changing the physics engine;
  adding backend/network features.
- Never: predetermine roll results (physics is the RNG); commit node_modules or
  build output.

## Success Criteria
- Reported values match visible top faces over 50 debug-overlay rolls, all die types.
- 2d6+3-style rolls show per-die chips + correct total; d100 pairs tens+units (00+0→100).
- Reroll repeats the same set; Clear empties table; history logs every finalized roll.
- 20 thrown dice all settle within 8 s, in bounds; cocked dice are auto-nudged/rerolled.
- Usable at 360 px width; ~60 fps with 20 dice on mid-range mobile.

## Open Questions
None — decisions confirmed 2026-06-11 (Rapier physics, full set, vanilla TS, history +
modifiers + reroll/clear in v1).
