import * as THREE from 'three';

// palmsUp and clap from the WebXR hand joints (scene space; the hand groups
// are added to the scene by the fingertips sensor).
//   palmsUp  both palms within PALMS_UP_DISTANCE in front of the headset and
//            facing it
//   clap     true for one frame when the palms cross into CLAP_DISTANCE of
//            each other while closing faster than CLAP_SPEED; re-arms once
//            they are apart again
// Debug values in the status line, for tuning these constants in the headset:
//   palmHeadDist   the farther palm's distance to the head (m)
//   palmFacing     the less-facing palm's cosine towards the head (1 = facing)
//   palmGapMin     smallest palm-to-palm distance in the last second (m)
//   palmClosePeak  fastest closing speed in the last second (m/s)
//   claps          claps detected so far
// m, palm centre to head. The head pose is inside the headset, so the visor keeps
// the palms away: palms held over it measured 19 to 25 cm in the headset log,
// and at 0.15 the ad never moved to the palms in any logged run.
export const PALMS_UP_DISTANCE = 0.27;
export const PALM_FACING_MIN = 0.3; // cosine: palm normal vs palm→head direction
export const CLAP_DISTANCE = 0.08; // m, palm centre to palm centre
export const CLAP_SPEED = 1; // m/s, palms closing
// Joint -Y points out of the palm (WebXR Hand Input). Flip to +1 if
// palmFacing reads near -1 with the palms over the eyes.
export const PALM_NORMAL_SIGN = -1;

const PALM_JOINT = 'middle-finger-metacarpal'; // roughly the centre of the palm
const DEBUG_WINDOW = 1; // s

export default function hands({ renderer }) {
  const handGroups = [0, 1].map((i) => renderer.xr.getHand(i));
  const head = new THREE.Vector3();
  const headQuat = new THREE.Quaternion();
  const forward = new THREE.Vector3();
  const toHead = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const palms = [new THREE.Vector3(), new THREE.Vector3()];

  let lastGap = null;
  let lastT = null;
  let clapArmed = true;
  let claps = 0;
  let windowStart = 0;
  let gapMin = null;
  let closePeak = 0;
  let debug = {};

  return (signals) => {
    const { t } = signals;
    head.set(signals.headPos.x, signals.headPos.y, signals.headPos.z);
    const q = signals.headQuat;
    headQuat.set(q.x, q.y, q.z, q.w);
    forward.set(0, 0, -1).applyQuaternion(headQuat);

    let tracked = 0;
    let headDist = 0;
    let facing = 1;
    let inFront = true;
    handGroups.forEach((hand, i) => {
      const joint = hand.joints[PALM_JOINT];
      if (!hand.visible || !joint?.visible) return;
      tracked++;
      const palm = palms[i].copy(joint.position);
      toHead.subVectors(head, palm);
      headDist = Math.max(headDist, toHead.length());
      if (toHead.dot(forward) > 0) inFront = false; // palm behind the head plane
      normal.set(0, PALM_NORMAL_SIGN, 0).applyQuaternion(joint.quaternion);
      facing = Math.min(facing, normal.dot(toHead.normalize()));
    });

    const both = tracked === 2;
    signals.palmsUp = both && inFront && headDist <= PALMS_UP_DISTANCE && facing >= PALM_FACING_MIN;

    // Clap: palm gap and closing speed between frames.
    let clap = false;
    if (t - windowStart >= DEBUG_WINDOW) {
      debug = {
        palmHeadDist: both ? +headDist.toFixed(3) : null,
        palmFacing: both ? +facing.toFixed(2) : null,
        palmGapMin: gapMin === null ? null : +gapMin.toFixed(3),
        palmClosePeak: +closePeak.toFixed(2),
        claps,
      };
      windowStart = t;
      gapMin = null;
      closePeak = 0;
    }
    if (both) {
      const gap = palms[0].distanceTo(palms[1]);
      const dt = lastT === null ? 0 : t - lastT;
      const closing = lastGap !== null && dt > 0 ? (lastGap - gap) / dt : 0;
      gapMin = gapMin === null ? gap : Math.min(gapMin, gap);
      closePeak = Math.max(closePeak, closing);
      if (gap > CLAP_DISTANCE) clapArmed = true;
      else {
        // Only the frame that crosses into CLAP_DISTANCE counts.
        if (clapArmed && closing > CLAP_SPEED) {
          clap = true;
          claps++;
        }
        clapArmed = false;
      }
      lastGap = gap;
      lastT = t;
    } else {
      lastGap = null;
      lastT = null;
    }
    signals.clap = clap;

    return { debug };
  };
}
