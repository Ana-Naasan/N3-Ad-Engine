// Core behaviour of the attention module: the lineup, ad endings, merging
// rule results and stats. Spec values (8 s, 10 s) are written out literally
// so changing a constant makes a test fail.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';
import { LINEUP } from '../src/attention/lineup.js';

// A rule that returns a fixed partial on every frame while `when` holds.
const fakeRule = (id, partial, when = () => true) => ({
  id,
  createRule: () => (signals, ad) => (when(signals, ad) ? partial : {}),
});
const onAds = (signals, ad) => ad.kind === 'ad';

describe('card and content', () => {
  it('shows the "Pinch to play" card, paused, until the first select', () => {
    const run = createRun();
    const out = run.run(5);
    expect(out.screen).toBe('card');
    expect(out.playing).toBe(false);
    expect(out.adIndex).toBe(0);
  });

  it('plays 8 s of content after the first select, then cuts to GLOOP', () => {
    const run = createRun();
    run.run(2); // idle on the card first
    let out = run.frame({ selectStarted: true });
    expect(out.screen).toBe('content');
    expect(out.playing).toBe(true);
    out = run.run(8 - DT);
    expect(out.screen).toBe('content');
    out = run.frame();
    expect(out.screen).toBe('ad1');
    expect(out.adIndex).toBe(1);
    expect(out.playing).toBe(true);
  });

  it('later selects do not restart the content', () => {
    const run = createRun();
    run.frame({ selectStarted: true });
    run.run(0.5);
    run.frame({ selectStarted: true });
    expect(run.run(7.5 - DT).screen).toBe('ad1');
  });
});

describe('ads without a gimmick (GLOOP)', () => {
  it('does not loop and ends on the video ending', () => {
    const run = createRun();
    let out = run.toFirstAd();
    expect(out.loop).toBe(false);
    out = run.run(10 - DT);
    expect(out.screen).toBe('ad1');
    out = run.run(2 * DT); // the fake video reports ended at 10 s
    expect(out.screen).toBe('content');
  });

  it('ends 10 s after it starts if the video failed', () => {
    const run = createRun();
    run.toFirstAd();
    run.video.failed = true;
    run.video.t = 0;
    expect(run.run(10 - DT).screen).toBe('ad1');
    expect(run.run(2 * DT).screen).toBe('content');
  });
});

describe('gimmick ads', () => {
  it('GRIN+ and WRAPZILLA loop until a rule reports passed', () => {
    let pass = false;
    const passer = fakeRule('test', { passed: true }, () => pass);
    const run = createRun({ rules: [passer] });
    run.toFirstAd();
    run.run(10.5); // GLOOP ends, the video resumes
    expect(run.out.screen).toBe('content');
    expect(run.run(5).screen).toBe('ad2');
    expect(run.out.loop).toBe(true);
    expect(run.run(35).screen).toBe('ad2'); // video wraps, ad stays
    pass = true;
    run.frame();
    pass = false;
    expect(run.out.screen).toBe('content');
    expect(run.run(5).screen).toBe('ad3');
    expect(run.out.loop).toBe(true);
    expect(run.run(35).screen).toBe('ad3');
    pass = true;
    run.frame();
    pass = false;
    expect(run.out.screen).toBe('content');
    expect(run.run(5).screen).toBe('ad4');
  });

  it('a failed video does not end a gimmick ad', () => {
    const run = createRun();
    run.frame({ jumpTo: 2 });
    run.video.failed = true;
    expect(run.run(30).screen).toBe('ad2');
  });
});

describe('the finale (VOIDCOLA)', () => {
  it('sets the finale flag and shows its banner', () => {
    const run = createRun();
    const out = run.frame({ jumpTo: 4 });
    expect(out.screen).toBe('ad4');
    expect(out.finale).toBe(true);
    expect(out.banner).toBe('Your video will resume after 2 more ads');
  });

  it('loops forever and never advances, even when a rule reports passed', () => {
    const run = createRun({ rules: [fakeRule('p', { passed: true })] });
    run.frame({ jumpTo: 4 });
    run.video.failed = false;
    let out = run.run(40); // the fake video wraps 4 times
    expect(out.screen).toBe('ad4');
    expect(out.loop).toBe(true);
    expect(out.playing).toBe(true);
    run.video.failed = true;
    expect(run.run(15).screen).toBe('ad4');
  });

  it('every ad\'s own banner comes from the lineup', () => {
    const banners = [1, 2, 3, 4].map((n) => {
      const run = createRun({ rules: [] }); // the lineup alone: rules (the gate's label) rank above it
      run.frame({ jumpTo: n });
      return run.frame().banner;
    });
    expect(banners).toEqual([null, null, null, 'Your video will resume after 2 more ads']);
  });

  it('the lineup turns look-away and palms off only in the finale', () => {
    const ads = LINEUP.filter((s) => s.kind === 'ad');
    expect(ads.map((a) => a.name)).toEqual(['GLOOP', 'GRIN+', 'WRAPZILLA', 'VOIDCOLA']);
    expect(ads.map((a) => [a.lookAway, a.palms])).toEqual([
      [true, true], [true, true], [true, true], [false, false],
    ]);
    expect(ads.map((a) => a.gimmick ?? null)).toEqual([null, 'skip', 'gate', null]);
    expect(ads[1].lookAwayExemptInGimmick).toBe(true);
  });
});

