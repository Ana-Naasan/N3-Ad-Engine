// WRAPZILLA gate: shout past the line, or clap when the mic is unavailable.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';

const micOn = (level) => ({ micAvailable: true, micLevel: level });

// 5 s on the card with no mic, then jump to WRAPZILLA (ad3), so WRAPZILLA
// starts at t = 5, not at session start. The jump frame starts the ad; rules
// act from the next frame.
function atWrapzilla() {
  const run = createRun();
  run.run(5);
  run.frame({ jumpTo: 3 });
  expect(run.out.screen).toBe('ad3');
  return run;
}

describe('gate, mic working', () => {
  it('says "Say WRAPZILLA to continue" and shows the meter with the live level', () => {
    const run = atWrapzilla();
    const out = run.frame(micOn(0.07));
    expect(out.banner).toBe('Say WRAPZILLA to continue');
    expect(out.gate).toEqual({ visible: true, level: 0.07, line: 0.15, label: 'Say WRAPZILLA to continue' });
  });

  it('passes when the level crosses the 0.15 line', () => {
    const run = atWrapzilla();
    run.run(1, micOn(0.149));
    expect(run.out.screen).toBe('ad3');
    expect(run.frame(micOn(0.15)).screen).toBe('content');
  });

  it('does not pass on silence, and silence never counts as unavailable', () => {
    const run = atWrapzilla();
    run.run(20, micOn(0.01)); // a quiet room
    run.run(5, micOn(0)); // dead quiet, mic still working
    expect(run.out.screen).toBe('ad3');
    expect(run.out.banner).toBe('Say WRAPZILLA to continue');
    expect(run.out.gate.visible).toBe(true);
  });

  it('a clap does nothing while the mic works', () => {
    const run = atWrapzilla();
    run.run(1, { ...micOn(0.01), clap: true });
    expect(run.out.screen).toBe('ad3');
  });
});

describe('gate, mic unavailable', () => {
  it('switches to "Clap to continue" after 2 s of the mic being unavailable from WRAPZILLA start', () => {
    const run = atWrapzilla(); // the 2 s count from WRAPZILLA's start; base signals have no mic
    run.run(2 - DT);
    expect(run.out.banner).toBe('Say WRAPZILLA to continue');
    const out = run.frame(); // t = 2
    expect(out.banner).toBe('Clap to continue');
    expect(out.gate.label).toBe('Clap to continue');
  });

  it('a clap passes in clap mode', () => {
    const run = atWrapzilla();
    run.run(3);
    expect(run.out.banner).toBe('Clap to continue');
    expect(run.frame({ clap: true }).screen).toBe('content');
  });

  it('hides the meter in clap mode', () => {
    const run = atWrapzilla();
    expect(run.run(1).gate.visible).toBe(true);
    expect(run.run(1).gate.visible).toBe(false);
  });

  it('stays in clap mode for the rest of the ad if the mic comes back', () => {
    const run = atWrapzilla();
    run.run(3);
    const out = run.frame(micOn(0.5));
    expect(out.screen).toBe('ad3');
    expect(out.banner).toBe('Clap to continue');
    expect(out.gate.visible).toBe(false);
  });

  it('a mic that stops mid-ad switches to clap mode 2 s later', () => {
    const run = atWrapzilla();
    run.run(5, micOn(0.01));
    run.run(2); // mic unavailable: frames at 0 … 2 − DT after it stopped
    expect(run.out.banner).toBe('Say WRAPZILLA to continue');
    expect(run.frame().banner).toBe('Clap to continue'); // 2 s after it stopped
  });
});

describe('gate, other ads', () => {
  it('a shout or a clap does nothing on GLOOP, and no meter shows', () => {
    const run = createRun();
    run.frame({ jumpTo: 1 });
    run.run(5, { ...micOn(0.5), clap: true });
    expect(run.out.screen).toBe('ad1');
    expect(run.out.gate.visible).toBe(false);
    expect(run.out.banner).toBe(null);
  });
});
