import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildRoom } from './room.js';
import { createTV } from './tv.js';
import { createPanel } from './panels.js';
import { startMic, getMicLevel, resumeMic, getMicDiagnostics } from './mic.js';
import { rlog, sendSnapshot } from './remote-log.js';

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

const debugPanel = createPanel();
debugPanel.mesh.position.set(1.3, DEFAULT_EYE_HEIGHT, -2.0);
debugPanel.mesh.rotation.y = -0.45;
world.add(debugPanel.mesh);

// --- Calibration ---
let calibrated = false;

function calibrate(pose) {
  const p = pose.transform.position;
  const q = pose.transform.orientation;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  world.position.set(p.x, 0, p.z);
  world.rotation.y = Math.atan2(-forward.x, -forward.z); // world -Z points where the head points
  tv.group.position.y = p.y;
  debugPanel.mesh.position.y = p.y;
  world.updateMatrixWorld(true);
  calibrated = true;
  rlog('calibrate', { eyeHeight: +p.y.toFixed(3), yawDeg: +THREE.MathUtils.radToDeg(world.rotation.y).toFixed(1) });
}

renderer.xr.addEventListener('sessionstart', () => {
  calibrated = false;
  const session = renderer.xr.getSession();
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

function takeSnapshot() {
  snapCamera.position.copy(headPos);
  snapCamera.quaternion.copy(headQuat);
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

// --- Head angle off the TV ---
const headPos = new THREE.Vector3();
const headQuat = new THREE.Quaternion();
const tvPos = new THREE.Vector3();
const toTV = new THREE.Vector3();
const forward = new THREE.Vector3();

function headAngleToTV() {
  tv.group.getWorldPosition(tvPos);
  toTV.subVectors(tvPos, headPos).normalize();
  forward.set(0, 0, -1).applyQuaternion(headQuat);
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(forward.dot(toTV), -1, 1)));
}

// --- Start button: mic + video unlock happen here, before Enter VR ---
const startButton = document.getElementById('start');
const status = document.getElementById('status');

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  rlog('start-click');
  tv.primeAll();
  tv.show('content', { loop: true })
    .then(() => rlog('content-playing'))
    .catch((e) => console.warn('content play failed', e.name, e.message));
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

// --- Loop ---
let frames = 0;
let fps = 0;
let fpsWindowStart = performance.now();
let lastPanelUpdate = 0;
let lastStatusLog = 0;
let lastSnap = 0;
let peakMic = 0;

renderer.setAnimationLoop((time, frame) => {
  const inXR = renderer.xr.isPresenting && frame;
  let pose = null;
  if (inXR) {
    pose = frame.getViewerPose(renderer.xr.getReferenceSpace());
    if (pose && !calibrated) calibrate(pose);
  }

  if (pose) {
    const { position: p, orientation: q } = pose.transform;
    headPos.set(p.x, p.y, p.z);
    headQuat.set(q.x, q.y, q.z, q.w);
  } else {
    camera.getWorldPosition(headPos);
    camera.getWorldQuaternion(headQuat);
  }
  const angle = headAngleToTV();

  const mic = getMicLevel();
  if (mic !== null) peakMic = Math.max(peakMic, mic);

  frames++;
  if (time - fpsWindowStart >= 1000) {
    fps = Math.round((frames * 1000) / (time - fpsWindowStart));
    frames = 0;
    fpsWindowStart = time;
  }

  if (time - lastStatusLog >= 1000) {
    lastStatusLog = time;
    const video = tv.currentVideo;
    rlog('status', {
      angle: +angle.toFixed(1),
      mic: mic === null ? null : +mic.toFixed(3),
      micPeak: +peakMic.toFixed(3),
      fps,
      mode: inXR ? (calibrated ? 'vr-calibrated' : 'vr') : 'desktop',
      headY: +headPos.y.toFixed(3),
      micState: getMicDiagnostics(),
      video: video ? { paused: video.paused, t: +video.currentTime.toFixed(1), muted: video.muted } : null,
    });
  }

  if (snapEnabled && inXR && calibrated && time - lastSnap >= 5000) {
    lastSnap = time;
    takeSnapshot();
  }

  if (time - lastPanelUpdate > 100) {
    lastPanelUpdate = time;
    const video = tv.currentVideo;
    const bar = mic === null ? '' : '#'.repeat(Math.min(20, Math.round(mic * 100)));
    debugPanel.setLines([
      `Head off TV: ${angle.toFixed(1)}°`,
      `Mic: ${mic === null ? 'off' : mic.toFixed(3)} ${bar}`,
      `Mic peak: ${peakMic.toFixed(3)}`,
      `Video: ${video ? `${video.paused ? 'paused' : 'playing'} ${video.currentTime.toFixed(1)}s` : 'none'}`,
      `FPS: ${fps}  ${inXR ? (calibrated ? 'VR (calibrated)' : 'VR') : 'desktop'}`,
    ]);
  }

  renderer.render(scene, camera);
});
