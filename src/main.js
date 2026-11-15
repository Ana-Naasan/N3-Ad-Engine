import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildRoom } from './room.js';
import { createTV } from './tv.js';
import { startMic, resumeMic, getMicDiagnostics } from './mic.js';
import { rlog, sendSnapshot } from './remote-log.js';
import { createAttention } from './attention/index.js';
import { FAKEOUT } from './fakeout.js';
import { RULES } from './attention/rules/index.js';
import { SENSORS } from './sensors/index.js';
import { FEATURES } from './features/index.js';

rlog('load', { userAgent: navigator.userAgent, url: location.href });
navigator.xr?.isSessionSupported('immersive-vr')
  .then((ok) => rlog('xr-support', { immersiveVR: ok }))
  .catch((e) => rlog('xr-support', { error: e.message }));
if (!navigator.xr) rlog('xr-support', { immersiveVR: false, reason: 'no navigator.xr' });

const TV_DISTANCE = 2.2; // metres in front of the viewer
const DEFAULT_EYE_HEIGHT = 1.2; // seated; replaced by the real head height in VR

// --- Renderer, scene, camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, DEFAULT_EYE_HEIGHT, 0);
camera.lookAt(0, DEFAULT_EYE_HEIGHT, -TV_DISTANCE);

window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return; // three warns if resized during VR
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Everything lives in `world`, which is moved on session start so the TV is
// straight ahead of wherever the viewer is looking, at their eye height.
const world = new THREE.Group();
scene.add(world);
buildRoom(world);

const tv = createTV();
tv.group.position.set(0, DEFAULT_EYE_HEIGHT, -TV_DISTANCE);
world.add(tv.group);

// --- Calibration ---
let calibrated = false;

function calibrate(pose) {
  const p = pose.transform.position;
  const q = pose.transform.orientation;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  world.position.set(p.x, 0, p.z);
  world.rotation.y = Math.atan2(-forward.x, -forward.z); // world -Z points where the head points
  tv.group.position.y = p.y;
  world.updateMatrixWorld(true);
  calibrated = true;
  rlog('calibrate', { eyeHeight: +p.y.toFixed(3), yawDeg: +THREE.MathUtils.radToDeg(world.rotation.y).toFixed(1) });
}

// --- Holding the run while nobody can see it ---
// With the headset off or a system menu up (the session isn't 'visible'), or
// after leaving VR mid-run, the TV video pauses and run time stops, so no ad
// plays out unseen and re-entering continues where it left off. Before the
// first Enter VR the flat page runs, for key-jump testing.
const MAX_FRAME_SECONDS = 0.1; // a longer gap between frames (a stall) counts as this long
let enteredVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  calibrated = false;
  enteredVR = true;
  const session = renderer.xr.getSession();
  // Frames may stop altogether while hidden, so pause here rather than wait for one.
  session.addEventListener('visibilitychange', () => {
    rlog('visibility', { state: session.visibilityState });
    if (session.visibilityState !== 'visible') tv.currentVideo?.pause();
  });
  rlog('session-start', {
    enabledFeatures: session.enabledFeatures ?? 'unknown',
    frameRate: session.frameRate ?? 'unknown',
    mic: getMicDiagnostics(),
  });
  resumeMic()?.then(() => rlog('mic-resumed', getMicDiagnostics()));
  // Holding the Quest button to recenter fires 'reset': recalibrate then too.
  renderer.xr.getReferenceSpace()?.addEventListener('reset', () => {
    calibrated = false;
    rlog('reference-reset');
  });
});
renderer.xr.addEventListener('sessionend', () => rlog('session-end'));

// --- Debug snapshots (?snap in the URL): a 640x360 render from the head pose every 5 s ---
const SNAP_W = 640, SNAP_H = 360;
const snapEnabled = new URLSearchParams(location.search).has('snap');
const snapTarget = new THREE.WebGLRenderTarget(SNAP_W, SNAP_H, { colorSpace: THREE.SRGBColorSpace });
const snapCamera = new THREE.PerspectiveCamera(75, SNAP_W / SNAP_H, 0.05, 100);
const snapPixels = new Uint8Array(SNAP_W * SNAP_H * 4);
const snapCanvas = document.createElement('canvas');
snapCanvas.width = SNAP_W;
snapCanvas.height = SNAP_H;

function takeSnapshot({ headPos: p, headQuat: q }) {
  snapCamera.position.set(p.x, p.y, p.z);
  snapCamera.quaternion.set(q.x, q.y, q.z, q.w);
  snapCamera.updateMatrixWorld();
  const xrEnabled = renderer.xr.enabled;
  const previousTarget = renderer.getRenderTarget();
  renderer.xr.enabled = false; // render a plain mono view into our own target
  renderer.setRenderTarget(snapTarget);
  renderer.render(scene, snapCamera);
  renderer.readRenderTargetPixels(snapTarget, 0, 0, SNAP_W, SNAP_H, snapPixels);
  renderer.setRenderTarget(previousTarget);
  renderer.xr.enabled = xrEnabled;

  const image = new ImageData(SNAP_W, SNAP_H);
  const row = SNAP_W * 4;
  for (let y = 0; y < SNAP_H; y++) { // WebGL rows are bottom-up
    image.data.set(snapPixels.subarray((SNAP_H - 1 - y) * row, (SNAP_H - y) * row), y * row);
  }
  snapCanvas.getContext('2d').putImageData(image, 0, 0);
  snapCanvas.toBlob((blob) => blob && sendSnapshot(blob), 'image/jpeg', 0.7);
}

