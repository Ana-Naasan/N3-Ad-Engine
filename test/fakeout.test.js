// The fake-out (?fakeout in the URL). GLOOP gives up after three look-away
// warnings, the content seems to resume, GLOOP comes back and has to be
// watched to its end, then GRIN+ starts as usual. A voice (a feature) starts
// a few seconds after the content resumes and stops when the returning GLOOP
// ends. Spec values (3 warnings, 3 s, 10 s, 3 to 6 s, 1.5 s) are written out
// literally so changing a constant makes a test fail.
import fs from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRun, DT } from './helpers/frames.js';
import { LINEUP } from '../src/attention/lineup.js';
import { FAKEOUT_LINEUP } from '../src/attention/lineup-fakeout.js';
import { RULES } from '../src/attention/rules/index.js';
import * as fakeoutRule from '../src/attention/rules/fakeout.js';
import { createNag } from '../src/features/fakeout-voice.js';
import { fakeoutFor } from '../src/fakeout.js';

const fakeoutRun = () => createRun({ lineup: FAKEOUT_LINEUP, rules: [...RULES, fakeoutRule] });

const AWAY = { headAngle: 90 };
const BANNER = 'Fine. Enjoy your video.';

// One look-away of `seconds`, then one second facing the TV again.
function lookAwayAndBack(run, seconds = 1) {
  run.run(seconds, AWAY);
  run.run(1);
}

// GLOOP, two warnings, then the third look-away held until GLOOP gives up.
// Returns the first frame of the resumed content.
function dodgeGloop(run) {
  run.toFirstAd();
  run.run(1);
  lookAwayAndBack(run);
  lookAwayAndBack(run);
  run.run(3, AWAY);
  expect(run.out.screen).toBe('ad1');
  return run.frame(AWAY);
}

// Holding a select that started `elapsed` seconds ago.
const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

describe('GLOOP gives up after three warnings', () => {
  it('each look-away is a warning, shown as a banner once the viewer looks back', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    expect(run.run(1).banner).toBeNull();
    run.run(1, AWAY);
    expect(run.out.banner).toBe('Please return your eyes to the ad'); // look-away ranks above
    expect(run.run(1).banner).toBe('Warning 1 of 3');
    lookAwayAndBack(run);
    expect(run.out.banner).toBe('Warning 2 of 3');
    expect(run.out.screen).toBe('ad1');
  });

  it('on the third warning, 3 s of looking away makes the ad give up and the content resume', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    run.run(1);
    lookAwayAndBack(run);
    lookAwayAndBack(run);
    run.run(3, AWAY); // away for 0 … 3 − DT
    expect(run.out.screen).toBe('ad1');
    const out = run.frame(AWAY);
    expect(out).toMatchObject({ screen: 'content', playing: true, loop: false, banner: BANNER, tint: null });
  });

  it('two warnings are not enough, however long they last', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    lookAwayAndBack(run, 8);
    run.run(8, AWAY);
    expect(run.out.screen).toBe('ad1');
  });

  it('a third look-away shorter than 3 s does not give up; the next one starts its own 3 s', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    lookAwayAndBack(run);
    lookAwayAndBack(run);
    lookAwayAndBack(run, 2);
    expect(run.out).toMatchObject({ screen: 'ad1', banner: 'Warning 3 of 3' });
    run.run(3, AWAY);
    expect(run.out.screen).toBe('ad1');
    expect(run.frame(AWAY).screen).toBe('content');
  });

  it('covering the eyes is not a warning', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    for (let i = 0; i < 4; i++) {
      run.run(1, { headAngle: 90, palmsUp: true });
      run.run(1);
    }
    expect(run.out).toMatchObject({ screen: 'ad1', banner: null });
    // The ad kept playing on the palms, so it counts as watched.
    expect(run.run(3).screen).toBe('ad2');
  });

  it('GLOOP in the original lineup never gives up', () => {
    const run = createRun({ rules: [...RULES, fakeoutRule] });
    run.toFirstAd();
    for (let i = 0; i < 5; i++) lookAwayAndBack(run, 4);
    expect(run.out).toMatchObject({ screen: 'ad1', banner: null });
  });
});

