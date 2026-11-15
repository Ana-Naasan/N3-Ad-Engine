import { rlog } from '../remote-log.js';

// WebXR select (a pinch or a controller trigger): selectStarted is true on the
// first frame after any select starts; selectHeld is the longest current hold (s).
export default function select({ renderer, scene }) {
  const held = new Map(); // input index -> start time in s (null until the next frame)
  let started = false;

  for (const i of [0, 1]) {
    const controller = renderer.xr.getController(i);
    scene.add(controller);
    controller.addEventListener('selectstart', () => {
      held.set(i, null);
      started = true;
      rlog('select-start', { input: i });
    });
    controller.addEventListener('selectend', () => {
      held.delete(i);
      rlog('select-end', { input: i });
    });
  }
  renderer.xr.addEventListener('sessionend', () => held.clear());

  return (signals) => {
    let longest = 0;
    for (const [i, start] of held) {
      if (start === null) held.set(i, signals.t);
      else longest = Math.max(longest, signals.t - start);
    }
    signals.selectStarted = started;
    signals.selectHeld = longest;
    started = false;
  };
}
