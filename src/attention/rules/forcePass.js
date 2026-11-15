// Force-pass: a recording safety net. A select that started during the
// current ad and is held for FORCE_PASS_SECONDS passes that ad. A select
// already held when the ad began never counts, so the Play pinch can't pass
// GLOOP and one long hold passes one ad at most. Does nothing in the finale.
// (Jump keys 1–4 are handled in the core, from signals.jumpTo.)

export const id = 'forcePass';

export const FORCE_PASS_SECONDS = 2;

export function createRule() {
  let currentAd = null;
  let armed = false; // a select started during the current ad
  return (signals, ad) => {
    if (ad !== currentAd) {
      currentAd = ad;
      armed = false;
    }
    if (ad.kind !== 'ad' || ad.finale) return {};
    if (signals.selectStarted) armed = true;
    return armed && signals.selectHeld >= FORCE_PASS_SECONDS ? { passed: true } : {};
  };
}
