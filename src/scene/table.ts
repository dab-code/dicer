import * as THREE from 'three';

export interface Table {
  /** Show a transparent PNG "ironed on" the middle of the tray; null removes it. */
  setImage(dataUrl: string | null): void;
  /** In-plane logo rotation so it reads upright for the current camera azimuth. */
  setSpin(radians: number): void;
}

const LOGO_SIZE = 4.5; // world units along the image's longer side

/**
 * Minimal "void" floor: an invisible shadow-catcher plane at y = 0 that blends
 * into the scene background (the tray color), so dice appear to rest on the
 * page itself. The walls confining the dice are physics-only and unseen.
 */
export function addTable(scene: THREE.Scene, onImageLoaded?: () => void): Table {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ opacity: 0.16 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const loader = new THREE.TextureLoader();
  let logo: THREE.Mesh | null = null;
  let spin = 0;
  // loads are async — only the latest setImage call may add its mesh
  let requestId = 0;

  function orientLogo(mesh: THREE.Mesh): void {
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.rotateZ(spin);
  }

  function removeLogo(): void {
    if (!logo) return;
    scene.remove(logo);
    const material = logo.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
    logo.geometry.dispose();
    logo = null;
  }

  return {
    setImage(dataUrl) {
      removeLogo();
      const id = ++requestId;
      if (!dataUrl) {
        onImageLoaded?.();
        return;
      }
      loader.load(
        dataUrl,
        (texture) => {
          if (id !== requestId) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          const image = texture.image as { width: number; height: number };
          const aspect = image.width / image.height;
          const w = aspect >= 1 ? LOGO_SIZE : LOGO_SIZE * aspect;
          const h = aspect >= 1 ? LOGO_SIZE / aspect : LOGO_SIZE;
          // matte, slightly translucent and shadow-receiving so it reads as
          // printed on the tray rather than a glossy sticker
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshStandardMaterial({
              map: texture,
              transparent: true,
              opacity: 0.9,
              roughness: 1,
              metalness: 0,
              depthWrite: false,
            }),
          );
          orientLogo(mesh);
          mesh.position.y = 0.01;
          mesh.receiveShadow = true;
          scene.add(mesh);
          logo = mesh;
          onImageLoaded?.();
        },
        undefined,
        // undecodable data URL (e.g. truncated persisted value) — show no
        // logo, but still repaint so the previous one stays removed
        () => onImageLoaded?.(),
      );
    },
    setSpin(radians) {
      if (spin === radians) return;
      spin = radians;
      if (logo) {
        orientLogo(logo);
        onImageLoaded?.();
      }
    },
  };
}
