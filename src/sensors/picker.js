import * as THREE from 'three';
import { createYoutubeMirror } from '../youtube-mirror.js';
import { rlog } from '../remote-log.js';

// The video picker: real YouTube on the TV (see src/youtube-mirror.js),
// controlled the way the Quest's own browser is. While the card step shows the
// mirror, each hand or controller points a ray at the TV:
//   - the page reacts to where the ray lands (hover)
//   - a pinch or trigger clicks there
//   - holding it and moving up or down scrolls, and the page keeps gliding
//     after the release
//   - a controller's thumbstick scrolls too
// On the flat page the mouse does the same.
//
// Writes signals.pick: null without a mirror (the "Pinch to play" card takes
// over), false while the viewer browses, true once they've opened a video.
// On the pick it tells the TV what the content is: a featured video's own
// file (public/videos/<YouTube id>.mp4, with sound) or the mirror itself.
//
// Shares ctx.picker = { mirror, showing, pointers } with the picker feature,
// which sets `showing` and draws the pointers.

const SCREEN_W = 1.6; // m, the screen in tv.js
const SCREEN_H = 0.9;
const REMOTE_HEIGHT = 576; // CSS px, VIEW.height in server/youtube-mirror.js
const SMOOTHING = 0.3; // share of the new ray position taken per frame: a pinch shakes the ray
const DRAG_START = 0.05; // of the screen height: a held pinch that moves further scrolls instead of clicking
const QUICK_PRESS_SECONDS = 0.3; // a pinch this short is a click, unless it moved QUICK_DRAG_START
const QUICK_DRAG_START = 0.14; // of the screen height
const SCROLL_GAIN = 1.5; // screen heights scrolled per screen height dragged
const SCROLL_SEND_SECONDS = 0.035;
const GLIDE_SECONDS = 0.45; // how fast the glide after a drag dies away (time constant)
const GLIDE_STOP = 30; // remote px/s: slower than this, the glide ends
const STICK_DEADZONE = 0.15;
const STICK_SPEED = 1400; // remote px/s at full thumbstick tilt
const HOVER_SEND_SECONDS = 0.08;
const HOVER_MIN_MOVE = 0.004; // of the screen: smaller moves aren't sent

const a = new THREE.Vector3();
const b = new THREE.Vector3();

