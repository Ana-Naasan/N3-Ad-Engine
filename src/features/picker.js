import * as THREE from 'three';

// Draws the video picker (see src/sensors/picker.js). While the card shows,
// the TV gets the YouTube mirror's texture, and each pointer gets a cursor on
// the screen plus a ray from the hand. Frames keep coming while the card or a
// mirror-picked content is on screen. Each time the card comes up in VR (on
// entering VR, or a restart from the finale) the mirror goes back to its start page.
// Without a mirror the TV keeps its "Pinch to play" card.

const AMBER = 0xe9a03b;
const CURSOR_Z = 0.004; // m in front of the screen; the finale's postcard face is at 0.002
const SCREEN_W = 1.6; // m, the screen in tv.js
const SCREEN_H = 0.9;

function makeCursor() {
  const cursor = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CircleGeometry(0.016, 24), new THREE.MeshBasicMaterial({ color: 0x14100c }));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), new THREE.MeshBasicMaterial({ color: AMBER }));
  dot.position.z = 0.0005;
  cursor.add(rim, dot);
  cursor.visible = false;
  return cursor;
}

function makeRay() {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const ray = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.45 }));
  ray.frustumCulled = false; // its two points move every frame
  ray.visible = false;
  return ray;
}

export default function pickerFeature({ scene, tv, picker }) {
  const { mirror, pointers } = picker;
  const cursors = pointers.map(() => makeCursor());
  tv.group.add(...cursors);
  // Rays for the two XR pointers; the mouse (pointer 2) has none.
  const rays = [makeRay(), makeRay()];
  scene.add(...rays);
  let wasOnCard = false;
  let wasBrowsing = false;

  return (output) => {
    const onCard = output.screen === 'card';
    const { active } = picker; // only an XR session (or ?mirror) drives the shared mirror
    if (onCard && !wasOnCard) tv.resetContent();
    if (onCard && active && !wasBrowsing) mirror.reset(); // also on entering VR with the card up
    wasOnCard = onCard;
    wasBrowsing = onCard && active;
    mirror.setWanted(active && (onCard || (output.screen === 'content' && !tv.contentId)));
    if (onCard) tv.setLive(active && mirror.available ? mirror.texture : null);
    picker.showing = onCard && active && mirror.available;

    pointers.forEach((pointer, i) => {
      const { hit } = pointer;
      const visible = Boolean(picker.showing && hit);
      cursors[i].visible = visible;
      if (visible) {
        cursors[i].position.set((hit.x - 0.5) * SCREEN_W, (0.5 - hit.y) * SCREEN_H, CURSOR_Z);
        cursors[i].scale.setScalar(pointer.down ? 0.7 : 1); // pressed
      }
      const ray = rays[i];
      if (!ray) return;
      ray.visible = visible;
      if (visible) {
        const position = ray.geometry.attributes.position;
        position.setXYZ(0, pointer.origin.x, pointer.origin.y, pointer.origin.z);
        position.setXYZ(1, pointer.point.x, pointer.point.y, pointer.point.z);
        position.needsUpdate = true;
      }
    });
  };
}
