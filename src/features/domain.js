import * as THREE from 'three';
import { createBanner } from '../banner.js';
import { DOMAIN_CAST_SECONDS, DOMAIN_SECONDS } from '../attention/rules/domain.js';
import { createGojo, MODEL_URL } from './domain/gojo.js';
import { createVoid } from './domain/void.js';
import { createAdWall, VIDEO_URL } from './domain/ad-wall.js';
import { createTeleport, BURST_AT } from './domain/teleport.js';

// The domain, while output.domain is set (../attention/rules/domain.js sets it
// once the warnings have run out). ../domain.js adds this feature after
// FEATURES, so it is not in ./index.js. Everything is drawn from `elapsed`, the seconds
// since it started:
//   cast  Gojo teleports in between the viewer and the TV (a line of light
//         that bursts as he flickers in, with the teleport sound), raises the hand sign and says his line; a dark orb grows out of his hand, and as it
//         reaches the viewer the room is swapped for the void behind a white flash
//   ads   the ad wall surrounds the viewer and closes in, with a countdown
// When it ends there is another flash and the room comes back.
// It all lives in `world`, with the viewer's head above the origin. This
// feature runs after the others, so it can hide what they draw in `world`.
//
// main.js stops calling features while the run is held (the headset is off, a
// system menu is up, or VR was left mid-run). The sound and the ad wall's
// video are paused when that starts and resume on the next frame drawn.
//
// Dev aid: ?domainPreview=<seconds> shows the domain frozen at that elapsed
// time (?domainPreview=play runs it on a loop), with no sound; &yaw=<degrees>
// turns the desktop camera.

const VOICE_URL = '/domain/voice.m4a';
const TELEPORT_SOUND_URL = '/domain/teleport.m4a'; // 1.5 s; loud from 0.1 s in, as he snaps in

// Everything this feature loads. None of it is in the repo: public/domain/SOURCES.md.
export const MEDIA_URLS = [MODEL_URL, VIDEO_URL, VOICE_URL, TELEPORT_SOUND_URL];

const GOJO_POSITION = new THREE.Vector3(0, 0, -1.35); // on the floor, in front of the TV
const HAND = new THREE.Vector3(-0.2, 1.45, 0.15); // from his feet: where the orb starts until the model has loaded
const VOID_LIFT = 0.15; // metres he rises once the floor is gone

// Seconds into the domain.
const TELEPORT_SECONDS = 0.9; // the whole arrival effect
const ARRIVE_AT = TELEPORT_SECONDS * BURST_AT; // he snaps in as the line of light bursts
const APPEAR_SECONDS = 0.25;
const SIGN_AT = 0.7; // he raises the hand sign
const SIGN_SECONDS = 0.6;
const VOICE_AT = 0.8; // the line is 3.7 s long, so it ends as the orb reaches the viewer
const LOWER_AT = DOMAIN_CAST_SECONDS + 2; // and lowers his hand once the ads are running
const LOWER_SECONDS = 1;
const ORB_AT = DOMAIN_CAST_SECONDS - 1.1;
const SWALLOW_AT = DOMAIN_CAST_SECONDS - 0.5; // the orb reaches the viewer
const FLASH_SECONDS = 0.5;
const END_FLASH_SECONDS = 0.6;
// The wall goes quiet just before the end, so its noise can't pass WRAPZILLA's shout gate.
const WALL_QUIET_SECONDS = 0.3; // silent for this long before the domain ends
const WALL_FADE_SECONDS = 0.5; // fading out before that

const CAPTION = 'Domain Expansion: Unlimited Ads';
const CAPTION_SCALE = 0.5; // of the 2 m banner card
const CAPTION_POSITION = new THREE.Vector3(0, 0.62, -1.05); // in front of his shins
const CAPTION_RENDER_ORDER = 20; // over the red tint (10), under the flash (30)

const params = new URLSearchParams(globalThis.location?.search ?? '');
const PREVIEW = params.get('domainPreview');
const TOTAL = DOMAIN_CAST_SECONDS + DOMAIN_SECONDS;

function previewDomain(t) {
  const elapsed = PREVIEW === 'play' ? t % (TOTAL + 3) : Number(PREVIEW) || 0;
  if (elapsed >= TOTAL) return null;
  return { phase: elapsed < DOMAIN_CAST_SECONDS ? 'cast' : 'ads', elapsed };
}

// One silent play inside a user gesture, so the element may play with sound later.
function primeSilently(sound) {
  sound.volume = 0;
  sound.play().then(() => {
    sound.pause();
    sound.currentTime = 0;
    sound.volume = 1;
  }).catch(() => { sound.volume = 1; });
}

function playFromStart(sound) {
  sound.currentTime = 0;
  sound.play().catch((e) => console.warn('domain sound failed to play', sound.src, e.name, e.message));
}

// For the status log: 'failed', or the element's clock.
const soundStatus = (sound) => (sound.error ? 'failed' : `${sound.currentTime.toFixed(1)}s${sound.paused ? ' paused' : ''}`);

