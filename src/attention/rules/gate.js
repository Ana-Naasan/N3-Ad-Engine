// WRAPZILLA gate: the ad passes when the mic level reaches GATE_LINE.
// If micAvailable stays false for MIC_UNAVAILABLE_SECONDS (counted from the
// ad's start at the earliest; silence doesn't count), the gate switches to
// clap mode for the rest of the ad: "Clap to continue", no meter, and a clap
// passes. The label goes in the banner; the gate-meter feature draws `gate`.

export const id = 'gate';

export const GATE_LINE = 0.15; // quiet room ~0.01 < line < a shout (M1 in-VR peak 0.203–0.247)
export const MIC_UNAVAILABLE_SECONDS = 2;
export const SAY_LABEL = 'Say FLEX TAPE to continue';
export const CLAP_LABEL = 'Clap to continue';

export function createRule() {
  let currentAd = null; // the WRAPZILLA step this state belongs to
  let unavailableSince = null;
  let clapMode = false;

  return (signals, ad) => {
    if (ad.gimmick !== 'gate') return {};
    if (ad !== currentAd) {
      currentAd = ad;
      unavailableSince = ad.startedAt;
      clapMode = false;
    }
    if (signals.micAvailable) unavailableSince = null;
    else unavailableSince ??= signals.t;
    if (!signals.micAvailable && signals.t - unavailableSince >= MIC_UNAVAILABLE_SECONDS) clapMode = true;

    if (clapMode) {
      if (signals.clap) return { passed: true };
      return { banner: CLAP_LABEL, gate: { visible: false, level: 0, line: GATE_LINE, label: CLAP_LABEL } };
    }
    if (signals.micAvailable && signals.micLevel >= GATE_LINE) return { passed: true };
    return {
      banner: SAY_LABEL,
      gate: { visible: true, level: signals.micLevel ?? 0, line: GATE_LINE, label: SAY_LABEL },
    };
  };
}
