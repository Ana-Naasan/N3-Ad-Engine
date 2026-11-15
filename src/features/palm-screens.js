import * as THREE from 'three';
import { PALM_NORMAL_SIGN } from '../sensors/hands.js';

// The ad on the palms: while output.target is 'palms', a small screen floats
// just off each tracked palm, showing the TV's current texture (ctx.tv.texture).
// The TV dim itself is applied by tv-screen from output.tvDim.
const SCREEN_WIDTH = 0.09; // m
const SCREEN_HEIGHT = SCREEN_WIDTH * (9 / 16);
const SCREEN_OFFSET = 0.02; // m out from the palm centre
const PALM_JOINT = 'middle-finger-metacarpal';

export default function palmScreens({ renderer, tv }) {
  const material = new THREE.MeshBasicMaterial({ map: tv.texture, side: THREE.DoubleSide, toneMapped: false });
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
    screen.renderOrder = 1;
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
      const joint = hand.joints[PALM_JOINT];
      screen.visible = Boolean(on && hand.visible && joint?.visible);
      if (screen.visible) {
        screen.position.copy(joint.position);
        screen.quaternion.copy(joint.quaternion);
        shown++;
      }
    }
    return { debug: { palmScreens: shown } };
  };
}