// Where a ray (scene space) meets the TV screen, 0-1 from its top-left corner, or null.
function screenHit(tvGroup, origin, direction) {
  tvGroup.worldToLocal(a.copy(origin));
  tvGroup.worldToLocal(b.copy(origin).add(direction));
  const dz = b.z - a.z;
  if (a.z <= 0 || dz >= 0) return null; // behind the screen, or pointing away from it
  const k = -a.z / dz;
  const x = (a.x + (b.x - a.x) * k) / SCREEN_W + 0.5;
  const y = 0.5 - (a.y + (b.y - a.y) * k) / SCREEN_H;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

export default function picker(ctx) {
  const { renderer, camera, tv } = ctx;
  const mirror = createYoutubeMirror();
  // Pointers 0 and 1 are the XR inputs, 2 is the mouse. `hit` is where the
  // pointer lands on the screen (0-1), `down` the press in progress.
  const pointers = [0, 1, 2].map(() => ({ hit: null, origin: new THREE.Vector3(), point: new THREE.Vector3(), down: null }));
  const state = { mirror, showing: false, pointers };
  ctx.picker = state;

  let now = 0; // this frame's time and length, in seconds
  let dt = 0;
  let pendingScroll = 0; // remote px not yet sent
  let scrollAt = { x: 0.5, y: 0.5 };
  let lastScrollSent = 0;
  let glide = 0; // remote px/s still to play out after a drag
  let hovered = null; // the last hover position sent
  let lastHoverSent = 0;

  function press(pointer) {
    if (!state.showing || !pointer.hit) return;
    pointer.down = { ...pointer.hit, lastY: pointer.hit.y, at: now, dragging: false, velocity: 0 };
    glide = 0; // a new press catches the page
  }

  function release(pointer) {
    const { down } = pointer;
    pointer.down = null;
    if (!down) return;
    if (down.dragging) glide = down.velocity;
    else mirror.click(down.x, down.y);
  }

  // Move a pointer to where its ray lands (null origin: no ray this frame).
  function track(pointer, origin, direction, smoothing) {
    const raw = origin && state.showing ? screenHit(tv.group, origin, direction) : null;
    if (!raw) {
      pointer.hit = null;
      pointer.down = null; // off the screen: the press is dropped
      return;
    }
    const last = pointer.hit ?? raw;
    const hit = { x: last.x + (raw.x - last.x) * smoothing, y: last.y + (raw.y - last.y) * smoothing };
    pointer.hit = hit;
    pointer.origin.copy(origin);
    tv.group.localToWorld(pointer.point.set((hit.x - 0.5) * SCREEN_W, (0.5 - hit.y) * SCREEN_H, 0));

    const { down } = pointer;
    if (!down) return;
    if (!down.dragging) {
      // A short pinch drifts a little and is still a click.
      const limit = now - down.at <= QUICK_PRESS_SECONDS ? QUICK_DRAG_START : DRAG_START;
      if (Math.abs(hit.y - down.y) <= limit) return;
      down.dragging = true;
      down.lastY = hit.y;
    }
    // The page follows the hand: dragging up scrolls down.
    const moved = (down.lastY - hit.y) * SCROLL_GAIN * REMOTE_HEIGHT;
    pendingScroll += moved;
    scrollAt = hit;
    down.lastY = hit.y;
    if (dt > 0) down.velocity += (moved / dt - down.velocity) * 0.4;
  }

  const controllers = [0, 1].map((i) => {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('selectstart', () => press(pointers[i]));
    controller.addEventListener('selectend', () => release(pointers[i]));
    return controller;
  });
  renderer.xr.addEventListener('sessionend', () => {
    for (const pointer of pointers) pointer.down = null;
  });

  // The flat page: the mouse points, clicks and scrolls.
  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  let mouse = null; // normalised device coordinates, or null off the canvas
  canvas.addEventListener('pointermove', (e) => {
    mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2);
  });
  canvas.addEventListener('pointerleave', () => { mouse = null; });
  canvas.addEventListener('pointerdown', () => press(pointers[2]));
  canvas.addEventListener('pointerup', () => release(pointers[2]));
  canvas.addEventListener('wheel', (e) => {
    if (!pointers[2].hit) return;
    e.preventDefault();
    pendingScroll += e.deltaY;
    scrollAt = pointers[2].hit;
  }, { passive: false });

  const direction = new THREE.Vector3();

  return (signals, { inVR, xrFrame }) => {
    dt = Math.max(0, signals.t - now);
    now = signals.t;
    controllers.forEach((controller, i) => {
      if (inVR && controller.visible) {
        track(pointers[i], controller.position, direction.set(0, 0, -1).applyQuaternion(controller.quaternion), SMOOTHING);
      } else track(pointers[i], null);
    });
    if (!inVR && mouse) {
      raycaster.setFromCamera(mouse, camera);
      track(pointers[2], raycaster.ray.origin, raycaster.ray.direction, 1);
    } else track(pointers[2], null);

    const pointing = pointers.find((pointer) => pointer.down) ?? pointers.find((pointer) => pointer.hit);
    if (state.showing) {
      // Thumbsticks (xr-standard axis 3): pulling back scrolls down.
      for (const source of (inVR && xrFrame?.session.inputSources) || []) {
        const tilt = source.gamepad?.axes[3] ?? 0;
        if (Math.abs(tilt) < STICK_DEADZONE) continue;
        pendingScroll += tilt * STICK_SPEED * dt;
        glide = 0;
        if (pointing) scrollAt = pointing.hit;
      }
      if (Math.abs(glide) > GLIDE_STOP) {
        pendingScroll += glide * dt;
        glide *= Math.exp(-dt / GLIDE_SECONDS);
      } else glide = 0;
    } else {
      pendingScroll = 0;
      glide = 0;
    }
    if (Math.abs(pendingScroll) >= 1 && now - lastScrollSent >= SCROLL_SEND_SECONDS) {
      mirror.scroll(scrollAt.x, scrollAt.y, pendingScroll);
      pendingScroll = 0;
      lastScrollSent = now;
    }

    // Hover: the page sees the pointer move, so YouTube highlights what it is over.
    const hover = pointing && !pointing.down?.dragging ? pointing.hit : null;
    if (hover && now - lastHoverSent >= HOVER_SEND_SECONDS
      && (!hovered || Math.hypot(hover.x - hovered.x, hover.y - hovered.y) > HOVER_MIN_MOVE)) {
      mirror.move(hover.x, hover.y);
      hovered = hover;
      lastHoverSent = now;
    }

    let pick = null;
    if (mirror.available) {
      pick = state.showing && Boolean(mirror.local || mirror.playing);
      if (pick) {
        tv.pickContent(mirror.local);
        rlog('pick', { video: mirror.local, from: mirror.local ? 'file' : 'mirror' });
      }
    }
    signals.pick = pick;
    return { debug: { youtube: pick === null ? 'off' : state.showing ? 'browsing' : 'idle', youtubeFrames: mirror.frames } };
  };
}