describe('after a dodged GLOOP', () => {
  it('the content plays for 10 s, then GLOOP comes back from the top', () => {
    const run = fakeoutRun();
    dodgeGloop(run);
    expect(run.run(10 - DT).screen).toBe('content');
    const out = run.frame();
    expect(out).toMatchObject({ screen: 'ad1', adIndex: 2, playing: true, loop: false, banner: null });
    expect(run.video.t).toBeLessThan(1); // a new video starts from the top
  });

  it('looking away during the resumed content does nothing', () => {
    const run = fakeoutRun();
    dodgeGloop(run);
    const seeks = run.seeks.length;
    run.run(10 - DT, AWAY);
    expect(run.out).toMatchObject({ screen: 'content', playing: true, tint: null, banner: BANNER });
    expect(run.seeks.length).toBe(seeks);
  });

  it('the returning GLOOP has to be watched: looking away pauses and rewinds it, with no give-up', () => {
    const run = fakeoutRun();
    dodgeGloop(run);
    run.run(10 + 4);
    for (let i = 0; i < 4; i++) lookAwayAndBack(run, 4); // four look-aways, each past 3 s
    expect(run.out).toMatchObject({ screen: 'ad1', adIndex: 2, banner: null });
    run.run(4, AWAY);
    expect(run.out).toMatchObject({ screen: 'ad1', playing: false, tint: 'red' });
    expect(run.seeks.at(-1)).toBeLessThan(0);
  });

  it('GRIN+ starts when the returning GLOOP is watched to its end', () => {
    const run = fakeoutRun();
    dodgeGloop(run);
    run.run(10); // the content
    expect(run.run(10 - DT).screen).toBe('ad1'); // the fake video is 10 s
    const out = run.run(2 * DT);
    expect(out).toMatchObject({ screen: 'ad2', adIndex: 3, loop: true });
    expect(run.run(35).screen).toBe('ad2'); // GRIN+ loops until passed, as before
  });

  it('a 2 s select hold on GLOOP is a dodge too', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    run.run(2, holding);
    expect(run.frame({ selectHeld: 2 })).toMatchObject({ screen: 'content', banner: BANNER });
    expect(run.run(10 - DT).screen).toBe('content');
    expect(run.frame()).toMatchObject({ screen: 'ad1', adIndex: 2 });
  });
});

describe('after a GLOOP watched to its end', () => {
  it('GRIN+ starts within three frames and neither added step stays', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    run.run(10 - DT);
    expect(run.out.screen).toBe('ad1');
    const screens = [run.frame(), run.frame(), run.frame()].map((o) => o.screen);
    expect(screens).toEqual(['content', 'ad1', 'ad2']);
    expect(run.out.adIndex).toBe(3);
  });

  it('warnings do not change that', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    lookAwayAndBack(run);
    lookAwayAndBack(run);
    run.run(30); // more than GLOOP needs, rewinds included
    expect(run.out.screen).toBe('ad2');
  });

  it('the next run starts clean: a dodge after a restart still leads into the fake-out', () => {
    const run = fakeoutRun();
    run.toFirstAd();
    run.run(10 + 3 * DT); // watched; on GRIN+ now
    run.frame({ jumpTo: 5 }); // the finale
    expect(run.out.finale).toBe(true);
    run.run(2, holding);
    expect(run.frame({ selectHeld: 2 }).screen).toBe('card');
    run.run(1); // release
    dodgeGloop(run);
    expect(run.run(5).screen).toBe('content');
  });
});

describe('the fake-out lineup', () => {
  it('is LINEUP with GLOOP able to give up and two steps added after it; LINEUP is not changed', () => {
    expect(LINEUP.map((s) => s.screen)).toEqual(['content', 'ad1', 'ad2', 'ad3', 'ad4']);
    expect(LINEUP.some((s) => 'giveUpAfter' in s || 'fakeout' in s)).toBe(false);
    expect(FAKEOUT_LINEUP.map((s) => s.screen)).toEqual([
      'content', 'ad1', 'content', 'ad1', 'ad2', 'ad3', 'ad4',
    ]);
    const [, gloop, resume, rerun] = FAKEOUT_LINEUP;
    expect(gloop).toEqual({ ...LINEUP[1], giveUpAfter: 3 });
    expect(resume).toMatchObject({ kind: 'content', seconds: 10, fakeout: 'resume' });
    expect(rerun).toEqual({ ...LINEUP[1], fakeout: 'rerun' });
    expect(FAKEOUT_LINEUP.filter((s) => LINEUP.includes(s))).toEqual([LINEUP[0], ...LINEUP.slice(2)]);
  });

  it('jump keys 1 to 4 go to GLOOP, GLOOP again, GRIN+ and WRAPZILLA', () => {
    const screens = [1, 2, 3, 4].map((n) => {
      const run = fakeoutRun();
      run.frame({ jumpTo: n });
      return run.run(1).screen; // the returning GLOOP passes at once when nothing was dodged
    });
    expect(screens).toEqual(['ad1', 'ad2', 'ad2', 'ad3']);
  });

  it('counts the resumed content as video time and the returning GLOOP as ad time', () => {
    const run = fakeoutRun();
    dodgeGloop(run);
    const before = run.out.stats;
    run.run(10 + 10); // ends on the first frame of GRIN+
    expect(run.out.screen).toBe('ad2');
    expect(run.out.stats.videoTime - before.videoTime).toBeCloseTo(10, 5);
    expect(run.out.stats.adTime - before.adTime).toBeCloseTo(10, 5);
  });
});

