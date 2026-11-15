// Force-pass (a 2 s select hold) and jump-to-ad (keys 1–4).
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';

// Signals for a select that started `elapsed` seconds ago and is still held.
const holding = (elapsed) => ({ selectStarted: elapsed === 0, selectHeld: elapsed });

describe('force-pass', () => {
  it('a select started during the ad and held 2 s passes it', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(2, holding); // held 0 … 2 − DT
    expect(run.out.screen).toBe('ad1');
    expect(run.frame({ selectHeld: 2 }).screen).toBe('content');
  });

  it('a hold released before 2 s passes nothing', () => {
    const run = createRun();
    run.frame({ jumpTo: 2 });
    run.run(1.5, holding);
    run.run(1); // released
    run.run(1.5, holding);
    expect(run.out.screen).toBe('ad2');
  });

  it('a Play pinch held 3 s (or longer) does not pass GLOOP', () => {
    const run = createRun();
    // Pinch on the card and keep holding: content for 8 s, then GLOOP.
    run.run(10, holding);
    expect(run.frame({ selectHeld: 10 }).screen).toBe('ad1');
    run.run(5, (e) => ({ selectHeld: 10 + e }));
    expect(run.out.screen).toBe('ad1');
  });

  it('one long hold passes one ad, not several', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(2, holding);
    expect(run.frame({ selectHeld: 2 }).screen).toBe('content');
    run.run(10, (e) => ({ selectHeld: 2 + e }));
    expect(run.out.screen).toBe('ad2');
  });

  it('a select held with the palms over the eyes passes nothing', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(3, (e) => ({ ...holding(e), palmsUp: true }));
    expect(run.out.screen).toBe('ad1');
  });

  it('raising the palms mid-hold cancels it, even once they come down', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(1, holding);
    run.run(0.5, (e) => ({ selectHeld: 1 + e, palmsUp: true }));
    run.run(2, (e) => ({ selectHeld: 1.5 + e }));
    expect(run.out.screen).toBe('ad1');
    run.run(2, holding); // a new select once the palms are down still works
    expect(run.frame({ selectHeld: 2 }).screen).toBe('content');
  });

  it('never passes the finale (a 2 s hold there restarts instead: see restart.test.js)', () => {
    const run = createRun();
    run.frame({ jumpTo: 4 });
    run.run(1.5, holding);
    run.run(5);
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
