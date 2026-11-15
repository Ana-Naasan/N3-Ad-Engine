import * as THREE from 'three';

// The ad wall: three tiers of screens wrapped around the viewer, all showing
// cells of one video, public/domain/ads.mp4. That file is a 3 x 2 grid of six
// ads with their sound mixed together, so the headset decodes one video and
// the ads can't drift apart. The group's origin is the viewer's head; the
// wall closes in on it as `progress` goes from 0 to 1.

const VIDEO_URL = '/domain/ads.mp4';
const GRID_COLS = 3;
const GRID_ROWS = 2;
const CELLS = GRID_COLS * GRID_ROWS;
const UV_INSET = 0.003; // keeps the neighbouring cell from bleeding in at the edges

const RADIUS = 2.0; // metres, before the wall closes in
// Each tier: its pitch above eye level, the yaw of its first screen and the
// size of its screens (sized so neighbours meet edge to edge).
const TIERS = [
  { pitchDeg: 0, firstYawDeg: -125, stepDeg: 50, width: 1.69, cellShift: 0 },
  { pitchDeg: 27, firstYawDeg: -150, stepDeg: 60, width: 1.78, cellShift: 3 },
  { pitchDeg: -27, firstYawDeg: -150, stepDeg: 60, width: 1.78, cellShift: 1 },
];
const SCREENS_PER_TIER = 6;
const TIER_RADIUS_STEP = 0.04; // tilted tiers sit a little further out, so edges never z-fight

const SCALE_FAR = 1.15; // group scale when the wall appears (radius 2.3 m)
const SCALE_NEAR = 0.75; // and when the domain ends (radius 1.5 m, just behind Gojo)
const POP_SECONDS = 0.35; // each screen's pop-in
const POP_STAGGER = 0.05; // seconds between one screen's pop-in and the next
const WOBBLE = 0.035; // radians each screen rocks, to be annoying

function cellGeometry(width, cell) {
  const geometry = new THREE.PlaneGeometry(width, (width * 9) / 16);
  const col = cell % GRID_COLS;
  const row = Math.floor(cell / GRID_COLS); // row 0 is the top of the video
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = THREE.MathUtils.lerp(UV_INSET, 1 - UV_INSET, uv.getX(i));
    const v = THREE.MathUtils.lerp(UV_INSET, 1 - UV_INSET, uv.getY(i));
    uv.setXY(i, (col + u) / GRID_COLS, (GRID_ROWS - 1 - row + v) / GRID_ROWS);
  }
  return geometry;
}

const easeOutBack = (x) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;

// muted: play without sound (the dev preview, which has no user gesture).
export function createAdWall({ muted = false } = {}) {
  const video = document.createElement('video');
  video.src = VIDEO_URL;
  video.loop = true;
  video.muted = muted;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture });

  const group = new THREE.Group();
  group.visible = false;
  const screens = [];
  TIERS.forEach((tier, t) => {
    const pitch = THREE.MathUtils.degToRad(tier.pitchDeg);
    const radius = RADIUS + (tier.pitchDeg ? TIER_RADIUS_STEP : 0);
    for (let i = 0; i < SCREENS_PER_TIER; i++) {
      const yaw = THREE.MathUtils.degToRad(tier.firstYawDeg + i * tier.stepDeg);
      const mesh = new THREE.Mesh(cellGeometry(tier.width, (i + tier.cellShift) % CELLS), material);
      mesh.position.set(
        Math.sin(yaw) * Math.cos(pitch) * radius,
        Math.sin(pitch) * radius,
        -Math.cos(yaw) * Math.cos(pitch) * radius,
      );
      mesh.rotation.set(pitch, -yaw, 0, 'YXZ'); // faces the viewer
      group.add(mesh);
      screens.push({ mesh, order: t * SCREENS_PER_TIER + i });
    }
  });

  let playing = false;
  let failed = false;

  return {
    group,

    // Must run inside a user gesture, so the video may play with sound later.
    // Silent, so the ads aren't heard on the Start tap.
    prime() {
      video.volume = 0;
      const restore = () => {
        if (!playing) video.pause();
        video.volume = 1;
      };
      video.play().then(restore, restore);
    },

    // on: whether the wall shows. seconds: since it appeared. progress: 0..1 through the domain.
    update(on, seconds, progress) {
      group.visible = on;
      if (on !== playing) {
        playing = on;
        if (on) {
          video.currentTime = 0;
          video.volume = 1;
          video.play().catch((e) => {
            failed = true;
            console.warn('ad wall video failed to play', e.name, e.message);
          });
        } else {
          video.pause();
        }
      }
      if (!on) return;
      group.scale.setScalar(THREE.MathUtils.lerp(SCALE_FAR, SCALE_NEAR, progress));
      for (const { mesh, order } of screens) {
        const pop = THREE.MathUtils.clamp((seconds - order * POP_STAGGER) / POP_SECONDS, 0, 1);
        mesh.scale.setScalar(Math.max(0.001, easeOutBack(pop)));
        mesh.rotation.z = WOBBLE * Math.sin(seconds * 7 + order * 1.7);
      }
    },

    // For the status log: 'failed', or the video's clock.
    get status() {
      if (failed || video.error) return 'failed';
      return `${video.currentTime.toFixed(1)}s${video.paused ? ' paused' : ''}`;
    },
  };
}
