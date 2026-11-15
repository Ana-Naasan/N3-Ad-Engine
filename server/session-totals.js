// Session summaries for the KPI board: validation and totals. Pure: vite.config.js
// does the file reads and writes; test/session-totals.test.js covers this.

export const STAT_KEYS = ['adTime', 'videoTime', 'headTurns', 'chaseMetres', 'peakVolume']; // attention output `stats`
const HISTORY_LENGTH = 20; // running totals kept for the board's sparklines

// Returns a clean session summary, or null if it doesn't match the contract.
export function parseSession(value) {
  if (!value || typeof value !== 'object') return null;
  const { stats, timestamp, usedJump } = value;
  if (typeof usedJump !== 'boolean') return null;
  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) return null;
  if (!stats || typeof stats !== 'object') return null;
  const clean = {};
  for (const key of STAT_KEYS) {
    const n = stats[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
    clean[key] = n;
  }
  return { timestamp, usedJump, stats: clean };
}

// Totals over the sessions file's text (one JSON summary per line). Skips
// unreadable lines and key-jump test runs. `history` holds the running totals
// after each of the last HISTORY_LENGTH sessions, oldest first.
export function sessionTotals(text) {
  const totals = { sessions: 0, adTime: 0, videoTime: 0, ratio: null, headTurns: 0, chaseMetres: 0 };
  const history = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let session;
    try {
      session = parseSession(JSON.parse(line));
    } catch {
      continue;
    }
    if (!session || session.usedJump) continue;
    totals.sessions++;
    totals.adTime += session.stats.adTime;
    totals.videoTime += session.stats.videoTime;
    totals.headTurns += session.stats.headTurns;
    totals.chaseMetres += session.stats.chaseMetres;
    totals.ratio = totals.videoTime > 0 ? totals.adTime / totals.videoTime : null;
    const { sessions, ratio, headTurns, chaseMetres } = totals;
    history.push({ sessions, ratio, headTurns, chaseMetres });
    if (history.length > HISTORY_LENGTH) history.shift();
  }
  return { ...totals, history };
}