describe('the voice', () => {
  // Feeds createNag one frame per DT and returns the times it turned on and off.
  function track(nag, startT, seconds, screen, atPause = true) {
    const changes = [];
    let was = track.last ?? false;
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const t = startT + i * DT;
      const on = nag({ screen, t, atPause: typeof atPause === 'function' ? atPause(t) : atPause });
      if (on !== was) changes.push([on ? 'on' : 'off', t]);
      was = on;
    }
    track.last = was;
    return changes;
  }
  const fresh = (random) => {
    track.last = false;
    return createNag(() => random);
  };

  it('starts 3 to 6 s after the content resumes, at a random moment', () => {
    for (const [random, at] of [[0, 3], [0.5, 4.5], [1, 6]]) {
      const nag = fresh(random);
      track(nag, 0, 1, 'content');
      track(nag, 1, 5, 'ad1');
      expect(track(nag, 6, 10, 'content')).toEqual([['on', 6 + at]]);
    }
  });

  it('carries on over the returning ad and stops when that ad ends', () => {
    const nag = fresh(0);
    track(nag, 0, 5, 'ad1');
    track(nag, 5, 10, 'content');
    expect(track(nag, 15, 25, 'ad1')).toEqual([]); // still on, however long the ad takes
    expect(track(nag, 40, 5, 'ad2')).toEqual([['off', 40]]);
  });

  it('waits for a gap in the speech, for 1.5 s at most', () => {
    let nag = fresh(0);
    track(nag, 0, 5, 'ad1');
    expect(track(nag, 5, 10, 'content', (t) => t >= 9)).toEqual([['on', 9]]);
    nag = fresh(0);
    track(nag, 0, 5, 'ad1');
    expect(track(nag, 5, 10, 'content', false)).toEqual([['on', 5 + 3 + 1.5]]);
  });

  it('stays off for the first content, for the first GLOOP and for a GLOOP that was watched', () => {
    const nag = fresh(0);
    expect(track(nag, 0, 1, 'content')).toEqual([]);
    expect(track(nag, 1, 10, 'ad1')).toEqual([]);
    // Watched: the two added steps pass in one frame each.
    expect(track(nag, 11, DT, 'content')).toEqual([]);
    expect(track(nag, 11 + DT, DT, 'ad1')).toEqual([]);
    expect(track(nag, 11 + 2 * DT, 30, 'ad2')).toEqual([]);
  });

  it('runs with the real screens of a dodged run', () => {
    const run = fakeoutRun();
    const nag = fresh(0.5);
    const changes = [];
    let was = false;
    const step = (signals) => {
      const t = run.t;
      const on = nag({ screen: run.frame(signals).screen, t });
      if (on !== was) changes.push([on ? 'on' : 'off', run.out.screen]);
      was = on;
    };
    step({ selectStarted: true });
    for (let i = 0; i < 2 / DT; i++) step();
    for (const seconds of [1, 1, 4]) { // three look-aways, the last one held
      for (let i = 0; i < seconds / DT; i++) step(AWAY);
      for (let i = 0; i < 1 / DT; i++) step();
    }
    for (let i = 0; i < 30 / DT; i++) step();
    expect(changes).toEqual([['on', 'content'], ['off', 'ad2']]);
  });
});

