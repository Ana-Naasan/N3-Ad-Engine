// Totals behind the KPI board: what GET /api/totals serves from logs/sessions.jsonl.
import { describe, it, expect } from 'vitest';
import { parseSession, sessionTotals } from '../server/session-totals.js';

const session = (stats, usedJump = false) => ({
  stats: { adTime: 40, videoTime: 1, headTurns: 3, chaseMetres: 2, peakVolume: 0.2, ...stats },
  timestamp: '2026-11-15T18:00:00.000Z',
  usedJump,
});
const file = (...lines) => lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n';

describe('session totals', () => {
  it('no sessions file text gives zero sessions and no ratio', () => {
    expect(sessionTotals('')).toEqual({
      sessions: 0, adTime: 0, videoTime: 0, ratio: null, headTurns: 0, chaseMetres: 0, history: [],
    });
  });

  it('adds up sessions, and leaves out key-jump runs', () => {
    const totals = sessionTotals(file(
      session({ adTime: 40, videoTime: 1, headTurns: 3, chaseMetres: 2 }),
      session({ adTime: 999, videoTime: 1, headTurns: 99, chaseMetres: 99 }, true),
      session({ adTime: 20, videoTime: 1, headTurns: 5, chaseMetres: 1.5 }),
    ));
    expect(totals).toMatchObject({ sessions: 2, adTime: 60, videoTime: 2, ratio: 30, headTurns: 8, chaseMetres: 3.5 });
    expect(totals.history).toEqual([
      { sessions: 1, ratio: 40, headTurns: 3, chaseMetres: 2 },
      { sessions: 2, ratio: 30, headTurns: 8, chaseMetres: 3.5 },
    ]);
  });

  it('skips unreadable and malformed lines instead of failing', () => {
    const totals = sessionTotals(file(
      'not json',
      '',
      '{"usedJump":false}',
      session({ headTurns: '3' }),
      session({ chaseMetres: -1 }),
      session({ adTime: 10, videoTime: 2 }),
      '{"stats":',
    ));
    expect(totals).toMatchObject({ sessions: 1, adTime: 10, videoTime: 2, ratio: 5 });
  });

  it('has no ratio while total video time is 0', () => {
    const totals = sessionTotals(file(session({ adTime: 30, videoTime: 0 })));
    expect(totals.sessions).toBe(1);
    expect(totals.ratio).toBeNull();
    expect(totals.history[0].ratio).toBeNull();
  });

  it('accepts only a full summary as a post body', () => {
    expect(parseSession(session({}))).toEqual(session({}));
    expect(parseSession({ ...session({}), usedJump: 'no' })).toBeNull();
    expect(parseSession({ ...session({}), timestamp: 'yesterday' })).toBeNull();
    expect(parseSession(session({ peakVolume: undefined }))).toBeNull();
    expect(parseSession(session({ headTurns: 1e308 }))).toBeNull(); // two of these would sum to Infinity
    expect(parseSession(null)).toBeNull();
  });
});
