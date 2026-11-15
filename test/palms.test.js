// Palms over eyes: while palmsUp, the ad moves onto the palms and the TV dims.
// The ad keeps playing. No effect on the card, the content or the finale.
import { describe, it, expect } from 'vitest';
import { createRun } from './helpers/frames.js';
import { LINEUP } from '../src/attention/lineup.js';
import { RULES } from '../src/attention/rules/index.js';
import * as palms from '../src/attention/rules/palms.js';

const UP = { palmsUp: true };

describe('palms', () => {
  it.each([1, 2, 3])('palmsUp on ad%i: palms target, TV dimmed, ad still playing', (n) => {
    const run = createRun();
    run.frame({ jumpTo: n });
    run.run(1);
    const out = run.frame(UP);
    expect(out.screen).toBe(`ad${n}`);
    expect(out.target).toBe('palms');
    expect(out.tvDim).toBe(true);
    expect(out.playing).toBe(true);
  });

  it('the ad keeps advancing on the palms', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(3, UP);
    expect(run.out.playing).toBe(true);
    expect(run.video.t).toBeGreaterThan(2.9);
  });

  it('lowering the palms puts the ad back on the TV, undimmed', () => {
    const run = createRun();
    run.toFirstAd();
    run.run(1, UP);
    const out = run.frame();
    expect(out.target).toBe('tv');
    expect(out.tvDim).toBe(false);
  });

  it('no effect in the finale', () => {
    const run = createRun();
    run.frame({ jumpTo: 4 });
    const out = run.run(2, UP);
    expect(out.finale).toBe(true);
    expect(out.target).toBe('tv');
    expect(out.tvDim).toBe(false);
  });

  it('no effect on the card or the content', () => {
    const run = createRun();
    expect(run.frame(UP).target).toBe('tv');
    const out = run.frame({ ...UP, selectStarted: true });
    expect(out.screen).toBe('content');
    expect(out.target).toBe('tv');
    expect(out.tvDim).toBe(false);
  });

  it('works on its own, through createAttention(lineup, rules)', () => {
    const run = createRun({ lineup: LINEUP, rules: [palms] });
    run.toFirstAd();
    expect(run.frame(UP).target).toBe('palms');
  });

  it('is in the rule list', () => {
    expect(RULES).toContain(palms);
  });
});
