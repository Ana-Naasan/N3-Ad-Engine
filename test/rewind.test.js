// Rewinds clamp at 0. A fake look-away rule pauses and asks for −3 s at every
// full 3 s of continuous looking away; the core clamps the seek so the video
// time never goes below 0.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';

const REWIND_EVERY = 3;
const REWIND_BY = 3;

function fakeLookAway(isAway) {
  return {
    id: 'lookAway',
    createRule: () => {
      let since = null;
      let rewinds = 0;
      return (signals) => {
        if (!isAway()) {
          since = null;
          return {};
        }
        if (since === null) {
          since = signals.t;
          rewinds = 0;
        }
        const out = { playing: false, banner: 'Please return your eyes to the ad' };
        const full = Math.floor((signals.t - since) / REWIND_EVERY);
        if (full > rewinds) {
          rewinds = full;
          out.seek = -REWIND_BY;
        }
        return out;
      };
    },
  };
}

// Look away when the ad's video is at `from` s, for `away` s. Returns the
// seek on each frame where a rewind was asked for, plus the run.
function lookAway(from, away) {
  let isAway = false;
  const run = createRun({ rules: [fakeLookAway(() => isAway)] });
  run.frame({ jumpTo: 2 }); // GRIN+ loops, so no ad ending gets in the way
  run.frame();
  run.video.t = from;
  isAway = true;
  const seeks = [];
  const frames = Math.round(away / DT);
  for (let i = 0; i <= frames; i++) {
    const elapsed = i * DT;
    const out = run.frame();
    if (elapsed > 0 && elapsed % REWIND_EVERY === 0) seeks.push(out.seek);
    expect(run.video.t).toBeGreaterThanOrEqual(0);
  }
  return { seeks, run };
}

describe('rewind clamp', () => {
  it.each([
    [2, 12, [-2, 0, 0, 0]],
    [5, 7, [-3, -2]],
    [10, 12, [-3, -3, -3, -1]],
  ])('from %i s, %i s away: seeks %j', (from, away, expected) => {
    expect(lookAway(from, away).seeks).toEqual(expected);
  });

  it('sweep: starts 0–10 s × 0–12 s away never take video time below 0', () => {
    for (let from = 0; from <= 10; from += 0.5) {
      for (let away = 0; away <= 12; away += 0.5) {
        const { seeks, run } = lookAway(from, away);
        expect(run.minVideoTime).toBeGreaterThanOrEqual(0);
        expect(seeks).toHaveLength(Math.floor(away / REWIND_EVERY));
        for (const s of seeks) {
          expect(s).toBeGreaterThanOrEqual(-REWIND_BY);
          expect(s).toBeLessThanOrEqual(0);
        }
        const rewound = -seeks.reduce((a, b) => a + b, 0);
        expect(rewound).toBeCloseTo(Math.min(from, REWIND_BY * seeks.length), 9);
      }
    }
  });
});