export default function domain({ renderer, world, tv, camera }) {
  const gojo = createGojo();
  const space = createVoid();
  const wall = createAdWall({ muted: PREVIEW !== null });
  const teleport = createTeleport();
  const caption = createBanner();
  caption.mesh.scale.setScalar(CAPTION_SCALE);
  caption.mesh.position.copy(CAPTION_POSITION);
  caption.mesh.material.depthTest = false; // readable in front of him and the wall, whatever closes in
  caption.mesh.renderOrder = CAPTION_RENDER_ORDER;
  gojo.group.position.copy(GOJO_POSITION);
  teleport.group.position.copy(GOJO_POSITION);

  // The room's own lights are hidden with the room, so he brings his own.
  const light = new THREE.HemisphereLight(0xdfe8ff, 0x2a1a4a, 1.4);

  const group = new THREE.Group();
  group.visible = false;
  group.add(gojo.group, teleport.group, space.shell, space.flash, space.orb, wall.group, caption.mesh, light);
  world.add(group);

  const voice = new Audio(VOICE_URL);
  const teleportSound = new Audio(TELEPORT_SOUND_URL);
  voice.preload = teleportSound.preload = 'auto';

  // Must run inside a user gesture, like tv.primeAll().
  document.getElementById('start')?.addEventListener('click', () => {
    wall.prime();
    primeSilently(voice);
    primeSilently(teleportSound);
  });

  // The run is held: nothing of the domain may play on unseen.
  let holds = 0;
  let heldSounds = []; // what was playing, to resume
  function pauseForHold() {
    holds += 1;
    heldSounds = [...heldSounds, ...[voice, teleportSound].filter((sound) => !sound.paused && !heldSounds.includes(sound))];
    for (const sound of heldSounds) sound.pause();
    wall.pause();
  }
  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    session.addEventListener('visibilitychange', () => {
      if (session.visibilityState !== 'visible') pauseForHold();
    });
  });
  renderer.xr.addEventListener('sessionend', pauseForHold);

  if (PREVIEW !== null && params.has('yaw')) {
    camera.rotation.set(0, THREE.MathUtils.degToRad(Number(params.get('yaw'))), 0);
  }

  // What the other features had showing in `world` when the void took over.
  const hidden = new Map();
  function hideWorld() {
    for (const child of world.children) {
      if (child === group) continue;
      if (!hidden.has(child)) hidden.set(child, child.visible);
      child.visible = false;
    }
  }
  function restoreWorld() {
    for (const [child, visible] of hidden) child.visible = visible;
    hidden.clear();
  }

  let lastElapsed = null; // null while there is no domain
  let endedAt = -Infinity;
  const head = new THREE.Vector3();
  const hand = new THREE.Vector3();

  return (output, signals) => {
    const { t } = signals;
    const state = PREVIEW !== null ? previewDomain(t) : output.domain;

    if (!state) {
      heldSounds = [];
      if (lastElapsed !== null) {
        lastElapsed = null;
        endedAt = t;
        restoreWorld();
        voice.pause();
        teleportSound.pause();
        gojo.update(0, 0, t);
        teleport.update(-1);
        space.setShell(false, t);
        space.setOrb(0, 1);
        wall.update(false, 0, 0);
        caption.setText(null);
      }
      const flash = 1 - (t - endedAt) / END_FLASH_SECONDS;
      space.setFlash(Math.max(0, flash));
      group.visible = flash > 0;
      return { debug: { domain: null } };
    }

    for (const sound of heldSounds.splice(0)) sound.play().catch(() => {}); // the run is watchable again

    const { elapsed } = state;
    const inVoid = elapsed >= SWALLOW_AT;
    const adsSeconds = elapsed - DOMAIN_CAST_SECONDS;
    group.visible = true;

    // The viewer's head is above the world origin, at the TV's height.
    head.set(0, tv.group.position.y, 0);
    space.shell.position.copy(head);
    space.flash.position.copy(head);
    wall.group.position.copy(head);

    gojo.group.position.copy(GOJO_POSITION);
    if (inVoid) gojo.group.position.y += VOID_LIFT;
    const raised = THREE.MathUtils.clamp((elapsed - SIGN_AT) / SIGN_SECONDS, 0, 1);
    const lowered = THREE.MathUtils.clamp((elapsed - LOWER_AT) / LOWER_SECONDS, 0, 1);
    gojo.update((elapsed - ARRIVE_AT) / APPEAR_SECONDS, raised * (1 - lowered), t);
    teleport.update(elapsed / TELEPORT_SECONDS);
    if (PREVIEW === null && lastElapsed === null) playFromStart(teleportSound);

    if (PREVIEW === null && (lastElapsed ?? -1) < VOICE_AT && elapsed >= VOICE_AT) {
      playFromStart(voice);
    }

    if (gojo.handPosition(hand)) group.worldToLocal(hand);
    else hand.copy(GOJO_POSITION).add(HAND);
    space.orb.position.copy(hand);
    space.setOrb(inVoid ? 0 : (elapsed - ORB_AT) / (SWALLOW_AT - ORB_AT), hand.distanceTo(head));
    space.setShell(inVoid, t);
    space.setFlash(inVoid ? Math.max(0, 1 - (elapsed - SWALLOW_AT) / FLASH_SECONDS) : 0);
    if (inVoid) hideWorld();
    else restoreWorld(); // only the preview can go back in time

    const wallVolume = (DOMAIN_SECONDS - adsSeconds - WALL_QUIET_SECONDS) / WALL_FADE_SECONDS;
    wall.update(adsSeconds >= 0, adsSeconds, adsSeconds / DOMAIN_SECONDS, THREE.MathUtils.clamp(wallVolume, 0, 1));

    if (adsSeconds >= 0) {
      const left = Math.ceil(DOMAIN_SECONDS - adsSeconds);
      caption.setText(`Your ads end in 0:${String(left).padStart(2, '0')}`);
    } else {
      caption.setText(elapsed >= VOICE_AT ? CAPTION : null);
    }

    lastElapsed = elapsed;
    return {
      debug: {
        domain: `${state.phase} ${elapsed.toFixed(1)}`,
        domainMedia: {
          gojo: gojo.loaded,
          ads: wall.status,
          voice: soundStatus(voice),
          teleport: soundStatus(teleportSound),
          holds,
        },
      },
    };
  };
}
