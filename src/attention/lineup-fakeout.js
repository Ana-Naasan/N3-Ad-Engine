// The fake-out lineup: LINEUP with two steps added after GLOOP. Pure data.
// Used only with ?fakeout in the URL (see ../fakeout.js). LINEUP is not changed.
//
// After the first ad the viewer's video seems to resume. A few seconds later
// it freezes and a voice repeats "Watch the ad". Then GRIN+ starts as usual.
//
// Both steps are `kind: 'content'`, so the ad numbers, the jump keys and the
// ad guards stay as they are. A content step plays for its `seconds`.
import { LINEUP } from './lineup.js';

export const FAKEOUT_CONTENT_SECONDS = 5; // the video "resumes" for this long
// Length of public/videos/watchTheAd.mp4. scripts/make-watch-the-ad.mjs reads
// both numbers: it freezes the content clip at FAKEOUT_CONTENT_SECONDS and
// makes the clip this long. Run it again after changing either one.
export const WATCH_THE_AD_SECONDS = 6;

const FAKEOUT_STEPS = [
  {
    kind: 'content', screen: 'content', seconds: FAKEOUT_CONTENT_SECONDS,
    banner: 'Fine. Enjoy your video.',
  },
  { kind: 'content', screen: 'watchTheAd', seconds: WATCH_THE_AD_SECONDS },
];

const afterGloop = LINEUP.findIndex((s) => s.name === 'GLOOP') + 1;

export const FAKEOUT_LINEUP = [
  ...LINEUP.slice(0, afterGloop),
  ...FAKEOUT_STEPS,
  ...LINEUP.slice(afterGloop),
];
