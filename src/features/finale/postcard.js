import * as THREE from 'three';

// Finale: the TV shrinks to a postcard resting on its cabinet (design/reference.html, still 7).
// An optional face texture covers the screen while it shrinks, e.g. a still of the video
// the viewer came to watch, so the giant ad on the sky screen isn't repeated on the postcard.

const SHRINK_SECONDS = 1.5;
const POSTCARD_SCALE = 0.25; // the 1.6 x 0.9 m screen becomes 0.4 x 0.225 m
const CABINET_TOP = 0.5; // room.js: the cabinet is 0.5 m tall
const BEZEL_HEIGHT = 0.98; // tv.js
// In the TV's parent space: left of centre, sitting on the cabinet with a 1 cm gap.
const POSTCARD_POSITION = new THREE.Vector3(-0.45, CABINET_TOP + 0.01 + (BEZEL_HEIGHT * POSTCARD_SCALE) / 2, -2.2);

const ease = (t) => t * t * (3 - 2 * t);

export function createPostcard(tvGroup, { face = null } = {}) {
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: face }));
  faceMesh.position.z = 0.002; // just in front of the TV screen
  faceMesh.visible = false;
  if (face) tvGroup.add(faceMesh);

  let start = null; // the TV's time and pose at finale entry

  return {
    // Call once per frame with the finale flag and the time in seconds.
    // Returns the eased shrink progress: 0 = full-size TV, 1 = postcard.
    update(active, time) {
      if (!active) {
        if (start) {
          tvGroup.position.copy(start.position);
          tvGroup.scale.copy(start.scale);
          faceMesh.visible = false;
          start = null;
        }
        return 0;
      }
      if (!start) start = { time, position: tvGroup.position.clone(), scale: tvGroup.scale.clone() };
      const t = ease(THREE.MathUtils.clamp((time - start.time) / SHRINK_SECONDS, 0, 1));
      tvGroup.position.lerpVectors(start.position, POSTCARD_POSITION, t);
      tvGroup.scale.copy(start.scale).multiplyScalar(THREE.MathUtils.lerp(1, POSTCARD_SCALE, t));
      faceMesh.visible = Boolean(face);
      return t;
    },

    // The TV's position at finale entry (its eye-height spot), or null outside the finale.
    get startPosition() {
      return start?.position ?? null;
    },
  };
}
