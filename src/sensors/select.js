import { rlog } from '../remote-log.js';

// WebXR select (a pinch or a controller trigger):
//   selectStarted  true on the first frame after a new select starts
//   selectHeld     how long the newest select has been held (s); 0 once it ends
// Only the newest select counts, so a hand resting in a pinch (or one whose
// release never arrived) can't lend its hold time to a quick pinch with the
// other hand and force-pass an ad or restart the run.
// A hand-tracked pinch can drop out for a frame or two mid-hold. If the same
// input selects again within REGRIP_SECONDS, the hold carries on: no new
// selectStarted, and the 2 s holds (force-pass, restart) keep counting.
export const REGRIP_SECONDS = 0.2;

export default function select({ renderer, scene }) {
  const events = []; // [kind, input index] since the last frame
  let hold = null; // the newest select: { input, start, endedAt } in signal time (s)

  for (const i of [0, 1]) {
    const controller = renderer.xr.getController(i);
    scene.add(controller);
    controller.addEventListener('selectstart', () => {
      events.push(['start', i]);
      rlog('select-start', { input: i });
    });
    controller.addEventListener('selectend', () => {
      events.push(['end', i]);
      rlog('select-end', { input: i });
    });
    // An input lost mid-select (a hand out of view) may never send selectend.
    controller.addEventListener('disconnected', () => events.push(['lost', i]));
  }
  renderer.xr.addEventListener('sessionend', () => {
    events.length = 0;
    hold = null;
  });

  return (signals) => {
    const { t } = signals;
    let started = false;
    for (const [kind, input] of events) {
      const same = hold?.input === input;
      if (kind === 'start') {
        if (same && hold.endedAt !== null && t - hold.endedAt <= REGRIP_SECONDS) hold.endedAt = null;
        else {
          hold = { input, start: t, endedAt: null };
          started = true;
        }
      } else if (kind === 'end') {
        if (same && hold.endedAt === null) hold.endedAt = t;
      } else if (same) {
        hold = null;
      }
    }
    events.length = 0;
    if (hold?.endedAt != null && t - hold.endedAt > REGRIP_SECONDS) hold = null;

    signals.selectStarted = started;
    signals.selectHeld = hold && hold.endedAt === null ? t - hold.start : 0;
  };
}
