// The domain. ../../domain.js adds this rule after RULES (unless the URL has
// ?domain=0), so it is not in ./index.js. Contract: see ./index.js.
//
// The first WARNINGS look-aways are warnings: the look-away banner gains
// "(warning 1 of 2)". The look-away after the final warning starts the domain
// instead. For DOMAIN_CAST_SECONDS + DOMAIN_SECONDS this rule sets `domain`,
// so the core ignores every other rule but force-pass, and the ad stays
// paused. Then the ad starts again from the top and the warnings are back.
// Warnings carry over from one ad to the next.
//
// Look-aways are detected as in ./lookAway.js: the same angles, on the same
// ads, and not while palms are up. createRule({ leave }) names ads it leaves
// alone: no warnings and no domain there.
import { LOOK_AWAY_START_DEG, LOOK_AWAY_END_DEG, LOOK_AWAY_BANNER } from './lookAway.js';

export const id = 'domain';

export const WARNINGS = 2; // look-aways that only warn
export const DOMAIN_CAST_SECONDS = 5; // Gojo arrives and casts
export const DOMAIN_SECONDS = 30; // the ad wall

export function warningBanner(n) {
  return `${LOOK_AWAY_BANNER} (${n >= WARNINGS ? 'final warning' : `warning ${n} of ${WARNINGS}`})`;
}

export function createRule({ leave = [] } = {}) {
  let away = false; // looking away, as the look-away rule sees it
  let warningsUsed = 0;
  let domain = null; // { since, adIndex } while it runs

  return (signals, ad) => {
    const { t, headAngle } = signals;
    const applies = ad.lookAway && !ad.lookAwayExemptInGimmick && !signals.palmsUp
      && !leave.includes(ad.name);
    let turned = false; // a look-away starts on this frame
    if (!applies) away = false;
    else if (!away && headAngle > LOOK_AWAY_START_DEG) away = turned = true;
    else if (away && headAngle < LOOK_AWAY_END_DEG) away = false;

    if (domain) {
      const elapsed = t - domain.since;
      const sameAd = ad.index === domain.adIndex;
      if (sameAd && elapsed < DOMAIN_CAST_SECONDS + DOMAIN_SECONDS) {
        return { playing: false, domain: { phase: elapsed < DOMAIN_CAST_SECONDS ? 'cast' : 'ads', elapsed } };
      }
      domain = null;
      warningsUsed = away ? 1 : 0; // a look-away still going on is the first new warning
      const banner = away ? warningBanner(warningsUsed) : null;
      return sameAd ? { seek: -(signals.video?.t ?? 0), banner } : { banner }; // the ad starts again from the top
    }

    if (turned) {
      if (warningsUsed >= WARNINGS) {
        domain = { since: t, adIndex: ad.index };
        // The look-away rule's result is dropped on this frame, its head turn with it.
        return { playing: false, domain: { phase: 'cast', elapsed: 0 }, stats: { headTurns: 1 } };
      }
      warningsUsed += 1;
    }
    return away ? { banner: warningBanner(warningsUsed) } : {};
  };
}
