// GRIN+ Skip: fly-out, chase, catch, hold-still and the pass.
// Spec values (20 cm, 4 cm, 6 jumps, 1 cm, 1°, 5 s) are written out literally
// so changing a constant makes a test fail.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';
import * as skip from '../src/attention/rules/skip.js';
import { FLY_OUT_S } from '../src/attention/rules/skip.js';

const HEAD = { x: 0, y: 1.2, z: 0 };
const FAR = 0.5; // a fingertip well away from Skip

// A head turned `deg` degrees about the vertical axis.
const yaw = (deg) => {
  const r = (deg * Math.PI) / 180;
  return { x: 0, y: Math.sin(r / 2), z: 0, w: Math.cos(r / 2) };
};

// GRIN+ with Skip just finished flying out (state: running).
function toRunning() {
  const run = createRun({ rules: [skip] });
  run.frame({ jumpTo: 2 });
  expect(run.out.screen).toBe('ad2');
  run.run(FLY_OUT_S);
  expect(run.out.skip.state).toBe('running');
  return run;
}

// One approach: the fingertip comes within 20 cm, then backs off.
function approach(run) {
  run.frame({ skipDistance: 0.19 });
  run.frame({ skipDistance: FAR });
  return run.out;
}

function toCatchable() {
  const run = toRunning();
  for (let i = 0; i < 6; i++) approach(run);
  expect(run.out.skip.state).toBe('catchable');
  return run;
}

// Caught: the touch frame is the first locked frame, so the hold starts there.
function toLocked() {
  const run = toCatchable();
  run.frame({ skipDistance: 0.03 });
  expect(run.out.skip.state).toBe('locked');
  run.frame({ skipDistance: FAR }); // finger off the button
  return run;
}

function toEnabled() {
  const run = toLocked();
  run.run(5);
  expect(run.out.skip.state).toBe('enabled');
  return run;
}

describe('Skip on other ads', () => {
  it('is hidden before and after GRIN+', () => {
    const run = createRun({ rules: [skip] });
    run.toFirstAd();
    expect(run.run(1, { skipDistance: 0.01 }).skip.state).toBe('hidden');
    run.frame({ jumpTo: 3 });
    expect(run.run(1, { skipDistance: 0.01 }).skip.state).toBe('hidden');
  });
});

describe('the full state path', () => {
  it('flying → running → catchable → locked → enabled → passed', () => {
    const run = createRun({ rules: [skip] });
    run.frame({ jumpTo: 2 });
    expect(run.frame().skip).toEqual({ state: 'flying', progress: 0, jump: 0 });
    run.run(FLY_OUT_S);
    expect(run.out.skip.state).toBe('running');
    for (let i = 0; i < 6; i++) approach(run);
    expect(run.out.skip).toEqual({ state: 'catchable', progress: 0, jump: 6 });
    run.frame({ skipDistance: 0.03 });
    expect(run.out.skip.state).toBe('locked');
    expect(run.out.banner).toBe('Hold perfectly still');
    run.frame({ skipDistance: FAR });
    run.run(5);
    expect(run.out.skip).toEqual({ state: 'enabled', progress: 1, jump: 6 });
    expect(run.out.banner).toBe(null);
    run.frame({ skipDistance: 0.03 });
    expect(run.out.screen).toBe('ad3');
  });

  it('ignores fingertips while flying out', () => {
    const run = createRun({ rules: [skip] });
    run.frame({ jumpTo: 2 });
    run.run(FLY_OUT_S - DT, { skipDistance: 0.01 });
    expect(run.out.skip).toEqual({ state: 'flying', progress: 0, jump: 0 });
  });

  it('starts over when GRIN+ is entered again', () => {
    const run = toCatchable();
    run.frame({ jumpTo: 2 });
    expect(run.frame().skip).toEqual({ state: 'flying', progress: 0, jump: 0 });
  });
});

describe('the chase', () => {
  it('jumps when a fingertip comes within 20 cm, not at 21 cm', () => {
    const run = toRunning();
    expect(run.run(1, { skipDistance: 0.21 }).skip.jump).toBe(0);
    expect(run.frame({ skipDistance: 0.19 }).skip.jump).toBe(1);
  });

  it('jumps once per approach', () => {
    const run = toRunning();
    run.run(1, { skipDistance: 0.1 }); // lingering inside 20 cm
    expect(run.out.skip.jump).toBe(1);
    run.frame({ skipDistance: 0.21 }); // back off, then come in again
    expect(run.frame({ skipDistance: 0.15 }).skip.jump).toBe(2);
    run.frame({ skipDistance: null }); // hand lost also re-arms
    expect(run.frame({ skipDistance: 0.15 }).skip.jump).toBe(3);
    expect(run.out.skip.state).toBe('running');
  });

  it('becomes catchable after 6 jumps and stops jumping', () => {
    const run = toRunning();
    for (let i = 0; i < 5; i++) approach(run);
    expect(run.out.skip).toEqual({ state: 'running', progress: 0, jump: 5 });
    approach(run);
    expect(run.out.skip).toEqual({ state: 'catchable', progress: 0, jump: 6 });
    approach(run);
    expect(run.out.skip.jump).toBe(6);
  });

  it('a close fingertip while running is a jump, not a catch', () => {
    const run = toRunning();
    run.frame({ skipDistance: 0.01 });
    expect(run.out.skip).toEqual({ state: 'running', progress: 0, jump: 1 });
  });
});

