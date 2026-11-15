// Client side of the dev-server session routes in vite.config.js.

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
