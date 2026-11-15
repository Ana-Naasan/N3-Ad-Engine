// The card with a video picker on the TV: signals.pick decides when the
// viewer's video starts, and pinches (the picker's clicks) don't.
import { describe, it, expect } from 'vitest';
import { createRun, DT } from './helpers/frames.js';

describe('card with a picker (signals.pick)', () => {
  it('stays on the card through selects until the viewer picks a video', () => {
    const run = createRun();
    run.run(1, { pick: false });
    let out = run.frame({ pick: false, selectStarted: true });
    expect(out.screen).toBe('card');
    out = run.run(3, (elapsed) => ({ pick: false, selectStarted: elapsed === 1, selectHeld: elapsed }));
    expect(out.screen).toBe('card');
    expect(out.playing).toBe(false);
  });

  it('plays 8 s of content from the pick, then cuts to GLOOP', () => {
    const run = createRun();
    run.run(2, { pick: false });
    let out = run.frame({ pick: true });
    expect(out.screen).toBe('content');
    expect(out.playing).toBe(true);
    out = run.run(8 - DT, { pick: true });
    expect(out.screen).toBe('content');
    out = run.frame({ pick: true });
    expect(out.screen).toBe('ad1');
  });

  it('without a picker (pick null), a select still starts the content', () => {
    const run = createRun();
    expect(run.frame({ pick: null, selectStarted: true }).screen).toBe('content');
  });

  it('a pick left over from the last run does not start the next one', () => {
    const run = createRun();
    run.frame({ pick: true });
    while (!run.out.finale) run.frame({ jumpTo: run.out.finale ? null : 4 });
    // Restart: a select started in the finale and held 2 s goes back to the card.
    run.frame({ selectStarted: true });
    run.run(2.5, (elapsed) => ({ pick: false, selectHeld: elapsed }));
    expect(run.out.screen).toBe('card');
    expect(run.run(1, { pick: false }).screen).toBe('card');
  });
});
