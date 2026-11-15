// Warnings and the domain (off with ?domain=0): the first 2 look-aways are
// warnings; the next one starts the domain (5 s cast, then 30 s of ad wall)
// instead. Spec values (2 warnings, 5 s, 30 s) are written out literally so
// changing a constant makes a test fail.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';
import { LINEUP } from '../src/attention/lineup.js';
import { RULES } from '../src/attention/rules/index.js';
import { domainFor } from '../src/domain.js';

// The run as main.js builds it for a URL: RULES, then what the URL's flags add.
const runFor = (search) => createRun({ lineup: LINEUP, rules: [...RULES, ...domainFor(search).rules] });
const domainRun = () => runFor('');

const AWAY = { headAngle: 40 };
const BACK = { headAngle: 0 };
const LOOK_AWAY = 'Please return your eyes to the ad';

// One look-away and back. Returns the output of the frame that looked away.
function glance(run) {
  const out = run.frame(AWAY);
  run.frame(BACK);
  return out;
}

// Uses up the 2 warnings on GLOOP, then looks away once more.
function startDomain(run = domainRun()) {
  if (!run.out) run.toFirstAd();
  for (let i = 0; i < 2; i++) glance(run);
  run.frame(AWAY);
  return run;
}

describe('warnings', () => {
  it('the first two look-aways are warning 1 of 2 and the final warning; the third starts the domain', () => {
    const run = domainRun();
    run.toFirstAd();
    const outs = [glance(run), glance(run)];
    expect(outs.map((o) => o.banner)).toEqual([
      `${LOOK_AWAY} (warning 1 of 2)`,
      `${LOOK_AWAY} (final warning)`,
    ]);
    for (const out of outs) expect(out).toMatchObject({ playing: false, tint: 'red', domain: null });
    expect(run.frame(AWAY).domain).toEqual({ phase: 'cast', elapsed: 0 });
  });

  it('one long look-away uses one warning, however often it rewinds', () => {
    const run = domainRun();
    run.toFirstAd();
    run.run(10, AWAY);
    expect(run.out.banner).toBe(`${LOOK_AWAY} (warning 1 of 2)`);
    expect(run.out.domain).toBe(null);
  });

  it('warnings carry over from one ad to the next', () => {
    const run = domainRun();
    run.toFirstAd();
    glance(run);
    run.frame({ jumpTo: 3 }); // WRAPZILLA
    expect(glance(run)).toMatchObject({ screen: 'ad3', banner: `${LOOK_AWAY} (final warning)` });
    expect(run.frame(AWAY).domain).toEqual({ phase: 'cast', elapsed: 0 });
  });
});

