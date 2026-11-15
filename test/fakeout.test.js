// The fake-out lineup (?fakeout in the URL): after GLOOP the content seems to
// resume, then the watchTheAd clip plays, then GRIN+ starts as usual. Spec
// values (5 s, 6 s) are written out literally so changing a constant makes a
// test fail.
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';
import { LINEUP } from '../src/attention/lineup.js';
import { FAKEOUT_LINEUP } from '../src/attention/lineup-fakeout.js';
import { fakeoutFor } from '../src/fakeout.js';

const fakeoutRun = () => createRun({ lineup: FAKEOUT_LINEUP });

// Pinch, the 1 s of content, then GLOOP to its end (the fake video is 10 s).
// Returns the first frame after GLOOP.
function pastGloop(run) {
  run.toFirstAd();
  run.run(10 - DT);
  expect(run.out.screen).toBe('ad1');
  return run.frame();
}

// Holding a select that started `elapsed` seconds ago.
const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

describe('the fake-out lineup', () => {
  it('plays content, GLOOP, content, watchTheAd, GRIN+ in that order', () => {
    const run = fakeoutRun();
    const screens = [run.frame({ selectStarted: true }).screen];
    for (let i = 0; i < 40 / DT; i++) {
      const { screen } = run.frame();
      if (screen !== screens.at(-1)) screens.push(screen);
    }
    expect(screens).toEqual(['content', 'ad1', 'content', 'watchTheAd', 'ad2']);
  });

  it('after GLOOP the content plays for 5 s with its banner', () => {
    const run = fakeoutRun();
    let out = pastGloop(run);
    expect(out).toMatchObject({
      screen: 'content', playing: true, loop: false, banner: 'Fine. Enjoy your video.',
    });
    out = run.run(5 - DT);
    expect(out.screen).toBe('content');
    expect(out.banner).toBe('Fine. Enjoy your video.');
    expect(run.frame().screen).toBe('watchTheAd');
  });

  it('watchTheAd plays for 6 s without a banner, then GRIN+ starts', () => {
    const run = fakeoutRun();
    pastGloop(run);
    let out = run.run(5);
    expect(out).toMatchObject({ screen: 'watchTheAd', playing: true, loop: false, banner: null });
    expect(run.run(6 - DT).screen).toBe('watchTheAd');
    out = run.frame();
    expect(out).toMatchObject({ screen: 'ad2', adIndex: 2, loop: true });
    expect(run.run(35).screen).toBe('ad2'); // GRIN+ loops until passed, as before
  });

  it('the two steps are not ads: adIndex is 0 and a 2 s select hold passes neither', () => {
    const run = fakeoutRun();
    expect(pastGloop(run).adIndex).toBe(0);
    run.run(5, holding); // held through the content
    expect(run.out.screen).toBe('watchTheAd');
    expect(run.out.adIndex).toBe(0);
    run.run(6 - DT, (e) => ({ selectHeld: 5 + e }));
    expect(run.out.screen).toBe('watchTheAd');
    // The same hold carries on into GRIN+ and does not pass it either.
    run.run(5, (e) => ({ selectHeld: 11 + e }));
    expect(run.out.screen).toBe('ad2');
  });

  it('looking away or raising palms during the two steps does nothing', () => {
    const run = fakeoutRun();
    pastGloop(run);
    const away = { headAngle: 90, palmsUp: true };
    run.run(5 - DT, away);
    expect(run.out).toMatchObject({
      screen: 'content', playing: true, tint: null, target: 'tv', tvDim: false,
      banner: 'Fine. Enjoy your video.',
    });
    run.run(6, { headAngle: 90 });
    expect(run.out).toMatchObject({ screen: 'watchTheAd', playing: true, tint: null, banner: null });
    expect(run.seeks).toEqual([]);
    expect(run.out.stats.headTurns).toBe(0);
    expect(run.frame().screen).toBe('ad2'); // and the steps still end on time
  });

  it('the ad numbers and jump keys 1–4 are the same as in the original run', () => {
    for (const n of [1, 2, 3, 4]) {
      const run = fakeoutRun();
      const out = run.frame({ jumpTo: n });
      expect(out.screen).toBe(`ad${n}`);
      expect(out.adIndex).toBe(n);
    }
    const run = fakeoutRun();
    run.frame({ jumpTo: 5 });
    expect(run.out.screen).toBe('card');
  });

  it('a jump to GLOOP still leads into the fake-out; a jump to GRIN+ skips it', () => {
    const run = fakeoutRun();
    run.frame({ jumpTo: 1 });
    run.run(10 + DT);
    expect(run.out.screen).toBe('content');
    expect(run.frame({ jumpTo: 2 }).screen).toBe('ad2');
  });

  it('counts the two steps as video time: 1 + 5 + 6 s', () => {
    const run = fakeoutRun();
    pastGloop(run);
    const { stats } = run.run(11);
    expect(run.out.screen).toBe('ad2');
    expect(stats.videoTime).toBeCloseTo(12, 5);
    expect(stats.adTime).toBeCloseTo(10, 5);
  });

  it('is LINEUP with two content steps added after GLOOP; LINEUP is not changed', () => {
    expect(LINEUP.map((s) => s.screen)).toEqual(['content', 'ad1', 'ad2', 'ad3', 'ad4']);
    expect(FAKEOUT_LINEUP.map((s) => s.screen)).toEqual([
      'content', 'ad1', 'content', 'watchTheAd', 'ad2', 'ad3', 'ad4',
    ]);
    const added = FAKEOUT_LINEUP.filter((s) => !LINEUP.includes(s));
    expect(added.map((s) => s.kind)).toEqual(['content', 'content']);
    expect(FAKEOUT_LINEUP.filter((s) => LINEUP.includes(s))).toEqual(LINEUP);
  });
});

describe('the ?fakeout flag', () => {
  it('without the flag the run is the original: LINEUP and no extra video', () => {
    for (const search of ['', '?snap', '?fakeoutx', '?x=fakeout']) {
      const off = fakeoutFor(search);
      expect(off.on).toBe(false);
      expect(off.lineup).toBe(LINEUP);
      expect(off.videoNames).toEqual([]);
    }
  });

  it('with the flag it gives the fake-out lineup and the watchTheAd video', () => {
    for (const search of ['?fakeout', '?snap&fakeout', '?fakeout=1']) {
      const on = fakeoutFor(search);
      expect(on.on).toBe(true);
      expect(on.lineup).toBe(FAKEOUT_LINEUP);
      expect(on.videoNames).toEqual(['watchTheAd']);
    }
  });

  it('the TV gets a video, with a file, for every screen the fake-out adds', () => {
    const original = LINEUP.map((s) => s.screen);
    const extra = FAKEOUT_LINEUP.map((s) => s.screen).filter((s) => !original.includes(s));
    const { videoNames } = fakeoutFor('?fakeout');
    expect(videoNames).toEqual(extra);
    for (const name of videoNames) {
      expect(fs.existsSync(`public/videos/${name}.mp4`), `${name}.mp4`).toBe(true);
    }
  });
});
