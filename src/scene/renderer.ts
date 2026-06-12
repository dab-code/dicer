import * as THREE from 'three';
import { TABLE } from '../physics/world';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render(): void;
  /** Set the tray/void color behind and beneath the dice. */
  setBackground(color: string): void;
  /** Project a world position to container-relative pixel coordinates. */
  project(position: THREE.Vector3): { x: number; y: number; behind: boolean };
  onResize(cb: () => void): void;
}

const ELEVATION = (66 * Math.PI) / 180;

export function createSceneContext(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#faf9f6');

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight('#ffffff', '#dcdcdc', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.far = 50;
  scene.add(sun);

  const resizeCallbacks: (() => void)[] = [];

  function fitCamera(): void {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height);
    camera.aspect = width / height;

    // Fit the play area rectangle; this close to top-down the depth is barely
    // foreshortened. In portrait, view the table from the side (90° azimuth)
    // so its long axis runs along the screen's long axis — dice stay big.
    const portrait = camera.aspect < 1;
    // wider fov on portrait phones: the camera can sit much closer while the
    // table still fits across the narrow screen axis → visibly bigger dice
    camera.fov = portrait ? 56 : 45;
    const halfLong = TABLE.width / 2 + 0.6;
    const halfShort = TABLE.depth / 2 + 0.6;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const horiz = portrait ? halfShort : halfLong;
    const vert = portrait ? halfLong : halfShort;
    const dist = Math.max(horiz / Math.tan(hHalf), vert / Math.tan(vHalf)) * 1.05;
    const azimuth = portrait ? Math.PI / 2 : 0;
    camera.position.set(
      dist * Math.cos(ELEVATION) * Math.sin(azimuth),
      dist * Math.sin(ELEVATION),
      dist * Math.cos(ELEVATION) * Math.cos(azimuth),
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    for (const cb of resizeCallbacks) cb();
  }

  fitCamera();
  new ResizeObserver(fitCamera).observe(container);

  const projected = new THREE.Vector3();

  return {
    scene,
    camera,
    renderer,
    render: () => renderer.render(scene, camera),
    setBackground: (color) => (scene.background as THREE.Color).set(color),
    project(position) {
      projected.copy(position).project(camera);
      return {
        x: ((projected.x + 1) / 2) * container.clientWidth,
        y: ((1 - projected.y) / 2) * container.clientHeight,
        behind: projected.z > 1,
      };
    },
    onResize: (cb) => resizeCallbacks.push(cb),
  };
}
