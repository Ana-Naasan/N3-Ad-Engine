// Sensors read hardware into the frame's signals (field names: #4's contract).
//
// Module shape: export default function setup(ctx) -> read(signals, frame)
//   ctx    = { renderer, scene, camera, world, tv }, shared and mutable, so a
//            sensor or feature may hang its own shared state on it
//   frame  = { time (ms), xrFrame, pose (viewer pose or null), inVR }
//   read   writes its fields onto `signals`; it may return { debug: {...} },
//          whose fields are merged into the 1 s status log line.
// Positions (headPos, fingertips) are in the XR reference space = scene world
// coordinates; `world` is moved by calibration.
// Sensors run in this order, once per frame, before the attention module.
// One line per module.
import head from './head.js';
import keyboard from './keyboard.js';
import tvClock from './tv-clock.js';
import mic from './mic.js';
import fingertips from './fingertips.js';
import select from './select.js';
import hands from './hands.js';
import skipProximity from './skip-proximity.js';
import picker from './picker.js';

export const SENSORS = [
  head,
  keyboard,
  tvClock,
  mic,
  fingertips,
  select,
  hands, // #8
  skipProximity, // #7
  picker, // YouTube on the TV; sets ctx.picker for its feature
];
