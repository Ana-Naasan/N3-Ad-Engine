// Look-away: >30° pauses, tints red and shows the banner; <25° resumes; each
// full 3 s away rewinds 3 s, never below 0; each start is a head turn. Spec
// values (30°, 25°, 3 s) are written out literally so changing a constant
// makes a test fail.
import { describe, it, expect } from 'vitest';
import { createRun as createRunWith, DT } from './helpers/frames.js';
import { RULES } from '../src/attention/rules/index.js';
import { domainFor } from '../src/domain.js';

// The run as main.js builds it: RULES, then the domain rule, which puts the warning count in the banner.
const createRun = () => createRunWith({ rules: [...RULES, ...domainFor('').rules] });

const BANNER = 'Please return your eyes to the ad (warning 1 of 2)'; // each run's first look-away
const LOOKING_AWAY = { playing: false, tint: 'red', banner: BANNER };

describe('looking away', () => {
  it('above 30° pauses the ad, tints the room red and shows the banner', () => {
    const run = createRun();
    run.toFirstAd();
    const out = run.frame({ headAngle: 31 });
    expect(out.screen).toBe('ad1');
    expect(out).toMatchObject(LOOKING_AWAY);
  });

  // Angles that swing inside 25°–30°, a new one each frame.
  const hover = (elapsed) => ({ headAngle: 27.5 + 2.5 * Math.sin(elapsed * 5) });

  it('hovering between 25° and 30° never starts looking away', () => {
    const run = createRun();
    run.toFirstAd();
    for (let i = 0; i < 64; i++) {
      const out = run.frame(hover(i / 16));
      expect(out).toMatchObject({ playing: true, tint: null, banner: null });
    }
    expect(run.frame({ headAngle: 30 }).playing).toBe(true);
    expect(run.frame({ headAngle: 25 }).playing).toBe(true);
  });

  it('hovering between 25° and 30° never stops looking away', () => {
    const run = createRun();
    run.toFirstAd();
    run.frame({ headAngle: 31 });
    for (let i = 0; i < 64; i++) {
      const out = run.frame(hover(i / 16));
      expect(out).toMatchObject(LOOKING_AWAY);
    }
    expect(run.frame({ headAngle: 30 }).playing).toBe(false);
    expect(run.frame({ headAngle: 25 }).playing).toBe(false);
  });

  it('looking back below 25° resumes the ad and clears the tint and banner', () => {
    const run = createRun();
    run.toFirstAd();
    run.frame({ headAngle: 31 });
    expect(run.frame({ headAngle: 25 }).playing).toBe(false);
    const out = run.frame({ headAngle: 24.9 });
    expect(out).toMatchObject({ screen: 'ad1', playing: true, tint: null, banner: null });
    const t = run.video.t;
    run.run(1);
    expect(run.video.t).toBeCloseTo(t + 1, 5);
  });
});

describe('rewinding', () => {
  const away = { headAngle: 40 };

  it('rewinds the ad 3 s at every full 3 s of looking away', () => {
    const run = createRun();
    run.toFirstAd();
    run.video.t = 8;
    run.run(3, away); // 0 … 3 − DT s away
    expect(run.seeks).toEqual([]);
    expect(run.frame(away).seek).toBe(-3); // 3 s
    run.run(3 - DT, { headAngle: 27 }); // still away: inside the margin
    expect(run.seeks).toEqual([-3]);
    expect(run.frame(away).seek).toBe(-3); // 6 s
    expect(run.video.t).toBe(2);
  });

  it('looking back below 25° resets the 3 s count', () => {
    const run = createRun();
    run.toFirstAd();
    run.video.t = 8;
    run.run(2.5, away);
    run.frame({ headAngle: 24 }); // a glance back
    run.run(3, away); // 5.5 s away in total, but never 3 s in a row
    expect(run.seeks).toEqual([]);
    expect(run.frame(away).seek).toBe(-3);
  });
});

// Look away on GLOOP when its video is at `from` s, for `seconds` s (the frame
// at `seconds` included). Returns the seek at each full 3 s, plus the run.
// Setting the video time directly reaches `from` = 10 s: the first frame
// away pauses the video, so it never reports ended.
function lookAwayFrom(from, seconds) {
  const run = createRun();
  run.toFirstAd();
  run.video.t = from;
  const seeks = [];
  const frames = Math.round(seconds / DT);
  for (let i = 0; i <= frames; i++) {
    const out = run.frame({ headAngle: 40 });
    if (i > 0 && (i * DT) % 3 === 0) seeks.push(out.seek);
    else expect(out.seek).toBe(0);
    expect(run.video.t).toBeGreaterThanOrEqual(0);
  }
  return { seeks, run };
}

