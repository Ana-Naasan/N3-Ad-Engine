import fs from 'node:fs';
import { defineConfig } from 'vite';

const MAX_BODY = 2 * 1024 * 1024; // the tunnel is public: cap uploads

function readBody(req, res, done) {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) req.destroy();
    else chunks.push(c);
  });
  req.on('end', () => {
    done(Buffer.concat(chunks));
    if (res.writableEnded) return; // the handler already answered
    res.statusCode = 204;
    res.end();
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// --- Session summaries for the KPI board (#11) ---
const SESSIONS_FILE = 'logs/sessions.jsonl';
const STAT_KEYS = ['adTime', 'videoTime', 'headTurns', 'chaseMetres', 'peakVolume']; // attention output `stats`

// Returns a clean session summary, or null if it doesn't match the contract.
function parseSession(value) {
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

const HISTORY_LENGTH = 20; // running totals kept for the board's sparklines

// Totals over the sessions file. Skips unreadable lines and key-jump test runs.
// `history` holds the running totals after each of the last HISTORY_LENGTH sessions, oldest first.
function sessionTotals() {
  const totals = { sessions: 0, adTime: 0, videoTime: 0, ratio: null, headTurns: 0, chaseMetres: 0 };
  const history = [];
  let text = '';
  try {
    text = fs.readFileSync(SESSIONS_FILE, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
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

// Dev-only endpoints the headset posts to (see src/remote-log.js).
function questLog() {
  return {
    name: 'quest-log',
    configureServer(server) {
      fs.mkdirSync('logs/snaps', { recursive: true });
      server.middlewares.use('/api/log', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readBody(req, res, (buf) => {
          try {
            const lines = JSON.parse(buf).map((e) => JSON.stringify(e)).join('\n');
            fs.appendFileSync('logs/quest.jsonl', lines + '\n');
          } catch {}
        });
      });
      server.middlewares.use('/api/snap', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readBody(req, res, (buf) => {
          const file = `logs/snaps/${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
          fs.writeFileSync(file, buf);
          fs.copyFileSync(file, 'logs/snaps/latest.jpg');
        });
      });
      server.middlewares.use('/api/sessions', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readBody(req, res, (buf) => {
          let session = null;
          try {
            session = parseSession(JSON.parse(buf));
          } catch {}
          if (!session) {
            sendJson(res, 400, { error: 'expected {stats: {' + STAT_KEYS.join(', ') + '}, timestamp, usedJump}' });
            return;
          }
          fs.appendFileSync(SESSIONS_FILE, JSON.stringify(session) + '\n');
        });
      });
      server.middlewares.use('/api/totals', (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          sendJson(res, 200, sessionTotals());
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [questLog()],
  server: {
    host: true, // listen on the LAN so the Cloudflare tunnel can reach it
    port: 5173,
    strictPort: true, // the tunnel route points at 5173; fail rather than drift
    allowedHosts: true, // accept the tunnel hostname (dev server holds no secrets)
    watch: { ignored: ['**/logs/**'] },
  },
});
