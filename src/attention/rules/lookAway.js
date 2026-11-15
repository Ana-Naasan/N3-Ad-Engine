// Look-away: turning the head more than LOOK_AWAY_START_DEG off the TV pauses
// the ad, tints the room red and shows the banner. It lasts until the head
// comes back below LOOK_AWAY_END_DEG; the margin stops it flickering.
// Each full REWIND_SECONDS of continuous looking away rewinds the ad
// REWIND_SECONDS (the core clamps video time at 0); looking back resets the count.
// Each start of looking away counts as one head turn.
// It applies only where the lineup sets `lookAway` (every ad but the finale),
// not on an ad with `lookAwayExemptInGimmick` (GRIN+: its gimmick lasts the
// whole ad, which loops until passed), and not while palms are up.
// Contract: see ./index.js.

export const id = 'lookAway';

export const LOOK_AWAY_START_DEG = 30;
export const LOOK_AWAY_END_DEG = 25;
export const REWIND_SECONDS = 3;
export const LOOK_AWAY_BANNER = 'Please return your eyes to the ad';

export function createRule() {
  let awaySince = null; // when the current look-away started, or null
  let rewinds = 0; // full REWIND_SECONDS rewound since then

  return (signals, ad) => {
    const applies = ad.lookAway && !ad.lookAwayExemptInGimmick && !signals.palmsUp;
    if (!applies) {
      awaySince = null;
      return {};
    }

    const { t, headAngle } = signals;
    let stats;
    if (awaySince === null && headAngle > LOOK_AWAY_START_DEG) {
      awaySince = t;
      rewinds = 0;
      stats = { headTurns: 1 };
    } else if (awaySince !== null && headAngle < LOOK_AWAY_END_DEG) {
      awaySince = null;
    }
    if (awaySince === null) return {};

    const due = Math.floor((t - awaySince) / REWIND_SECONDS);
    const seek = (rewinds - due) * REWIND_SECONDS;
    rewinds = due;
    return { playing: false, seek, tint: 'red', banner: LOOK_AWAY_BANNER, stats };
  };
}