describe('the voice feature', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The feature with a fake audio element, Start button and TV videos.
  function setUp(tvExtra = {}) {
    const voice = { calls: [] };
    vi.stubGlobal('Audio', class {
      constructor() { Object.assign(this, { loop: false, currentTime: 5 }); voice.el = this; }
      play() { voice.calls.push('play'); return Promise.resolve(); }
      pause() { voice.calls.push('pause'); }
      removeAttribute(name) { delete this[name]; }
    });
    let click;
    vi.stubGlobal('document', {
      getElementById: (id) => ({ addEventListener: (type, fn) => { if (id === 'start' && type === 'click') click = fn; } }),
    });
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve({ pauses: [] }) }));
    const content = { muted: false, currentTime: 0 };
    const ad = { volume: 1 };
    const tv = { videos: { content: { video: content }, ad1: { video: ad } }, ...tvExtra };
    const update = fakeoutFor('?fakeout').features[0]({ tv });
    const run = fakeoutRun();
    // Frames for `seconds`, each passed on to the feature as main.js does.
    const drive = (seconds, signals = {}) => {
      let result;
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        const t = run.t;
        result = update(run.frame(signals), { t });
      }
      return result;
    };
    const dodge = () => {
      drive(DT, { selectStarted: true });
      drive(2);
      for (const seconds of [1, 1, 3 + DT]) { // three look-aways, the last one held
        drive(seconds, AWAY);
        if (run.out.screen === 'ad1') drive(1);
      }
      expect(run.out.screen).toBe('content');
    };
    return { voice, click, content, ad, run, drive, dodge };
  }

  it('unlocks the voice inside the Start click and leaves it paused', async () => {
    const { voice, click } = setUp();
    click();
    await Promise.resolve();
    expect(voice.el.src).toBe('/voices/content.m4a');
    expect(voice.el.loop).toBe(true);
    expect(voice.calls).toEqual(['play', 'pause']);
  });

  it('mutes the content and plays the voice, keeps it over the returning ad, then undoes it all', () => {
    const { voice, content, ad, run, drive, dodge } = setUp();
    dodge();
    expect(drive(2).debug.fakeoutVoice).toBe('off');
    expect(content.muted).toBe(false);

    expect(drive(6).debug.fakeoutVoice).toBe('on (content)'); // 8 s in: past the 6 s latest start
    expect(run.out.screen).toBe('content');
    expect(content.muted).toBe(true);
    expect(voice.calls).toEqual(['play']);
    expect(voice.el.currentTime).toBe(0); // the voice starts from its top

    drive(2 + 2); // the ad is back
    expect(run.out.screen).toBe('ad1');
    expect(ad.volume).toBe(0.35);
    drive(4, AWAY); // a look-away pauses the ad, not the voice
    expect(run.out.playing).toBe(false);
    expect(voice.calls).toEqual(['play']);

    drive(20); // watched to its end
    expect(run.out.screen).toBe('ad2');
    expect(voice.calls).toEqual(['play', 'pause']);
    expect(content.muted).toBe(false);
    expect(ad.volume).toBe(1);
  });

  it('uses the picked video\'s voice when the TV has a picker, and none for a pick without one', () => {
    const picked = setUp({ contentId: 'dQw4w9WgXcQ' });
    picked.dodge();
    expect(picked.voice.el.src).toBe('/voices/dQw4w9WgXcQ.m4a');
    expect(picked.drive(8).debug.fakeoutVoice).toBe('on (dQw4w9WgXcQ)');

    const mirror = setUp({ contentId: null });
    mirror.dodge();
    expect(mirror.drive(8).debug.fakeoutVoice).toBe('off');
    expect(mirror.content.muted).toBe(false);
    expect(mirror.voice.calls).toEqual([]);
  });

  it('leaves the video\'s sound on when its voice file did not load', () => {
    const { voice, content, ad, drive, dodge } = setUp({ contentId: 'dQw4w9WgXcQ' });
    dodge();
    voice.el.error = { code: 4 }; // what the browser sets for a missing /voices/<id>.m4a
    expect(drive(8).debug.fakeoutVoice).toBe('no voice file (dQw4w9WgXcQ)');
    expect(content.muted).toBe(false);
    expect(ad.volume).toBe(1);
    expect(voice.calls).toEqual([]);
  });
});

describe('the ?fakeout flag', () => {
  it('without the flag the run is the original: LINEUP, no extra rule, no extra feature', () => {
    for (const search of ['', '?snap', '?fakeoutx', '?x=fakeout']) {
      const off = fakeoutFor(search);
      expect(off.on).toBe(false);
      expect(off.lineup).toBe(LINEUP);
      expect(off.rules).toEqual([]);
      expect(off.features).toEqual([]);
    }
  });

  it('with the flag it gives the fake-out lineup, its rule and the voice feature', () => {
    for (const search of ['?fakeout', '?snap&fakeout', '?fakeout=1']) {
      const on = fakeoutFor(search);
      expect(on.on).toBe(true);
      expect(on.lineup).toBe(FAKEOUT_LINEUP);
      expect(on.rules).toEqual([fakeoutRule]);
      expect(on.features).toHaveLength(1);
    }
  });

  it('the placeholder content has a voice file and its pauses', () => {
    expect(fs.existsSync('public/voices/content.m4a')).toBe(true);
    const { pauses } = JSON.parse(fs.readFileSync('public/voices/content.json', 'utf8'));
    expect(Array.isArray(pauses)).toBe(true);
  });
});
