import * as THREE from 'three';
import { FLY_OUT_S, HOLD_S, quatAngleDeg } from '../attention/rules/skip.js';

// The GRIN+ Skip button: flies out of the TV to a spot within reach, jumps to
// a new spot each time output.skip.jump goes up, and draws the locked label,
// the hold-still progress ring and the amber enabled button. The locked label
// counts the hold down ("Skip available in 5 seconds" … "1 second"), and reads
// "You moved. Starting over." for MOVED_S each time the hold restarts: the
// viewer is looking at the button, not at the banner under the TV. It owns the button's position and shares it as ctx.skip
// (scene space) for the skipProximity sensor.
//
// Spots are in the reachable zone, measured from the head (scene space):
// ZONE_NEAR_M–ZONE_FAR_M away, from chest (ZONE_BELOW_EYE_M below the eyes)
// to eye height, within ±ZONE_SIDE_DEG of the direction to the TV, and at
// least MIN_FINGER_M from every fingertip. Checked in the headset, not tested.

const ZONE_NEAR_M = 0.35;
const ZONE_FAR_M = 0.55;
const ZONE_BELOW_EYE_M = 0.35;
const ZONE_SIDE_DEG = 25;
const MIN_FINGER_M = 0.2;
const MIN_HOP_M = 0.15; // a jump moves at least this far, so it reads as a jump
const SPOT_TRIES = 40;
const JUMP_ANIM_S = 0.18;
const FLY_OUT_START_SCALE = 0.4;

const AMBER = '#e9a03b';
const DARK = '#1a1410';
const LOCKED_BG = '#6b5a45';
const CREAM = '#f4e9d8';
const PX_PER_M = 2000;
const LABEL_W_M = 0.32;
const LABEL_H_M = 0.07;
const RING_M = 0.05;
const RING_GAP_M = 0.012;

const MOVED_TEXT = 'You moved. Starting over.';
const MOVED_S = 1; // how long the label says so after the hold restarts

// The locked label: the whole seconds left of the hold.
function lockedText(progress) {
  const left = Math.max(1, Math.ceil(HOLD_S * (1 - progress)));
  return `Skip available in ${left} second${left === 1 ? '' : 's'}`;
}

const LABELS = {
  chase: { text: 'Skip ▸', bg: AMBER, fg: DARK, fontPx: 64 },
  locked: { text: 'Skip available in 5 seconds', bg: LOCKED_BG, fg: CREAM, fontPx: 44 },
  enabled: { text: 'Skip ▸', bg: AMBER, fg: DARK, fontPx: 64 },
};

function canvasPlane(wM, hM) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(wM * PX_PER_M);
  canvas.height = Math.round(hM * PX_PER_M);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(wM, hM),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  return { canvas, g: canvas.getContext('2d'), texture, mesh };
}

// Draws a pill fitted to the text; returns its width in metres.
function drawLabel({ canvas, g, texture }, { text, bg, fg, fontPx }) {
  g.clearRect(0, 0, canvas.width, canvas.height);
  let size = fontPx;
  g.font = `700 ${size}px system-ui, sans-serif`;
  const pad = canvas.height * 0.35;
  while (g.measureText(text).width + 2 * pad > canvas.width && size > 12) {
    size -= 2;
    g.font = `700 ${size}px system-ui, sans-serif`;
  }
  const w = g.measureText(text).width + 2 * pad;
  const x = (canvas.width - w) / 2;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(x, 0, w, canvas.height, canvas.height / 2);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  texture.needsUpdate = true;
  return w / PX_PER_M;
}

function drawRing({ canvas, g, texture }, progress) {
  const c = canvas.width / 2;
  const r = c * 0.78;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.lineWidth = c * 0.28;
  g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.stroke();
  if (progress > 0) {
    g.strokeStyle = AMBER;
    g.beginPath();
    g.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    g.stroke();
  }
  texture.needsUpdate = true;
}

