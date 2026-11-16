// The viewer's video between ads: no ad starts until it has really played
// (signals.video.playing), each beaten ad gives it back, and a video that
// stops playing can't strand the viewer: before the first ad it goes back to
// the card, after it the next ad starts. Spec values (8 s, 5 s, 10 s) are
// written out literally so changing a constant makes a test fail.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';

// A rule that passes the current ad on frames where the test sets `pass`.
const passer = { id: 'test', createRule: () => (signals, ad) => (signals.pass && ad.kind === 'ad' ? { passed: true } : {}) };
const stalled = { video: { playing: false } };

describe('content', () => {
  it('waits for the video to really play: 8 s of playback, not loading time, before GLOOP', () => {
    const run = createRun();
    run.frame({ pick: true });
    expect(run.run(9, { pick: true, ...stalled }).screen).toBe('content'); // still loading
    expect(run.run(8 - DT, { pick: true }).screen).toBe('content');
    expect(run.frame({ pick: true }).screen).toBe('ad1');
  });

  it('a pause mid-video stops the count', () => {
    const run = createRun();
    run.frame({ selectStarted: true });
    run.run(4);
    run.run(3, stalled); // buffering
    expect(run.run(4 - DT).screen).toBe('content');
    expect(run.frame().screen).toBe('ad1');
  });

  it('each beaten ad gives the video back for 5 s of playback before the next', () => {
    const run = createRun({ rules: [passer] });
    run.toFirstAd();
    const order = [];
    for (let n = 1; n <= 3; n++) {
      run.run(1);
      run.frame({ pass: true });
      order.push(run.out.screen);
      run.run(2, stalled); // the video comes back slowly: not counted
      expect(run.run(5 - DT).screen).toBe('content');
      order.push(run.frame().screen);
    }
    expect(order).toEqual(['content', 'ad2', 'content', 'ad3', 'content', 'ad4']);
    expect(run.out.finale).toBe(true);
  });

  it('plays and loops while it shows, so a short video never ends mid-run', () => {
    const run = createRun();
    const out = run.frame({ selectStarted: true });
    expect(out).toMatchObject({ screen: 'content', playing: true, loop: true });
  });

  it('before the first ad, a video that never plays goes back to the card after 10 s: no ad without a working video', () => {
    const run = createRun();
    run.frame({ selectStarted: true });
    expect(run.run(10 - DT, stalled).screen).toBe('content');
    expect(run.frame(stalled)).toMatchObject({ screen: 'card', adIndex: 0 });
    expect(run.run(5, stalled).screen).toBe('card'); // and stays there until the next pick
  });

  it('before the first ad, a video that plays and then freezes for 10 s goes back to the card too', () => {
    const run = createRun();
    run.frame({ selectStarted: true });
    run.run(6, stalled);
    run.run(1); // plays 1 s
    expect(run.run(9, stalled).screen).toBe('content');
    expect(run.run(1 + DT, stalled).screen).toBe('card');
  });

  it('after an ad, a video that never comes back lets the next ad start after 10 s, so the viewer is not stranded', () => {
    const run = createRun({ rules: [passer] });
    run.toFirstAd();
    run.frame({ pass: true }); // GLOOP beaten: the video's turn
    expect(run.run(10 - DT, stalled).screen).toBe('content');
    expect(run.frame(stalled).screen).toBe('ad2');
  });

  it('the 10 s count starts again whenever the video plays', () => {
    const run = createRun({ rules: [passer] });
    run.toFirstAd();
    run.frame({ pass: true });
    run.run(6, stalled);
    run.run(1); // plays 1 s
    expect(run.run(9, stalled).screen).toBe('content');
    expect(run.run(1 + DT, stalled).screen).toBe('ad2');
  });
});