describe('merging rule results', () => {
  const lineupWithBanner = LINEUP.map((s) => (s.screen === 'ad1' ? { ...s, banner: 'ad banner' } : s));

  it('banner priority by rule id: lookAway > skip (hold-still) > gate > the ad\'s own banner', () => {
    const on = { lookAway: true, skip: true, gate: true };
    const rules = [ // listed lowest priority first: list order must not matter
      fakeRule('gate', { banner: 'gate' }, () => on.gate),
      fakeRule('skip', { banner: 'hold' }, () => on.skip),
      fakeRule('lookAway', { banner: 'look' }, () => on.lookAway),
    ];
    const run = createRun({ lineup: lineupWithBanner, rules });
    run.toFirstAd();
    expect(run.frame().banner).toBe('look');
    on.lookAway = false;
    expect(run.frame().banner).toBe('hold');
    on.skip = false;
    expect(run.frame().banner).toBe('gate');
    on.gate = false;
    expect(run.frame().banner).toBe('ad banner');
  });

  it('any pause wins and seeks add up', () => {
    const rules = [
      fakeRule('a', { playing: true, seek: -1 }, onAds),
      fakeRule('b', { playing: false, seek: -2 }, onAds), // on ads only: a paused first video goes back to the card
    ];
    const run = createRun({ rules });
    run.toFirstAd();
    run.video.t = 5;
    const out = run.frame();
    expect(out.playing).toBe(false);
    expect(out.seek).toBe(-3);
  });

  it('clamps the seek so video time never goes below 0', () => {
    const rules = [fakeRule('a', { seek: -3 }), fakeRule('b', { seek: -2 })];
    const run = createRun({ rules });
    run.toFirstAd();
    run.video.t = 1.5;
    expect(run.frame().seek).toBe(-1.5);
    run.run(3);
    expect(run.minVideoTime).toBe(0);
  });

  it('palms target, TV dim and red tint apply if any rule sets them', () => {
    const rules = [
      fakeRule('a', {}),
      fakeRule('b', { target: 'palms', tvDim: true }),
      fakeRule('c', { tint: 'red' }),
    ];
    const run = createRun({ rules });
    run.toFirstAd();
    const out = run.frame();
    expect(out.target).toBe('palms');
    expect(out.tvDim).toBe(true);
    expect(out.tint).toBe('red');
  });

  it('defaults: TV target, no dim, no tint, no banner, Skip hidden, gate hidden', () => {
    const run = createRun();
    run.toFirstAd();
    const out = run.frame();
    expect(out).toMatchObject({
      target: 'tv', tvDim: false, tint: null, banner: null, seek: 0, finale: false,
      skip: { state: 'hidden', progress: 0, jump: 0 },
      gate: { visible: false },
      usedJump: false,
    });
  });

  it('only the skip rule sets the Skip state', () => {
    const skip = { state: 'running', progress: 0, jump: 3 };
    const run = createRun({ rules: [fakeRule('other', { skip: { state: 'enabled', progress: 1, jump: 0 } })] });
    run.toFirstAd();
    expect(run.frame().skip.state).toBe('hidden');
    const run2 = createRun({ rules: [fakeRule('skip', { skip })] });
    run2.toFirstAd();
    expect(run2.frame().skip).toEqual(skip);
  });

  it('rule results from the old ad do not leak into the next ad', () => {
    let pass = false;
    const rules = [fakeRule('p', { passed: true, playing: false, seek: -2 }, () => pass)];
    const run = createRun({ rules });
    run.toFirstAd();
    pass = true;
    const out = run.frame();
    expect(out.screen).toBe('content');
    expect(out.playing).toBe(true);
    expect(out.seek).toBe(0);
  });
});

describe('stats', () => {
  it('counts time on ads (including paused time) and time on video', () => {
    let paused = false;
    const run = createRun({ rules: [fakeRule('pause', { playing: false }, () => paused)] });
    run.toFirstAd();
    run.run(2);
    paused = true;
    run.run(3);
    const { stats } = run.out;
    expect(stats.videoTime).toBeCloseTo(8, 5);
    expect(stats.adTime).toBeCloseTo(5, 5);
    expect(stats.headTurns).toBe(0);
    expect(stats.chaseMetres).toBe(0);
  });

  it('tracks peak volume from micLevel', () => {
    const run = createRun();
    run.frame({ micLevel: 0.05 });
    run.frame({ micLevel: 0.2 });
    run.frame({ micLevel: null });
    expect(run.frame({ micLevel: 0.1 }).stats.peakVolume).toBe(0.2);
  });

  it('sums the stat amounts rules return', () => {
    const run = createRun({ rules: [fakeRule('t', { stats: { headTurns: 1, chaseMetres: 0.25 } })] });
    run.frame();
    const { stats } = run.frame();
    expect(stats.headTurns).toBe(2);
    expect(stats.chaseMetres).toBe(0.5);
  });

  it('freezes all stats at finale entry', () => {
    const run = createRun({ rules: [fakeRule('t', { stats: { headTurns: 1, chaseMetres: 0.5 } })] });
    run.toFirstAd();
    run.run(2, { micLevel: 0.1 });
    const atEntry = run.frame({ jumpTo: 4 }).stats;
    run.run(5, { micLevel: 0.9 });
    expect(run.out.stats).toEqual(atEntry);
    expect(atEntry.peakVolume).toBe(0.1);
    expect(atEntry.headTurns).toBeGreaterThan(0);
  });
});
