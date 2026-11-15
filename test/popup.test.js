// The "Screen Time Limit Reached" pop-up: the viewer brings it up themselves.
// GO_BACK_AFTER_SECONDS into the finale the banner offers the way back to the
// video; a select (a pinch or a controller trigger) from then on turns
// output.popup on (the TV grows back and the pop-up covers the video).
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';
import {
  GO_BACK_AFTER_SECONDS, GO_BACK_BANNER, WATCH_AGAIN_BANNER, RESTART_SECONDS,
} from '../src/attention/index.js';

const FINALE_BANNER = 'Your video will resume after 2 more ads';
const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

function toFinale() {
  const run = createRun();
  run.toFirstAd();
  run.frame({ jumpTo: 4 });
  expect(run.out.finale).toBe(true);
  return run;
}

// In the finale with the go-back banner showing.
function toGoBack() {
  const run = toFinale();
  run.run(GO_BACK_AFTER_SECONDS + 0.5);
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

  it('never comes up on its own', () => {
    const run = toFinale();
    run.run(30);
    expect(run.out.popup).toBe(false);
    expect(run.out.finale).toBe(true);
  });

  it(`a select before ${GO_BACK_AFTER_SECONDS} s into the finale does nothing`, () => {
    const run = toFinale();
    run.run(GO_BACK_AFTER_SECONDS - 0.5);
    run.frame({ selectStarted: true });
    run.run(10);
    expect(run.out.popup).toBe(false);
  });

  it(`a select from ${GO_BACK_AFTER_SECONDS} s into the finale turns it on, and it stays on`, () => {
    const run = toFinale();
    run.run(GO_BACK_AFTER_SECONDS + 0.25);
    expect(run.out.popup).toBe(false);
    run.frame({ selectStarted: true });
    expect(run.out.popup).toBe(true);
    run.run(20);
    expect(run.out.popup).toBe(true);
    expect(run.out.finale).toBe(true);
  });

  it('the banner is the ad\'s own, then the way back, then how to watch again', () => {
    const run = toFinale();
    run.run(GO_BACK_AFTER_SECONDS - 0.25);
    expect(run.out.banner).toBe(FINALE_BANNER);
    run.run(0.5);
    expect(run.out.banner).toBe(GO_BACK_BANNER);
    run.run(20);
    expect(run.out.banner).toBe(GO_BACK_BANNER);
    run.frame({ selectStarted: true });
    expect(run.out.banner).toBe(WATCH_AGAIN_BANNER);
    run.run(5);
    expect(run.out.banner).toBe(WATCH_AGAIN_BANNER);
  });

  it('the select that brought it up never restarts the run, however long it is held', () => {
    const run = toGoBack();
    run.run(5, holding);
    expect(run.out.popup).toBe(true);
    expect(run.out.screen).toBe('ad4');
  });

  it('a select already held when the finale began does not bring it up', () => {
    const run = createRun();
    run.toFirstAd();
    run.frame({ selectStarted: true, selectHeld: 0, jumpTo: 4 });
    run.run(GO_BACK_AFTER_SECONDS + 5, (e) => ({ selectHeld: e }));
    expect(run.out.popup).toBe(false);
    expect(run.out.screen).toBe('ad4');
  });

  it('goes away when a 2 s hold restarts the run', () => {
    const run = toGoBack();
    run.frame({ selectStarted: true });
    run.run(1);
    expect(run.out.popup).toBe(true);
    run.run(RESTART_SECONDS, holding);
    run.frame({ selectHeld: RESTART_SECONDS });
    expect(run.out.screen).toBe('card');
    expect(run.out.popup).toBe(false);
    expect(run.out.banner).toBe(null);
  });

  it('a new run\'s finale starts without it', () => {
    const run = toGoBack();
    run.frame({ selectStarted: true });
    run.run(1);
    run.run(RESTART_SECONDS, holding);
    run.frame({ selectHeld: RESTART_SECONDS });
    run.run(1);
    run.toFirstAd();
    run.frame({ jumpTo: 4 });
    expect(run.out.popup).toBe(false);
    expect(run.out.banner).toBe(FINALE_BANNER);
  });
});
