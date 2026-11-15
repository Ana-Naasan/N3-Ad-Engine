// Force-pass (2 s select hold) and jump-to-ad (keys 1–4).
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';

// Signals for a select that started `elapsed` seconds ago and is still held.
const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

describe('force-pass', () => {
  it('a 2 s select hold passes the current ad', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(2, holding); // held 0 … 2 − DT
    expect(run.out.screen).toBe('ad1');
    expect(run.frame({ selectHeld: 2 }).screen).toBe('ad2');
  });

  it('a hold released before 2 s passes nothing', () => {
    const run = createRun();
    run.frame({ jumpTo: 2 });
    run.run(1.5, holding);
    run.run(1); // released
    run.run(1.5, holding);
    expect(run.out.screen).toBe('ad2');
  });

  it('the Play pinch cannot pass GLOOP: the hold timer resets on ad change', () => {
    const run = createRun();
    // Pinch on the card and keep holding through the content into GLOOP.
    run.run(3, holding); // GLOOP starts at 1 s held, so 2 s into GLOOP is 3 s held
    expect(run.out.screen).toBe('ad1');
    expect(run.frame({ selectHeld: 3 }).screen).toBe('ad2');
  });

  it('a long hold passes one ad, not several', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(4, holding); // passed GLOOP at 2 s held
    expect(run.out.screen).toBe('ad2');
    expect(run.frame({ selectHeld: 4 }).screen).toBe('ad3');
  });

  it('does nothing in the finale', () => {
    const run = createRun();
    run.frame({ jumpTo: 4 });
    run.run(10, holding);
    expect(run.out.screen).toBe('ad4');
  });
});

describe('jump', () => {
  it.each([1, 2, 3, 4])('jumpTo %i goes to that ad and sets usedJump', (n) => {
    const run = createRun();
    run.toFirstAd();
    expect(run.out.usedJump).toBe(false);
    const out = run.frame({ jumpTo: n });
    expect(out.screen).toBe(`ad${n}`);
    expect(out.adIndex).toBe(n);
    expect(out.usedJump).toBe(true);
  });

  it('works from the card, and usedJump stays set', () => {
    const run = createRun();
    expect(run.frame({ jumpTo: 3 }).screen).toBe('ad3');
    expect(run.frame({ jumpTo: 1 }).screen).toBe('ad1');
    expect(run.run(1).usedJump).toBe(true);
  });

  it('ignores values outside 1–4', () => {
    const run = createRun();
    run.toFirstAd();
    for (const jumpTo of [0, 5, -1, 2.5]) run.frame({ jumpTo });
    expect(run.out.screen).toBe('ad1');
    expect(run.out.usedJump).toBe(false);
  });

  it('does nothing in the finale', () => {
    const run = createRun();
    run.frame({ jumpTo: 4 });
    expect(run.frame({ jumpTo: 1 }).screen).toBe('ad4');
  });
});
