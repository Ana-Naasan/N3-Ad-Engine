// Restart: in the finale, once the viewer has brought up the screen time
// pop-up (see popup.test.js), a new select held 2 s goes back to the
// "Pinch to play" card with fresh stats, without leaving VR.
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';
import { RESTART_SECONDS, GO_BACK_AFTER_SECONDS } from '../src/attention/index.js';

const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

function toFinale() {
  const run = createRun();
  run.toFirstAd();
  run.run(3); // some ad time, so stats aren't zero
  run.frame({ jumpTo: 4 });
  expect(run.out.finale).toBe(true);
  return run;
}

// In the finale with the pop-up up and the select that brought it released.
function toPopup() {
  const run = toFinale();
  run.run(GO_BACK_AFTER_SECONDS + 0.5);
  run.frame({ selectStarted: true });
  run.run(0.5);
  expect(run.out.popup).toBe(true);
  return run;
}

describe('restart from the finale', () => {
  it('a select started with the pop-up up and held 2 s returns to the card with fresh stats', () => {
    const run = toPopup();
    expect(run.out.stats.adTime).toBeGreaterThan(0);
    run.run(RESTART_SECONDS, holding);
    expect(run.out.screen).toBe('ad4'); // not yet
    const out = run.frame({ selectHeld: RESTART_SECONDS });
    expect(out.screen).toBe('card');
    expect(out.finale).toBe(false);
    expect(out.adIndex).toBe(0);
    expect(out.usedJump).toBe(false);
    expect(out.stats).toEqual({ adTime: 0, videoTime: 0, headTurns: 0, chaseMetres: 0, peakVolume: 0 });
  });

  it('a hold before the pop-up is up does not restart', () => {
    const run = toFinale();
    run.run(RESTART_SECONDS + 3, holding);
    expect(run.out.screen).toBe('ad4');
    expect(run.out.popup).toBe(false);
  });

  it('a hold released early does not restart', () => {
    const run = toPopup();
    run.run(RESTART_SECONDS - 0.5, holding);
    run.run(2); // released
    expect(run.out.screen).toBe('ad4');
  });

  it('a select already held when the finale began does not restart it', () => {
    const run = createRun();
    run.toFirstAd();
    run.frame({ selectStarted: true, selectHeld: 0, jumpTo: 4 });
    run.run(5, (e) => ({ selectHeld: e }));
    expect(run.out.screen).toBe('ad4');
  });

  it('after a restart, a new pinch starts a fresh run', () => {
    const run = toPopup();
    run.run(RESTART_SECONDS, holding);
    run.frame({ selectHeld: RESTART_SECONDS });
    run.run(1); // still on the card
    expect(run.out.screen).toBe('card');
    run.toFirstAd();
    expect(run.out.screen).toBe('ad1');
  });
});