describe('the catch', () => {
  it('a fingertip within 4 cm catches it; 4.5 cm does not', () => {
    const run = toCatchable();
    expect(run.run(1, { skipDistance: 0.045 }).skip.state).toBe('catchable');
    expect(run.frame({ skipDistance: 0.035 }).skip.state).toBe('locked');
  });

  it('shows the hold banner only while locked', () => {
    const run = toCatchable();
    expect(run.out.banner).toBe(null);
    run.frame({ skipDistance: 0.03 });
    expect(run.run(1).banner).toBe('Hold perfectly still');
  });
});

describe('hold still', () => {
  it('is enabled after 5 s of holding still, with progress filling', () => {
    const run = toLocked(); // locked at t0, and one frame since
    run.run(2.5 - DT); // up to t0 + 2.5
    expect(run.out.skip.progress).toBeCloseTo(0.5, 5);
    run.run(2.5 - DT); // up to t0 + 5 − DT
    expect(run.out.skip.state).toBe('locked');
    expect(run.out.skip.progress).toBeLessThan(1);
    expect(run.frame().skip).toEqual({ state: 'enabled', progress: 1, jump: 6 });
  });

  it('restarts from the new pose when the head moves 1.5 cm', () => {
    const run = toLocked();
    run.run(3);
    const moved = { ...HEAD, x: 0.015 };
    expect(run.frame({ headPos: moved }).skip.progress).toBe(0);
    run.run(5 - DT, { headPos: moved }); // still at the new pose
    expect(run.out.skip.state).toBe('locked');
    expect(run.frame({ headPos: moved }).skip.state).toBe('enabled');
  });

  it('allows 0.5 cm of movement', () => {
    const run = toLocked();
    run.run(5, { headPos: { ...HEAD, y: HEAD.y + 0.005 } });
    expect(run.out.skip.state).toBe('enabled');
  });

  it('restarts when the head turns 1.5°', () => {
    const run = toLocked();
    run.run(3);
    expect(run.frame({ headQuat: yaw(1.5) }).skip.progress).toBe(0);
    run.run(5 - DT, { headQuat: yaw(1.5) });
    expect(run.out.skip.state).toBe('locked');
    expect(run.frame({ headQuat: yaw(1.5) }).skip.state).toBe('enabled');
  });

  it('allows a 0.5° turn', () => {
    const run = toLocked();
    run.run(5, { headQuat: yaw(0.5) });
    expect(run.out.skip.state).toBe('enabled');
  });

  it('measures from where the hold started, so slow drift still restarts it', () => {
    const run = toLocked();
    // 0.6 mm per frame: never more than 1 cm in a frame, 1.2 cm after 20 frames.
    run.run(3, (elapsed) => ({ headPos: { ...HEAD, x: (elapsed / DT) * 0.0006 } }));
    expect(run.out.skip.progress).toBeLessThan(0.5);
  });
});

describe('the pass', () => {
  it('touching while locked does nothing', () => {
    const run = toLocked();
    run.run(1, { skipDistance: 0.01 });
    expect(run.out.screen).toBe('ad2');
    expect(run.out.skip.state).toBe('locked');
  });

  it('touching while enabled passes the ad', () => {
    const run = toEnabled();
    run.run(1, { skipDistance: 0.045 });
    expect(run.out.screen).toBe('ad2');
    expect(run.frame({ skipDistance: 0.035 }).screen).toBe('ad3');
  });

  it('a finger still resting on Skip from the catch must lift and touch again', () => {
    const run = toCatchable();
    run.run(6, { skipDistance: 0.02 }); // caught, held 5 s, finger never left
    expect(run.out.skip.state).toBe('enabled');
    expect(run.out.screen).toBe('ad2');
    run.frame({ skipDistance: FAR });
    expect(run.frame({ skipDistance: 0.02 }).screen).toBe('ad3');
  });

  it('a finger that came back to rest on Skip during the hold must lift too', () => {
    const run = toLocked(); // finger already lifted once
    run.run(5, { skipDistance: 0.02 });
    expect(run.out.skip.state).toBe('enabled');
    expect(run.out.screen).toBe('ad2');
  });
});

describe('chase metres', () => {
  it('counts fingertip travel while running or catchable only', () => {
    const run = createRun({ rules: [skip] });
    run.frame({ jumpTo: 2 });
    run.run(FLY_OUT_S - DT, { fingertipTravel: 0.01 }); // flying: not counted
    expect(run.out.stats.chaseMetres).toBe(0);
    expect(run.frame().skip.state).toBe('running');
    run.run(1, { fingertipTravel: 0.01 }); // running: 16 frames
    expect(run.out.stats.chaseMetres).toBeCloseTo(0.16, 6);
    for (let i = 0; i < 6; i++) approach(run); // 12 frames, no travel
    run.run(0.5, { fingertipTravel: 0.02 }); // catchable: 8 frames
    expect(run.out.stats.chaseMetres).toBeCloseTo(0.32, 6);
    run.frame({ skipDistance: 0.03 }); // caught
    run.run(1, { fingertipTravel: 0.05 }); // locked: not counted
    expect(run.out.stats.chaseMetres).toBeCloseTo(0.32, 6);
  });
});
