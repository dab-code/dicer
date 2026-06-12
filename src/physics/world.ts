import RAPIER from '@dimforge/rapier3d-compat';
import type { DieSpec } from '../dice/geometryData';

export const TABLE = {
  width: 16,
  depth: 11,
  wallHeight: 12,
};

export const PHYSICS_STEP_MS = 1000 / 60;

export interface PhysicsWorld {
  step(): void;
  createDieBody(spec: DieSpec, radius: number): RAPIER.RigidBody;
  removeBody(body: RAPIER.RigidBody): void;
}

export async function createPhysicsWorld(): Promise<PhysicsWorld> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -40, z: 0 });
  world.timestep = PHYSICS_STEP_MS / 1000;

  const { width: w, depth: d, wallHeight: h } = TABLE;
  const fixed = (desc: RAPIER.ColliderDesc) =>
    world.createCollider(desc.setFriction(0.6).setRestitution(0.2));

  // floor (top surface at y = 0)
  fixed(RAPIER.ColliderDesc.cuboid(w / 2 + 2, 0.5, d / 2 + 2).setTranslation(0, -0.5, 0));
  // walls just outside the visible table edges (colliders only, no meshes)
  fixed(RAPIER.ColliderDesc.cuboid(0.5, h / 2, d / 2 + 2).setTranslation(w / 2 + 0.5, h / 2, 0));
  fixed(RAPIER.ColliderDesc.cuboid(0.5, h / 2, d / 2 + 2).setTranslation(-w / 2 - 0.5, h / 2, 0));
  fixed(RAPIER.ColliderDesc.cuboid(w / 2 + 2, h / 2, 0.5).setTranslation(0, h / 2, d / 2 + 0.5));
  fixed(RAPIER.ColliderDesc.cuboid(w / 2 + 2, h / 2, 0.5).setTranslation(0, h / 2, -d / 2 - 0.5));
  // ceiling so violent throws can't eject dice
  fixed(RAPIER.ColliderDesc.cuboid(w / 2 + 2, 0.5, d / 2 + 2).setTranslation(0, h + 0.5, 0));

  return {
    step: () => world.step(),

    createDieBody(spec, radius) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setAngularDamping(0.15).setCcdEnabled(true),
      );
      let collider: RAPIER.ColliderDesc;
      if (spec.type === 'd6') {
        const half = radius / Math.sqrt(3);
        collider = RAPIER.ColliderDesc.cuboid(half, half, half);
      } else {
        const points = new Float32Array(spec.vertices.length * 3);
        spec.vertices.forEach((v, i) => {
          points[i * 3] = v.x * radius;
          points[i * 3 + 1] = v.y * radius;
          points[i * 3 + 2] = v.z * radius;
        });
        const hull = RAPIER.ColliderDesc.convexHull(points);
        if (!hull) throw new Error(`convex hull failed for ${spec.type}`);
        collider = hull;
      }
      world.createCollider(collider.setFriction(0.4).setRestitution(0.3).setDensity(1), body);
      return body;
    },

    removeBody(body) {
      world.removeRigidBody(body);
    },
  };
}