describe('the rewind sweep', () => {
  it.each([
    [2, 12, [-2, 0, 0, 0]],
    [5, 7, [-3, -2]],
    [10, 12, [-3, -3, -3, -1]],
  ])('from %i s, %i s away: seeks %j', (from, seconds, expected) => {
    expect(lookAwayFrom(from, seconds).seeks).toEqual(expected);
  });

  it('starts 0–10 s into the ad × 0–12 s away: never below 0, at most 3 s per full 3 s', () => {
    for (let from = 0; from <= 10; from += 0.5) {
      for (let seconds = 0; seconds <= 12; seconds += 0.5) {
        const { seeks, run } = lookAwayFrom(from, seconds);
        expect(run.minVideoTime).toBeGreaterThanOrEqual(0);
        expect(seeks).toHaveLength(Math.floor(seconds / 3));
        for (const s of seeks) {
          expect(s).toBeGreaterThanOrEqual(-3);
          expect(s).toBeLessThanOrEqual(0);
        }
        const rewound = Math.min(from, 3 * seeks.length);
        expect(run.video.t).toBe(from - rewound);
      }
    }
  });
});

describe('head turns', () => {
  it('each start of looking away counts one head turn; hovering adds none', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(1, { headAngle: 29 }); // never starts
    expect(run.out.stats.headTurns).toBe(0);
    run.run(1, { headAngle: 40 });
    run.run(1, (elapsed) => ({ headAngle: elapsed < 0.5 ? 26 : 31 })); // still the same look-away
    expect(run.out.stats.headTurns).toBe(1);
    run.frame({ headAngle: 10 });
    run.frame({ headAngle: 35 });
    run.frame({ headAngle: 0 });
    run.frame({ headAngle: 90 });
    expect(run.out.stats.headTurns).toBe(3);
  });
});

describe('where look-away does not apply', () => {
  const unaffected = (run, seconds) => {
    for (let i = 0; i < seconds / DT; i++) {
      const out = run.frame({ headAngle: 40 });
      expect(out).toMatchObject({ playing: true, tint: null, seek: 0 });
      expect(out.banner).not.toBe(BANNER);
    }
    expect(run.out.stats.headTurns).toBe(0);
  };

  it('GRIN+ while its gimmick runs (the whole ad: it loops until passed)', () => {
    const run = createRun();
    run.frame({ jumpTo: 2 });
    run.video.t = 5;
    unaffected(run, 7);
    expect(run.out.screen).toBe('ad2');
  });

  it('the finale', () => {
    const run = createRun();
    run.frame({ jumpTo: 4 });
    run.video.t = 5;
    unaffected(run, 7);
    expect(run.out.banner).toBe('Your video will resume after 2 more ads');
  });

  it('the 1 s of content before the ads', () => {
    const run = createRun();
    run.frame({ selectStarted: true });
    unaffected(run, 1 - DT);
    expect(run.out.screen).toBe('content');
  });

  it('while palms are up; looking away starts once they come down', () => {
    const run = createRun();
    run.toFirstAd();
    for (let i = 0; i < 4 / DT; i++) { // the ad keeps playing: stay short of its 10 s end
      const out = run.frame({ headAngle: 40, palmsUp: true });
      expect(out).toMatchObject({ playing: true, tint: null, banner: null, seek: 0 });
    }
    expect(run.out.stats.headTurns).toBe(0);
    expect(run.frame({ headAngle: 40 })).toMatchObject(LOOKING_AWAY);
    expect(run.out.stats.headTurns).toBe(1); // a new look-away starts: one head turn
  });

  it('palms going up ends the look-away and resets the 3 s count', () => {
    const run = createRun();
    run.toFirstAd();
    run.video.t = 8;
    run.run(2, { headAngle: 40 });
    run.frame({ headAngle: 40, palmsUp: true });
    run.run(3, { headAngle: 40 }); // 5 s away in total, 3 s since the palms came down
    expect(run.seeks).toEqual([]);
    expect(run.frame({ headAngle: 40 }).seek).toBe(-3);
  });

  it('it does apply to WRAPZILLA, a gimmick ad without the exemption', () => {
    const run = createRun();
    run.frame({ jumpTo: 3 });
    expect(run.frame({ headAngle: 40 })).toMatchObject({ screen: 'ad3', ...LOOKING_AWAY });
  });
});
