// Fake-out: only with ?fakeout in the URL. ../../fakeout.js adds this rule
// after RULES, so it is not in ./index.js. Contract: see ./index.js.
//
// On the ad with `giveUpAfter` (GLOOP in the fake-out lineup) every look-away
// is a warning, shown as the banner "Warning 2 of 3". On the last warning,
// looking away for GIVE_UP_SECONDS makes the ad give up: it passes, and the
// video seems to resume.
//
// The steps after it carry `fakeout`. They are for a viewer who dodged the ad:
// it gave up, or a 2 s hold passed it. If the viewer watched the ad to its
// end, this rule passes those steps at once. For a viewer who dodged, the
// resumed video's step also ends when the video's file ends.
//
// Look-aways are detected as in ./lookAway.js: the same angles, and not while
// palms are up.
import { LOOK_AWAY_START_DEG, LOOK_AWAY_END_DEG } from './lookAway.js';

export const id = 'fakeout';

export const GIVE_UP_SECONDS = 3; // on the last warning; one look-away rewind

export function createRule() {
  let current = null; // the step this rule saw last
  let turns = 0; // look-aways on the current ad
  let awaySince = null; // when the current look-away started, or null
  let sawEnd = false; // the give-up ad's video reached its end
  let dodged = false; // the give-up ad ended some other way

  return (signals, ad) => {
    if (ad !== current) {
      if (current?.giveUpAfter) dodged = !sawEnd;
      current = ad;
      turns = 0;
      awaySince = null;
      sawEnd = false;
    }

    if (!ad.giveUpAfter) {
      if (!ad.fakeout) return {};
      if (!dodged) return { passed: true };
      // A resumed video shorter than its step: the ad comes back when the file ends.
      const over = ad.fakeout === 'resume' && signals.video?.ended && signals.t > ad.startedAt;
      return over ? { passed: true } : {};
    }

    const { t, headAngle } = signals;
    // The first frame of a step can still carry the last video's `ended`.
    sawEnd = Boolean(signals.video?.ended) && t > ad.startedAt;

    if (signals.palmsUp) {
      awaySince = null;
    } else if (awaySince === null && headAngle > LOOK_AWAY_START_DEG) {
      awaySince = t;
      turns += 1;
    } else if (awaySince !== null && headAngle < LOOK_AWAY_END_DEG) {
      awaySince = null;
    }

    const last = turns >= ad.giveUpAfter;
    if (last && awaySince !== null && t - awaySince >= GIVE_UP_SECONDS) return { passed: true };
    if (!turns) return {};
    return { banner: `Warning ${Math.min(turns, ad.giveUpAfter)} of ${ad.giveUpAfter}` };
  };
}