export default function skip(ctx) {
  const { scene, tv } = ctx;
  ctx.skip ??= { position: new THREE.Vector3(), visible: false };
  const shared = ctx.skip;

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const label = canvasPlane(LABEL_W_M, LABEL_H_M);
  group.add(label.mesh);
  const ring = canvasPlane(RING_M, RING_M);
  ring.mesh.visible = false;
  group.add(ring.mesh);

  const head = new THREE.Vector3();
  const toTV = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const best = new THREE.Vector3();
  const anim = { from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, dur: 1, grow: false };

  let lastState = 'hidden';
  let lastJump = 0;
  let labelDrawn = null; // kind and text of the label on the canvas
  let lockedProgress = null; // last frame's hold progress while locked, else null
  let movedUntil = -Infinity; // the label says "You moved" until this time
  let ringDrawn = -1;
  let holdPose = null; // for the drift readout only; the rule owns the real hold

  // A random spot in the reachable zone, away from the fingertips and from `from`.
  function pickSpot(signals, from, out) {
    head.set(signals.headPos.x, signals.headPos.y, signals.headPos.z);
    tv.group.getWorldPosition(toTV).sub(head);
    const baseYaw = Math.atan2(toTV.x, toTV.z);
    let bestScore = -Infinity;
    for (let i = 0; i < SPOT_TRIES; i++) {
      const yaw = baseYaw + THREE.MathUtils.degToRad(THREE.MathUtils.randFloatSpread(2 * ZONE_SIDE_DEG));
      const dy = -Math.random() * ZONE_BELOW_EYE_M;
      const d = THREE.MathUtils.randFloat(ZONE_NEAR_M, ZONE_FAR_M);
      const r = Math.sqrt(d * d - dy * dy);
      candidate.set(head.x + Math.sin(yaw) * r, head.y + dy, head.z + Math.cos(yaw) * r);
      let finger = Infinity;
      for (const tip of signals.fingertips) {
        finger = Math.min(finger, Math.hypot(tip.x - candidate.x, tip.y - candidate.y, tip.z - candidate.z));
      }
      const hop = from ? candidate.distanceTo(from) : Infinity;
      if (finger >= MIN_FINGER_M && hop >= MIN_HOP_M) return out.copy(candidate);
      const score = Math.min(finger, hop / MIN_HOP_M * MIN_FINGER_M);
      if (score > bestScore) {
        bestScore = score;
        best.copy(candidate);
      }
    }
    return out.copy(best); // nothing met both limits: the least bad try
  }

  function startMove(from, signals, dur, grow) {
    anim.from.copy(from);
    pickSpot(signals, from, anim.to);
    anim.start = signals.t;
    anim.dur = dur;
    anim.grow = grow;
  }

  return (output, signals) => {
    const { state, progress, jump } = output.skip;

    if (state === 'hidden') {
      group.visible = false;
      shared.visible = false;
      lastState = state;
      lastJump = 0;
      holdPose = null;
      return { debug: { skipJump: null, skipReach: null, holdDriftCm: null, holdDriftDeg: null } };
    }

    if (state === 'flying' && lastState !== 'flying') {
      startMove(tv.group.getWorldPosition(new THREE.Vector3()), signals, FLY_OUT_S, true);
      lastJump = jump;
    } else if (jump !== lastJump) {
      startMove(group.position, signals, JUMP_ANIM_S, false);
      lastJump = jump;
    }
    lastState = state;

    const k = THREE.MathUtils.clamp((signals.t - anim.start) / anim.dur, 0, 1);
    const ease = 1 - (1 - k) ** 3;
    group.position.lerpVectors(anim.from, anim.to, ease);
    group.scale.setScalar(anim.grow ? THREE.MathUtils.lerp(FLY_OUT_START_SCALE, 1, ease) : 1);
    head.set(signals.headPos.x, signals.headPos.y, signals.headPos.z);
    group.lookAt(head);
    group.visible = true;
    shared.position.copy(group.position);
    shared.visible = true;

    const kind = state === 'locked' ? 'locked' : state === 'enabled' ? 'enabled' : 'chase';
    let text = LABELS[kind].text;
    if (state === 'locked') {
      // The rule restarts the hold when the head moves: progress drops, and is
      // exactly 0 on the restart frame. The first locked frame is not a restart.
      if (lockedProgress !== null && (progress < lockedProgress || progress === 0)) {
        movedUntil = signals.t + MOVED_S;
      }
      lockedProgress = progress;
      text = signals.t < movedUntil ? MOVED_TEXT : lockedText(progress);
    } else {
      lockedProgress = null;
      movedUntil = -Infinity;
    }
    const labelKey = `${kind}:${text}`;
    if (labelKey !== labelDrawn) {
      labelDrawn = labelKey;
      const wM = drawLabel(label, { ...LABELS[kind], text });
      ring.mesh.position.x = -(wM / 2 + RING_GAP_M + RING_M / 2);
    }
    ring.mesh.visible = state === 'locked';
    const ringStep = Math.round(progress * 100);
    if (ring.mesh.visible && ringStep !== ringDrawn) {
      ringDrawn = ringStep;
      drawRing(ring, progress);
    }

    // Drift from the pose where the hold last (re)started, for tuning 1 cm / 1°.
    let holdDriftCm = null;
    let holdDriftDeg = null;
    if (state === 'locked') {
      if (!holdPose || progress === 0) {
        holdPose = { pos: { ...signals.headPos }, quat: { ...signals.headQuat } };
      }
      const p = signals.headPos;
      holdDriftCm = +(100 * Math.hypot(p.x - holdPose.pos.x, p.y - holdPose.pos.y, p.z - holdPose.pos.z)).toFixed(2);
      holdDriftDeg = +quatAngleDeg(signals.headQuat, holdPose.quat).toFixed(2);
    } else {
      holdPose = null;
    }

    return {
      debug: {
        skipJump: jump,
        skipReach: +group.position.distanceTo(head).toFixed(3),
        holdDriftCm,
        holdDriftDeg,
      },
    };
  };
}
