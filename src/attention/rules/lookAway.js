// Look-away: turning the head more than LOOK_AWAY_START_DEG off the TV pauses
// the ad, tints the room red and shows the banner. It lasts until the head
// comes back below LOOK_AWAY_END_DEG; the margin stops it flickering.
// Each full REWIND_SECONDS of continuous looking away rewinds the ad
// REWIND_SECONDS (the core clamps video time at 0); looking back resets the count.
// Each start of looking away counts as one head turn.
// It applies only where the lineup sets `lookAway` (every ad but the finale),
// not on an ad with `lookAwayExemptInGimmick` (GRIN+: its gimmick lasts the
// whole ad, which loops until passed), and not while palms are up.
//
// Warnings and the domain: each start of looking away also uses one of
// WARNINGS warnings, counted across ads and shown in the banner. Once they
// have run out, the next look-away starts the domain instead. The ad stays
// paused for DOMAIN_CAST_SECONDS (Gojo appears and says the line) and then
// DOMAIN_SECONDS (the ad wall), and where the head points doesn't matter.
// When the domain ends the ad starts again from the top and the warnings are
// back. A new ad (a force-pass or a jump) ends the domain at once.
// Contract: see ./index.js.

export const id = 'lookAway';

export const LOOK_AWAY_START_DEG = 30;
export const LOOK_AWAY_END_DEG = 25;
export const REWIND_SECONDS = 3;
export const LOOK_AWAY_BANNER = 'Please return your eyes to the ad';

export const WARNINGS = 3;
export const DOMAIN_CAST_SECONDS = 5;
export const DOMAIN_SECONDS = 30;

// The look-away banner for the nth warning used (1 … WARNINGS).
export function warningBanner(n) {
  return `${LOOK_AWAY_BANNER} (${n >= WARNINGS ? 'final warning' : `warning ${n} of ${WARNINGS}`})`;
}

export function createRule() {
  let awaySince = null; // when the current look-away started, or null
  let rewinds = 0; // full REWIND_SECONDS rewound since then
  let warningsUsed = 0; // across ads, until a domain gives them back
  let domain = null; // { since, adIndex } while the domain runs

  return (signals, ad) => {
    const { t, headAngle } = signals;

    if (domain) {
      const elapsed = t - domain.since;
      const sameAd = ad.index === domain.adIndex;
      if (sameAd && elapsed < DOMAIN_CAST_SECONDS + DOMAIN_SECONDS) {
        const phase = elapsed < DOMAIN_CAST_SECONDS ? 'cast' : 'ads';
        return { playing: false, domain: { phase, elapsed } };
      }
      domain = null;
      if (sameAd) return { seek: -(signals.video?.t ?? 0) }; // the ad starts again from the top
    }

    const applies = ad.lookAway && !ad.lookAwayExemptInGimmick && !signals.palmsUp;
    if (!applies) {
      awaySince = null;
      return {};
    }

    let stats;
    if (awaySince === null && headAngle > LOOK_AWAY_START_DEG) {
      stats = { headTurns: 1 };
      if (warningsUsed >= WARNINGS) {
        warningsUsed = 0;
        domain = { since: t, adIndex: ad.index };
        return { playing: false, domain: { phase: 'cast', elapsed: 0 }, stats };
      }
      warningsUsed += 1;
      awaySince = t;
      rewinds = 0;
    } else if (awaySince !== null && headAngle < LOOK_AWAY_END_DEG) {
      awaySince = null;
    }
    if (awaySince === null) return {};

    const due = Math.floor((t - awaySince) / REWIND_SECONDS);
    const seek = (rewinds - due) * REWIND_SECONDS;
    rewinds = due;
    return { playing: false, seek, tint: 'red', banner: warningBanner(warningsUsed), stats };
  };
}
