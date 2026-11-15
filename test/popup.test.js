// The "Screen Time Limit Reached" pop-up: POPUP_AFTER_SECONDS into the finale,
// output.popup turns on (the TV grows back and the pop-up covers the video).
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';
import { POPUP_AFTER_SECONDS } from '../src/attention/index.js';

const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

function toFinale() {
  const run = createRun();
  run.toFirstAd();
  run.frame({ jumpTo: 4 });
  expect(run.out.finale).toBe(true);
  return run;
}

describe('screen time pop-up', () => {
  it('is off before the finale and when the finale starts', () => {
    const run = createRun();
    run.toFirstAd();
    expect(run.out.popup).toBe(false);
    run.frame({ jumpTo: 4 });
    expect(run.out.popup).toBe(false);
  });

  it(`turns on ${POPUP_AFTER_SECONDS} s into the finale and stays on`, () => {
    const run = toFinale();
    run.run(POPUP_AFTER_SECONDS - 0.25);
    expect(run.out.popup).toBe(false);
    run.run(0.5);
    expect(run.out.popup).toBe(true);
    run.run(20);
    expect(run.out.popup).toBe(true);
    expect(run.out.finale).toBe(true);
  });

  it('goes away when a 2 s hold restarts the run', () => {
    const run = toFinale();
    run.run(POPUP_AFTER_SECONDS + 1);
    expect(run.out.popup).toBe(true);
    run.run(2, holding);
    run.frame({ selectHeld: 2 });
    expect(run.out.screen).toBe('card');
    expect(run.out.popup).toBe(false);
  });
});
