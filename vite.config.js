import fs from 'node:fs';
import { defineConfig } from 'vite';
import { STAT_KEYS, parseSession, sessionTotals } from './server/session-totals.js';
import { createYoutubeMirror, parseInput } from './server/youtube-mirror.js';

const MAX_BODY = 2 * 1024 * 1024; // the tunnel is public: cap uploads
const FRAME_WAIT_MS = 2000; // how long a YouTube frame request waits for the screen to change

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

      // --- YouTube on the TV: see server/youtube-mirror.js. Chrome starts on the first request. ---
      const youtube = createYoutubeMirror();
      server.httpServer?.on('close', () => youtube.stop()); // also on a config restart
      // Long-poll: the next frame after ?after=<seq> as a JPEG, or 204 if the screen
      // didn't change or YouTube is still loading, or 503 if its page is broken. Headers say whether a video is playing and name a featured pick.
      server.middlewares.use('/api/youtube/frame', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const after = Number(new URL(req.url, 'http://localhost').searchParams.get('after')) || 0;
        try {
          const frame = await youtube.waitFrame(after, FRAME_WAIT_MS);
          const { status } = youtube;
          if (status === 'broken') throw new Error(`YouTube mirror: the page didn't load (${youtube.state.url || 'nothing yet'})`);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Yt-Playing', youtube.state.playing ? '1' : '0');
          res.setHeader('X-Yt-Local', youtube.state.local ?? '');
          res.setHeader('X-Yt-Seq', String(frame?.seq ?? after));
          if (!frame || status !== 'ready') {
            // Loading: no frame yet. Ask again after a probe rather than spin on loading frames.
            if (frame) await new Promise((resolve) => setTimeout(resolve, 250));
            res.statusCode = 204;
            res.end();
            return;
          }
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(frame.jpeg);
        } catch (e) {
          sendJson(res, 503, { error: e.message });
        }
      });
      // One pointer event: {type: 'move' | 'click', x, y}, {type: 'scroll', x, y, dy} or {type: 'reset'}.
      server.middlewares.use('/api/youtube/input', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readBody(req, res, (buf) => {
          let event = null;
          try {
            event = parseInput(JSON.parse(buf));
          } catch {}
          if (!event) {
            sendJson(res, 400, { error: 'expected {type: move|click|scroll|reset, x, y, dy}' });
            return;
          }
          youtube.input(event).catch((e) => console.warn('YouTube mirror input failed:', e.message));
        });
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
