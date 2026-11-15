// Force-pass and jump: recording safety nets.
// A select held for FORCE_PASS_SECONDS passes the current ad. Only the part of
// the hold since the ad started counts, so the Play pinch can't pass GLOOP and
// one long hold passes one ad at a time. jumpTo N goes to the Nth ad.
// Neither works in the finale.

export const FORCE_PASS_SECONDS = 2;

export const forcePassJump = {
  name: 'forcePassJump',
  create: () => (signals, ad) => {
    if (ad.finale) return {};
    if (signals.jumpTo != null) return { jumpTo: signals.jumpTo };
    if (ad.kind !== 'ad') return {};
    const heldThisAd = Math.min(signals.selectHeld, signals.t - ad.startedAt);
    return heldThisAd >= FORCE_PASS_SECONDS ? { passed: true } : {};
  },
};
