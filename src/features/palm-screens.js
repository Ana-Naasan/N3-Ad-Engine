import * as THREE from 'three';
import { PALM_NORMAL_SIGN } from '../sensors/hands.js';

// The ad on the palms: while output.target is 'palms', a screen floats just off
// each tracked palm, showing the TV's current texture (ctx.tv.texture).
// The TV dim itself is applied by tv-screen from output.tvDim.
//
// The screen is drawn over the hand, whatever is in front of it: with the hands
// at the face the fingers curl towards the eyes, and a screen that close to the
// palm would otherwise be cut up by the hand mesh.
const SCREEN_WIDTH = 0.11; // m: two side by side just about meet with a hand over each eye
const SCREEN_HEIGHT = SCREEN_WIDTH * (9 / 16);
const SCREEN_OFFSET = 0.03; // m out from the palm centre
// The palm centre is halfway along the middle finger's metacarpal bone: WebXR
// puts that joint at the bone's wrist end, and the next joint at the knuckle.
const PALM_BASE = 'middle-finger-metacarpal';
const PALM_KNUCKLE = 'middle-finger-phalanx-proximal';
const RENDER_ORDER = 15; // over the red tint (10) and the banner (11), under the domain's caption (20)

export default function palmScreens({ renderer, tv }) {
  const material = new THREE.MeshBasicMaterial({
    map: tv.texture,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true, // drawn after the opaque hand meshes
    depthTest: false, // and never hidden by them
    depthWrite: false,
  });
  // Plane faces +Z with image-up +Y. Turn it so it faces out of the palm
  // (joint -Y) with image-up towards the fingertips (joint -Z).
  const geometry = new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT);
  geometry.rotateZ(Math.PI);
  geometry.rotateX(PALM_NORMAL_SIGN * -Math.PI / 2);
  geometry.translate(0, PALM_NORMAL_SIGN * SCREEN_OFFSET, 0);

  const screens = [0, 1].map((i) => {
    const hand = renderer.xr.getHand(i);
    const screen = new THREE.Mesh(geometry, material);
    screen.visible = false;
    screen.renderOrder = RENDER_ORDER;
    hand.add(screen); // hand space = scene space for joint poses
    return { hand, screen };
  });

  return (output) => {
    const on = output.target === 'palms';
    if (on && material.map !== tv.texture) {
      material.map = tv.texture;
      material.needsUpdate = true;
    }
    let shown = 0;
    for (const { hand, screen } of screens) {
      const base = hand.joints[PALM_BASE];
      const knuckle = hand.joints[PALM_KNUCKLE];
      screen.visible = Boolean(on && hand.visible && base?.visible);
      if (screen.visible) {
        screen.position.copy(base.position);
        if (knuckle?.visible) screen.position.lerp(knuckle.position, 0.5);
        screen.quaternion.copy(base.quaternion);
        shown++;
      }
    }
    return { debug: { palmScreens: shown } };
  };
}