describe('the domain', () => {
  it('the look-away after the final warning starts it: the ad pauses, with no red room and no look-away banner', () => {
    const run = startDomain();
    expect(run.out).toMatchObject({
      screen: 'ad1', playing: false, seek: 0, tint: null, banner: null,
      domain: { phase: 'cast', elapsed: 0 },
    });
    expect(run.out.stats.headTurns).toBe(3);
  });

  it('casts for 5 s, then runs the ad wall for 30 s, then ends', () => {
    const run = startDomain();
    for (let i = 1; i < 35 / DT; i++) {
      const elapsed = i * DT;
      expect(run.frame().domain).toEqual({ phase: elapsed < 5 ? 'cast' : 'ads', elapsed });
    }
    expect(run.frame().domain).toBe(null); // 35 s
  });

  it('where the head points, and palms, make no difference during it', () => {
    const run = startDomain();
    const signals = (e) => {
      if (e < 10) return { headAngle: Math.floor(e * 2) % 2 ? 90 : 0 }; // a turn every 0.5 s
      if (e < 20) return { headAngle: 0, palmsUp: true };
      return { headAngle: 90, palmsUp: true };
    };
    for (let i = 1; i < 35 / DT; i++) {
      const out = run.frame(signals(i * DT));
      expect(out).toMatchObject({ screen: 'ad1', playing: false, seek: 0, tint: null });
      expect(out.domain).not.toBe(null);
    }
    expect(run.out.stats.headTurns).toBe(3);
  });

  it('when it ends the ad starts again from the top and plays', () => {
    const run = domainRun();
    run.toFirstAd();
    run.run(6); // 6 s into GLOOP
    startDomain(run);
    const at = run.video.t;
    expect(at).toBeGreaterThan(5);
    run.run(35 - DT);
    expect(run.video.t).toBe(at); // paused throughout
    expect(run.frame()).toMatchObject({ screen: 'ad1', playing: true, seek: -at, domain: null, banner: null });
    expect(run.video.t).toBe(DT); // from 0, one frame played
  });

  it('a look-away still going on when it ends is the first new warning', () => {
    const run = startDomain();
    run.run(35 - DT, AWAY);
    expect(run.out.domain).not.toBe(null);
    expect(run.frame(AWAY)).toMatchObject({
      playing: false, tint: 'red', domain: null, banner: `${LOOK_AWAY} (warning 1 of 2)`,
    });
    run.frame(BACK);
    expect(glance(run).banner).toBe(`${LOOK_AWAY} (final warning)`);
  });

  it('when it ends the warnings are back', () => {
    const run = startDomain();
    run.run(35, BACK);
    expect(run.out.domain).toBe(null);
    expect(glance(run).banner).toBe(`${LOOK_AWAY} (warning 1 of 2)`);
    glance(run);
    expect(run.frame(AWAY).domain).toEqual({ phase: 'cast', elapsed: 0 }); // and they run out again
  });

  it('a force-pass during it ends it and moves to the next ad', () => {
    const run = startDomain();
    run.run(8); // into the ad wall
    expect(run.out.domain.phase).toBe('ads');
    run.run(2, (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed }));
    expect(run.frame({ selectHeld: 2 })).toMatchObject({ screen: 'content', domain: null });
    expect(run.frame().domain).toBe(null);
  });

  it('a jump during it ends it, and the new ad is not restarted when the 35 s would have run out', () => {
    const run = startDomain();
    run.run(8);
    expect(run.frame({ jumpTo: 3 })).toMatchObject({ screen: 'ad3', domain: null });
    for (let i = 0; i < 30 / DT; i++) expect(run.frame()).toMatchObject({ screen: 'ad3', seek: 0, domain: null });
  });

  it('on WRAPZILLA it hides the gate, and a shout or a clap passes nothing until it ends', () => {
    const run = domainRun();
    run.frame({ jumpTo: 3 });
    const shout = { micLevel: 0.9, micAvailable: true, clap: true };
    startDomain(run);
    for (let i = 1; i < 35 / DT; i++) {
      const out = run.frame(shout);
      expect(out).toMatchObject({ screen: 'ad3', banner: null, gate: { visible: false, label: null } });
      expect(out.domain).not.toBe(null);
    }
    run.frame(); // the domain ends: WRAPZILLA again, its gate back
    expect(run.out).toMatchObject({ screen: 'ad3', domain: null, banner: 'Say FLEX TAPE to continue' });
  });

  it('counts as time on ads', () => {
    const run = startDomain();
    const before = run.out.stats.adTime;
    run.run(35);
    expect(run.out.stats.adTime).toBeCloseTo(before + 35, 9);
  });

  it('never starts where look-away does not apply: GRIN+ and the finale', () => {
    for (const ad of [2, 4]) {
      const run = domainRun();
      run.frame({ jumpTo: ad });
      for (let i = 0; i < 12; i++) expect(glance(run).domain).toBe(null);
    }
  });
});

describe('the ?domain flag', () => {
  it('the domain is on by default; ?domain=0 or missing media adds nothing', () => {
    for (const search of ['', '?hints', '?domain', '?domain=1']) {
      const on = domainFor(search);
      expect(on.on).toBe(true);
      expect(on.rules.map((r) => r.id)).toEqual(['domain']);
      expect(on.features).toHaveLength(1);
    }
    for (const off of [domainFor('?domain=0'), domainFor('', false)]) {
      expect(off).toEqual({ on: false, rules: [], features: [] });
    }
  });

  it('with ?domain=0 a look-away shows the plain banner, never warns and no domain starts', () => {
    const run = runFor('?domain=0');
    run.toFirstAd();
    for (let i = 0; i < 12; i++) {
      expect(glance(run)).toMatchObject({ banner: 'Please return your eyes to the ad', domain: null });
    }
    expect(run.out.stats.headTurns).toBe(12);
  });
});
