// The ad lineup, in play order. Pure data: the attention module reads it.
//
// Ad flags:
//   lookAway / palms          which guards apply to this ad
//   lookAwayExemptInGimmick   look-away is off while the gimmick runs
//   gimmick                   null | 'skip' | 'gate'; a gimmick ad loops
//                             until a rule reports it passed
//   finale                    last ad: never ends, freezes stats
//   banner                    the ad's own banner (lowest priority)

export const CONTENT_SECONDS = 1; // content plays this long before the first ad
export const FAILED_AD_SECONDS = 10; // a failed no-gimmick ad ends this long after it starts

export const LINEUP = [
  { kind: 'content', screen: 'content', seconds: CONTENT_SECONDS },
  { kind: 'ad', screen: 'ad1', name: 'GLOOP', gimmick: null, lookAway: true, palms: true },
  {
    kind: 'ad', screen: 'ad2', name: 'GRIN+', gimmick: 'skip',
    lookAway: true, lookAwayExemptInGimmick: true, palms: true,
  },
  { kind: 'ad', screen: 'ad3', name: 'WRAPZILLA', gimmick: 'gate', lookAway: true, palms: true },
  {
    kind: 'ad', screen: 'ad4', name: 'VOIDCOLA', gimmick: null, finale: true,
    lookAway: false, palms: false, banner: 'Your video will resume after 2 more ads',
  },
];
