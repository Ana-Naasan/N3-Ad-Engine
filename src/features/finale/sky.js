import * as THREE from 'three';

// Finale: the large "sky" screen for the VOIDCOLA ad on the upper back wall
// (design/reference.html, still 7). It grows out from behind the TV as the TV shrinks.

const WIDTH = 3.4; // of the 5 m back wall
const HEIGHT = (WIDTH * 9) / 16;
const TV_WIDTH = 1.6;
// In the TV's parent space: 2 cm in front of the back wall (z = -2.6),
// top edge 5 cm under the ceiling (2.8 m), which puts the bottom edge above the postcard.
const POSITION = new THREE.Vector3(0, 2.75 - HEIGHT / 2, -2.58);

export function createSkyScreen() {
  const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), material);
  mesh.visible = false;

  return {
    mesh,

    // A video texture to play on the screen (black until one is set).
    setTexture(texture) {
      if (material.map === texture) return;
      material.map = texture;
      material.color.set(texture ? 0xffffff : 0x000000);
      material.needsUpdate = true;
    },

    // t: 0 = hidden, 0..1 = growing from TV size behind `from` (the TV's start position), 1 = full size.
    update(t, from) {
      mesh.visible = t > 0;
      if (!mesh.visible) return;
      from ??= POSITION;
      mesh.position.set(
        THREE.MathUtils.lerp(from.x, POSITION.x, t),
        THREE.MathUtils.lerp(from.y, POSITION.y, t),
        POSITION.z, // stays against the wall, so it never z-fights the TV
      );
      mesh.scale.setScalar(THREE.MathUtils.lerp(TV_WIDTH / WIDTH, 1, t));
    },
  };
}
