import * as THREE from 'three';

// Finale: the TV shrinks to a postcard resting on its cabinet (design/reference.html, still 7).
// A face covers the screen while it shrinks, showing a still of the video the viewer
// came to watch, so the giant ad on the sky screen isn't repeated on the postcard.

const SHRINK_SECONDS = 1.5;
const GROW_SECONDS = 0.6; // the pop-up: the TV grows back to full size, as if the video resumes
const POSTCARD_SCALE = 0.25; // the 1.6 x 0.9 m screen becomes 0.4 x 0.225 m
const CABINET_TOP = 0.5; // room.js: the cabinet is 0.5 m tall
const BEZEL_HEIGHT = 0.98; // tv.js
const TV_Z = -2.2; // main.js: TV_DISTANCE in front of the viewer
// In the TV's parent space: left of centre, sitting on the cabinet with a 1 cm gap.
const POSTCARD_POSITION = new THREE.Vector3(-0.45, CABINET_TOP + 0.01 + (BEZEL_HEIGHT * POSTCARD_SCALE) / 2, TV_Z);

const ease = (x) => x * x * (3 - 2 * x);

// getFaceTexture() is read at finale entry: the content of this run.
export function createPostcard(tvGroup, getFaceTexture) {
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial());
  face.position.z = 0.002; // just in front of the TV screen
  face.visible = false;
  tvGroup.add(face);

  let start = null; // the TV's time and pose at finale entry
  let growStart = null; // when the pop-up started the TV growing back

  return {
    // Call once per frame with the finale flag, the time in seconds and the
    // pop-up flag (the TV grows back to full size, still showing the video).
    // Returns the eased shrink progress (0 = full-size TV, 1 = postcard), which
    // the sky screen and receipt follow; the TV growing back doesn't undo it.
    update(active, time, popup = false) {
      if (!active) {
        growStart = null;
        if (start) { // a restart left the finale: the TV goes back to full size
          tvGroup.position.copy(start.position);
          tvGroup.scale.copy(start.scale);
          face.visible = false;
          start = null;
        }
        return 0;
      }
      if (!start) {
        start = { time, position: tvGroup.position.clone(), scale: tvGroup.scale.clone() };
        face.material.map = getFaceTexture();
        face.material.needsUpdate = true;
      }
      const shrink = ease(THREE.MathUtils.clamp((time - start.time) / SHRINK_SECONDS, 0, 1));
      if (popup && growStart === null) growStart = time;
      const grow = growStart === null ? 0 : ease(THREE.MathUtils.clamp((time - growStart) / GROW_SECONDS, 0, 1));
      const pose = shrink * (1 - grow);
      tvGroup.position.lerpVectors(start.position, POSTCARD_POSITION, pose);
      tvGroup.scale.copy(start.scale).multiplyScalar(THREE.MathUtils.lerp(1, POSTCARD_SCALE, pose));
      face.visible = true;
      return shrink;
    },

    // True once the TV has fully grown back for the pop-up.
    get grown() {
      return growStart !== null && tvGroup.scale.x >= (start?.scale.x ?? 1) * 0.999;
    },

    // The TV's position at finale entry, or null before the finale.
    get startPosition() {
      return start?.position ?? null;
    },
  };
}