// --- Start button: mic + video unlock happen here, before Enter VR ---
// The content video no longer starts here: the "Pinch to play" card waits for a select.
const startButton = document.getElementById('start');
const status = document.getElementById('status');

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  rlog('start-click');
  tv.primeAll();
  let micMessage;
  try {
    await startMic();
    micMessage = 'Mic on.';
  } catch (e) {
    micMessage = `Mic blocked (${e.name}).`;
  }
  rlog('mic', { result: micMessage, ...getMicDiagnostics() });
  status.textContent = `${micMessage} Now tap Enter VR.`;
  document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] }));
});

// --- Frame pipeline: sensors -> attention -> features -> render ---
// Coordinate frames: headPos, headQuat and fingertips are in the XR reference
// space, which is the scene's world coordinates. `world` (room, TV, panels) is
// moved by calibration, so convert with world.worldToLocal / localToWorld when
// placing things relative to the room.
// ctx.tv exposes group (#10 shrinks it), screenMaterial and texture (#8's palm screens).
const ctx = { renderer, scene, camera, world, tv };
const readSensors = SENSORS.map((setup) => setup(ctx));
// FAKEOUT adds a lineup, a rule and a feature only when the URL has ?fakeout.
const updateFeatures = [...FEATURES, ...FAKEOUT.features].map((setup) => setup(ctx));
const attention = createAttention(FAKEOUT.lineup, [...RULES, ...FAKEOUT.rules]);

// Latest `debug` values returned by sensors and features, merged into the status line.
const moduleDebug = {};
function collectDebug(result) {
  if (result?.debug) Object.assign(moduleDebug, result.debug);
}

// Every field #4's contract defines, with neutral values; sensors overwrite them.
function blankSignals(t, inVR) {
  return {
    t,
    inVR,
    headAngle: 0,
    headPos: { x: 0, y: 0, z: 0 },
    headQuat: { x: 0, y: 0, z: 0, w: 1 },
    palmsUp: false,
    fingertips: [],
    fingertipTravel: 0,
    skipDistance: null,
    selectStarted: false,
    selectHeld: 0,
    micLevel: null,
    micAvailable: false,
    clap: false,
    jumpTo: null,
    pick: null, // null: no picker on the TV; false/true: the viewer has picked a video
    video: { t: 0, ended: false, failed: false },
  };
}

let fps = 0;
let frames = 0;
let fpsWindowStart = performance.now();
let lastStatusLog = 0;
let lastSnap = 0;
let lastScreen = null;
let peakMic = 0;
let lastFrameTime = null;
let runTime = 0; // seconds the run has been watchable: signals.t
let wasHeld = false;
const round = (x, places) => (typeof x === 'number' ? +x.toFixed(places) : x);

renderer.setAnimationLoop((time, xrFrame) => {
  const inVR = Boolean(renderer.xr.isPresenting && xrFrame);
  const frameSeconds = lastFrameTime === null ? 0 : (time - lastFrameTime) / 1000;
  lastFrameTime = time;

  const visibility = inVR ? (renderer.xr.getSession().visibilityState ?? 'visible') : null;
  const hold = inVR ? visibility !== 'visible' : enteredVR;
  if (hold !== wasHeld) {
    wasHeld = hold;
    rlog(hold ? 'run-held' : 'run-resumed', { visibility, at: +runTime.toFixed(2) });
  }
  if (hold) {
    tv.currentVideo?.pause(); // the next watchable frame's tv.apply resumes it
    renderer.render(scene, camera);
    return;
  }
  runTime += THREE.MathUtils.clamp(frameSeconds, 0, MAX_FRAME_SECONDS);

  let pose = null;
  if (inVR) {
    pose = xrFrame.getViewerPose(renderer.xr.getReferenceSpace());
    if (pose && !calibrated) calibrate(pose);
  }

  const signals = blankSignals(runTime, inVR);
  const frame = { time, xrFrame, pose, inVR };
  for (const read of readSensors) collectDebug(read(signals, frame));
  if (signals.micLevel !== null) peakMic = Math.max(peakMic, signals.micLevel);

  const output = attention.update(signals);

  for (const update of updateFeatures) collectDebug(update(output, signals));

  if (output.screen !== lastScreen) {
    lastScreen = output.screen;
    rlog('screen', { screen: output.screen, adIndex: output.adIndex, at: +signals.t.toFixed(2) });
  }

  frames++;
  if (time - fpsWindowStart >= 1000) {
    fps = Math.round((frames * 1000) / (time - fpsWindowStart));
    frames = 0;
    fpsWindowStart = time;
  }

  if (time - lastStatusLog >= 1000) {
    lastStatusLog = time;
    const video = tv.currentVideo;
    const mic = signals.micLevel;
    rlog('status', {
      screen: output.screen,
      adIndex: output.adIndex,
      playing: output.playing,
      target: output.target,
      tint: output.tint,
      banner: output.banner,
      skip: { state: output.skip.state, progress: round(output.skip.progress, 2) },
      gate: { visible: output.gate.visible, level: round(output.gate.level, 3) },
      finale: output.finale,
      angle: +signals.headAngle.toFixed(1),
      mic: mic === null ? null : +mic.toFixed(3),
      micPeak: +peakMic.toFixed(3),
      micAvailable: signals.micAvailable,
      fps,
      mode: inVR ? (calibrated ? 'vr-calibrated' : 'vr') : 'desktop',
      headY: +signals.headPos.y.toFixed(3),
      selectHeld: +signals.selectHeld.toFixed(1),
      fingertips: signals.fingertips.length,
      micState: getMicDiagnostics(),
      video: video ? { paused: video.paused, t: +video.currentTime.toFixed(1), muted: video.muted } : null,
      ...moduleDebug,
    });
  }

  if (snapEnabled && inVR && calibrated && time - lastSnap >= 5000) {
    lastSnap = time;
    takeSnapshot(signals);
  }

  renderer.render(scene, camera);
});
