import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicalDieType, RequestDieType } from '../core/types';
import { createSettleTracker, type SettleTracker } from '../physics/settle';
import type { PhysicsWorld } from '../physics/world';
import type { FaceRead } from './faceReader';
import { DIE_SPECS, type DieSpec } from './geometryData';
import { buildDieGeometry } from './diceGeometry';
import { createDieMaterial, getDiceSet, DEFAULT_SET_ID } from './textures';

export const DIE_RADIUS = 1.15;

export interface DieInstance {
  id: number;
  spec: DieSpec;
  /** Which picker selection produced this die (d100 spawns a d10tens+d10 pair). */
  requestType: RequestDieType;
  pairId: number | null;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  tracker: SettleTracker;
  nudges: number;
  rerolls: number;
  read: FaceRead | null;
  // previous/current body transforms for render interpolation
  prevPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  currPos: THREE.Vector3;
  currQuat: THREE.Quaternion;
}

const geometryCache = new Map<PhysicalDieType, THREE.BufferGeometry>();
// materials are cached per colorway and die type: "ink:d20"
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

let activeSetId = DEFAULT_SET_ID;

export function setActiveDiceSet(id: string): void {
  activeSetId = getDiceSet(id).id;
}

export function getDieMaterial(spec: DieSpec): THREE.MeshStandardMaterial {
  const key = `${activeSetId}:${spec.type}`;
  let material = materialCache.get(key);
  if (!material) {
    material = createDieMaterial(spec, getDiceSet(activeSetId));
    materialCache.set(key, material);
  }
  return material;
}

let nextId = 1;

export function createDie(
  type: PhysicalDieType,
  requestType: RequestDieType,
  pairId: number | null,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): DieInstance {
  const spec = DIE_SPECS[type];

  let geometry = geometryCache.get(type);
  if (!geometry) {
    geometry = buildDieGeometry(spec, DIE_RADIUS);
    geometryCache.set(type, geometry);
  }

  const mesh = new THREE.Mesh(geometry, getDieMaterial(spec));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = physics.createDieBody(spec, DIE_RADIUS);

  return {
    id: nextId++,
    spec,
    requestType,
    pairId,
    mesh,
    body,
    tracker: createSettleTracker(),
    nudges: 0,
    rerolls: 0,
    read: null,
    prevPos: new THREE.Vector3(),
    prevQuat: new THREE.Quaternion(),
    currPos: new THREE.Vector3(),
    currQuat: new THREE.Quaternion(),
  };
}

export function disposeDie(die: DieInstance, scene: THREE.Scene, physics: PhysicsWorld): void {
  scene.remove(die.mesh);
  physics.removeBody(die.body);
  // geometry/material are shared per type and stay cached
}

/** Copy the body transform into the interpolation slots (prev ← curr ← body). */
export function captureBodyTransform(die: DieInstance, resetPrev = false): void {
  if (!resetPrev) {
    die.prevPos.copy(die.currPos);
    die.prevQuat.copy(die.currQuat);
  }
  const t = die.body.translation();
  const r = die.body.rotation();
  die.currPos.set(t.x, t.y, t.z);
  die.currQuat.set(r.x, r.y, r.z, r.w);
  if (resetPrev) {
    die.prevPos.copy(die.currPos);
    die.prevQuat.copy(die.currQuat);
  }
}

/** Apply interpolated transform to the mesh for rendering. */
export function syncMesh(die: DieInstance, alpha: number): void {
  die.mesh.position.lerpVectors(die.prevPos, die.currPos, alpha);
  die.mesh.quaternion.slerpQuaternions(die.prevQuat, die.currQuat, alpha);
}
