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
    res.statusCode = 204;
    res.end();
  });
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
