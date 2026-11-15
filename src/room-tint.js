import * as THREE from 'three';

// The red room tint for looking away (reference still 2). A translucent red
// shell around the viewer, drawn over everything with a lower renderOrder,
// TV included. Add it to the scene or `world`: the viewer only has to be inside.

export const TINT_COLOR = 0x96000a; // still 2: rgba(150, 0, 10, 0.45)
export const TINT_OPACITY = 0.45;
export const TINT_RENDER_ORDER = 10; // anything drawn after this stays untinted (the banner)

const SHELL_RADIUS = 8; // metres: bigger than the 5 x 6 m room, well inside the camera's far plane

export function createRoomTint() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(SHELL_RADIUS, 16, 8),
    new THREE.MeshBasicMaterial({
      color: TINT_COLOR,
      transparent: true,
      opacity: TINT_OPACITY,
      side: THREE.BackSide,
      depthTest: false, // cover the whole view, whatever is in front of the shell
      depthWrite: false,
    }),
  );
  mesh.renderOrder = TINT_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.visible = false;

  return {
    mesh,
    setOn(on) {
      mesh.visible = Boolean(on);
    },
  };
}
