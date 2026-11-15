// Client side of the dev-server session routes in vite.config.js.

const postedListeners = new Set();

// Calls fn after each session post settles, so readers can refetch totals.
export function onSessionPosted(fn) {
  postedListeners.add(fn);
}

// Posts one session summary: { stats, timestamp, usedJump }. Throws if the server refuses it.
export async function postSession(summary) {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(summary),
    });
    if (!res.ok) throw new Error(`POST /api/sessions: HTTP ${res.status} ${await res.text()}`);
  } finally {
    for (const fn of postedListeners) fn();
  }
}

// Totals over logged sessions, key-jump runs left out:
// { sessions, adTime, videoTime, ratio (ad / video, null when no video time), headTurns, chaseMetres }.
// Throws when the server is unreachable or answers with something else.
export async function fetchTotals() {
  const res = await fetch('/api/totals', { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/totals: HTTP ${res.status}`);
  const totals = await res.json();
  for (const key of ['sessions', 'headTurns', 'chaseMetres']) {
    if (typeof totals?.[key] !== 'number') throw new Error(`GET /api/totals: no number for ${key}`);
  }
  if (totals.ratio !== null && typeof totals.ratio !== 'number') throw new Error('GET /api/totals: bad ratio');
  return totals;
}
