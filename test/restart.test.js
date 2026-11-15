// Restart: in the finale, a select started there and held 2 s goes back to
// the "Pinch to play" card with fresh stats, without leaving VR.
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';
import { RESTART_SECONDS } from '../src/attention/index.js';

const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

function toFinale() {
  const run = createRun();
  run.toFirstAd();
  run.run(3); // some ad time, so stats aren't zero
  run.frame({ jumpTo: 4 });
  expect(run.out.finale).toBe(true);
  return run;
}

describe('restart from the finale', () => {
  it('a select started in the finale and held 2 s returns to the card with fresh stats', () => {
    const run = toFinale();
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

  it('a hold released early does not restart', () => {
    const run = toFinale();
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
    const run = toFinale();
    run.run(RESTART_SECONDS, holding);
    run.frame({ selectHeld: RESTART_SECONDS });
    run.run(1); // still on the card
    expect(run.out.screen).toBe('card');
    run.toFirstAd();
    expect(run.out.screen).toBe('ad1');
  });
});
