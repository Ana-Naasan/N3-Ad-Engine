// The fake-out lineup: LINEUP with GLOOP able to give up, and two steps added
// after it. Pure data. Used only with ?fakeout in the URL (see ../fakeout.js).
// LINEUP is not changed.
//
//   GLOOP        `giveUpAfter`: the ad gives up after that many look-away
//                warnings (see ./rules/fakeout.js)
//   the content  the viewer's video seems to resume. A few seconds in, the
//                speaker starts saying "Don't skip the ad" (the voice is a
//                feature: ../features/fakeout-voice.js)
//   GLOOP again  the ad comes back and has to be watched to its end. The
//                voice carries on over it.
//
// If the viewer watched GLOOP to its end the first time, the rule passes both
// added steps at once and GRIN+ starts as in the original run.
//
// GLOOP again is a second `kind: 'ad'` entry, so with the flag the ads count
// 1 to 5 and the jump keys 1 to 4 go to GLOOP, GLOOP again, GRIN+ and WRAPZILLA.
import { LINEUP } from './lineup.js';

export const GIVE_UP_AFTER_TURNS = 3; // look-away warnings before GLOOP gives up
export const RESUME_SECONDS = 10; // the video plays this long before GLOOP comes back

const at = LINEUP.findIndex((s) => s.name === 'GLOOP');
const gloop = LINEUP[at];

export const FAKEOUT_LINEUP = [
  ...LINEUP.slice(0, at),
  { ...gloop, giveUpAfter: GIVE_UP_AFTER_TURNS },
  {
    kind: 'content', screen: 'content', seconds: RESUME_SECONDS,
    banner: 'Fine. Enjoy your video.', fakeout: 'resume',
  },
  { ...gloop, fakeout: 'rerun' },
  ...LINEUP.slice(at + 1),
];

// The screens of the two added steps, for the voice feature.
export const RESUME_SCREEN = FAKEOUT_LINEUP.find((s) => s.fakeout === 'resume').screen;
export const RERUN_SCREEN = FAKEOUT_LINEUP.find((s) => s.fakeout === 'rerun').screen;
