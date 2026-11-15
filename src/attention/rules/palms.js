// Palms over eyes: while signals.palmsUp, the ad moves onto the palms and the
// TV dims. The ad keeps playing. Applies only to ads with `palms: true`
// (every ad except the finale). Contract: see ./index.js.
export const id = 'palms';

export function createRule() {
  return (signals, ad) => {
    if (ad.kind !== 'ad' || !ad.palms || !signals.palmsUp) return {};
    return { target: 'palms', tvDim: true };
  };
}
