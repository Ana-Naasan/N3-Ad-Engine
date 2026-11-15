import fs from 'node:fs';
import { defineConfig } from 'vite';
import { STAT_KEYS, parseSession, sessionTotals } from './server/session-totals.js';

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

function readSessionsFile() {
  try {
    return fs.readFileSync(SESSIONS_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return '';
    throw e;
  }
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
          try {
            fs.appendFileSync(SESSIONS_FILE, JSON.stringify(session) + '\n');
          } catch (e) {
            sendJson(res, 500, { error: e.message });
          }
        });
      });
      server.middlewares.use('/api/totals', (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          sendJson(res, 200, sessionTotals(readSessionsFile()));
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
