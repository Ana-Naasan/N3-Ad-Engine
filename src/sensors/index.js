// Sensors read hardware into the frame's signals (field names: #4's contract).
// Each module default-exports setup(ctx) -> read(signals, frame), where
// frame = { time, xrFrame, pose, inVR }. Add one line per sensor.
import head from './head.js';
import keyboard from './keyboard.js';
import tvClock from './tv-clock.js';
import mic from './mic.js';
import fingertips from './fingertips.js';
import select from './select.js';

export const SENSORS = [
  head,
  keyboard,
  tvClock,
  mic,
  fingertips,
  select,
];
