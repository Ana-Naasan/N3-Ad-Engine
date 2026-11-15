// GRIN+ Skip: flies out of the TV, runs from the fingertip, lets itself be
// caught, then demands the viewer hold perfectly still before it works.
//
// States (out.skip.state), on the ad whose gimmick is 'skip':
//   flying     FLY_OUT_S after the ad starts; fingertips are ignored
//   running    a fingertip within JUMP_M makes Skip jump (out.skip.jump counts
//              up by one; the feature moves the button when it changes). One
//              jump per approach: the next needs the distance back above JUMP_M
//              (or the hand lost) first. After CATCHABLE_AFTER_JUMPS jumps:
//   catchable  a fingertip within TOUCH_M catches it
//   locked     banner "Hold perfectly still"; progress fills over HOLD_S while
//              the head stays within HOLD_STILL_M and HOLD_STILL_DEG of the
//              pose where the hold started. Moving past either restarts the
//              hold from the new pose.
//   enabled    a touch passes the ad. The touch must start while enabled, so a
//              finger left resting on Skip since the catch has to lift first.
// Fingertip travel while running or catchable adds to stats.chaseMetres.
// A touch is derived here from signals.skipDistance (metres, or null).

export const id = 'skip';

export const FLY_OUT_S = 1; // the feature animates the fly-out over this long
export const JUMP_M = 0.2;
export const CATCHABLE_AFTER_JUMPS = 6;
export const TOUCH_M = 0.04;
export const HOLD_STILL_M = 0.03; // a standing viewer sways 1 to 2 cm without meaning to
export const HOLD_STILL_DEG = 5; // and a few degrees
export const HOLD_S = 5;
export const HOLD_BANNER = 'Hold perfectly still';

// Degrees between two unit quaternions {x, y, z, w}.
export function quatAngleDeg(a, b) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function createRule() {
  let currentAd = null;
  let state;
  let jump;
  let armed; // the fingertip has been away since the last jump / touch
  let hold; // { pos, quat, start } while locked

  return (signals, ad) => {
    if (ad !== currentAd) {
      currentAd = ad;
      state = 'flying';
      jump = 0;
      armed = true;
      hold = null;
    }
    if (ad.gimmick !== 'skip') return {};

    const { t, skipDistance: d } = signals;
    const near = (limit) => d != null && d <= limit;
    let passed = false;
    let chaseMetres = 0;

    if (state === 'flying') {
      if (t - ad.startedAt >= FLY_OUT_S) state = 'running';
    } else if (state === 'running') {
      chaseMetres = signals.fingertipTravel;
      if (!near(JUMP_M)) armed = true;
      else if (armed) {
        jump += 1;
        armed = false;
        if (jump >= CATCHABLE_AFTER_JUMPS) state = 'catchable';
      }
    } else if (state === 'catchable') {
      chaseMetres = signals.fingertipTravel;
      if (near(TOUCH_M)) {
        state = 'locked';
        armed = false;
        hold = { pos: signals.headPos, quat: signals.headQuat, start: t };
      }
    } else if (state === 'locked') {
      armed = !near(TOUCH_M);
      const moved = distance(signals.headPos, hold.pos) > HOLD_STILL_M
        || quatAngleDeg(signals.headQuat, hold.quat) > HOLD_STILL_DEG;
      if (moved) hold = { pos: signals.headPos, quat: signals.headQuat, start: t };
      else if (t - hold.start >= HOLD_S) state = 'enabled';
    } else if (state === 'enabled') {
      if (!near(TOUCH_M)) armed = true;
      else if (armed) passed = true;
    }

    let progress = 0;
    if (state === 'enabled') progress = 1;
    else if (state === 'locked') progress = Math.min(1, (t - hold.start) / HOLD_S);

    const result = { skip: { state, progress, jump } };
    if (state === 'locked') result.banner = HOLD_BANNER;
    if (chaseMetres) result.stats = { chaseMetres };
    if (passed) result.passed = true;
    return result;
  };
}
