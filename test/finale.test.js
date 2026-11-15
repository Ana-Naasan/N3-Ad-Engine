// The finale (VOIDCOLA), reached the way a viewer reaches it: no key jumps.
// Runs with the registered rule list, so every rule that ships is checked
// against the finale too. Spec values are written out literally.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';
import { RULES } from '../src/attention/rules/index.js';

const FINALE_BANNER = 'Your video will resume after 2 more ads';

// Runs frames until `done(out)` holds and returns that frame's time and output.
function until(run, done, signals = () => ({})) {
  for (let n = 0; n < 60 / DT; n++) {
    const t = run.t;
    const out = run.frame(signals(t));
    if (done(out)) return { t, out };
  }
  throw new Error('condition never held within 60 s');
}

// Holds select until the current ad is force-passed, then lets go.
function forcePass(run) {
  const from = run.t;
  const screen = run.out.screen;
  const entered = until(run, (out) => out.screen !== screen, (t) => ({ selectHeld: t - from }));
  run.frame();
  return entered;
}

// A rule that adds to the stats on frames where the test sets `bump`.
const bump = {
  name: 'bump',
  create: () => (signals) => (signals.bump ? { addStats: { headTurns: 1, chaseMetres: 0.25 } } : {}),
};

describe('finale entry', () => {
  it('a run without jumps ends in the finale: flag, banner and the stats frozen at entry', () => {
    const run = createRun({ rules: [...RULES, bump] });
    run.toFirstAd(); // GLOOP starts at t = 1, after exactly 1 s of content
    run.run(4 * DT, { bump: true, micLevel: 0.3 });
    expect(until(run, (out) => out.screen !== 'ad1').out.screen).toBe('ad2'); // GLOOP's video ends
    expect(forcePass(run).out.screen).toBe('ad3'); // past GRIN+
    const entry = forcePass(run); // past WRAPZILLA

    expect(entry.out).toMatchObject({
      screen: 'ad4', finale: true, banner: FINALE_BANNER, playing: true, loop: true, usedJump: false,
    });
    const { adTime, ...rest } = entry.out.stats;
    expect(rest).toEqual({ videoTime: 1, headTurns: 4, chaseMetres: 1, peakVolume: 0.3 });
    expect(adTime).toBeCloseTo(entry.t - 1, 9); // every second from GLOOP's start to entry

    run.run(30, { bump: true, micLevel: 0.9 });
    expect(run.out).toMatchObject({ screen: 'ad4', finale: true, banner: FINALE_BANNER });
    expect(run.out.stats).toEqual(entry.out.stats);
  });

  it('in the finale, looking anywhere or raising palms changes nothing', () => {
    const run = createRun();
    run.frame({ jumpTo: 4 });
    const look = (e) => {
      if (e < 7) return { headAngle: 90 }; // well past 3 s away, twice
      if (e < 10) return { palmsUp: true };
      return { headAngle: Math.floor(e * 2) % 2 ? 60 : 0 }; // a turn every 0.5 s
    };
    for (let e = 0; e < 14; e += DT) {
      expect(run.frame(look(e))).toMatchObject({
        screen: 'ad4', finale: true, banner: FINALE_BANNER,
        playing: true, seek: 0, target: 'tv', tvDim: false, tint: null,
      });
    }
  });
});
