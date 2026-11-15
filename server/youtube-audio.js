// The picked video's sound. The mirror's Chrome is muted and only its screen
// travels, so when it opens a video page the dev server fetches that video's
// audio track (AAC in m4a, which browsers play as is) with yt-dlp into the
// gitignored logs folder, and the page plays it in step with the mirror
// (src/features/youtube-audio.js).
//
// yt-dlp is tools/yt-dlp_macos (committed, see tools/README.md), else a
// yt-dlp on the PATH. It solves YouTube's JS challenge with the Node running
// this server, so nothing else needs installing. Without yt-dlp the video
// plays silent and the server says why once.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLED = fileURLToPath(new URL('../tools/yt-dlp_macos', import.meta.url));

export const validId = (id) => typeof id === 'string' && /^[\w-]{6,20}$/.test(id);

// The yt-dlp commands to try, in order.
export function ytDlpCommands(platform = process.platform, bundled = BUNDLED) {
  return platform === 'darwin' && fs.existsSync(bundled) ? [bundled, 'yt-dlp'] : ['yt-dlp'];
}

// Arguments for one video's audio, written to `file` (yt-dlp renames its .part on success).
export function ytDlpArgs(id, file, node = process.execPath) {
  return [
    '-f', 'bestaudio[ext=m4a]', '--no-playlist', '--no-progress', '--quiet', '--no-warnings',
    '--js-runtimes', `node:${node}`, '-o', file, '--', id,
  ];
}

// The mirrored player's time now, in seconds, from its last probe: it ran on while playing.
export function mirrorTime({ t = 0, at = 0, playing = false }, now) {
  return playing && at ? t + Math.max(0, now - at) / 1000 : t;
}

// Parses a `bytes=a-b` header for a file of `size` bytes: { start, end }, or null for the whole file.
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  return start <= end ? { start, end } : null;
}

export function createYoutubeAudio({ dir = 'logs/youtube-audio', commands = ytDlpCommands(), log = console.warn } = {}) {
  const jobs = new Map(); // id -> 'loading' | 'failed'
  let missing = false; // no yt-dlp anywhere: stop trying

  const fileFor = (id) => path.join(dir, `${id}.m4a`);

  function run(id, i) {
    const child = spawn(commands[i], ytDlpArgs(id, fileFor(id)), { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let spawnError = false;
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
    child.on('error', (e) => {
      spawnError = true;
      if (e.code === 'ENOENT' && i + 1 < commands.length) return run(id, i + 1);
      jobs.set(id, 'failed');
      if (e.code === 'ENOENT') {
        missing = true;
        log('YouTube audio: no yt-dlp (tools/yt-dlp_macos runs on macOS only; elsewhere put yt-dlp on the PATH), so picked videos play without sound.');
      } else log(`YouTube audio: could not run ${commands[i]}: ${e.message}`);
    });
    child.on('close', (code) => {
      if (spawnError) return; // handled above
      if (code === 0 && fs.existsSync(fileFor(id))) jobs.delete(id);
      else {
        jobs.set(id, 'failed');
        log(`YouTube audio: yt-dlp failed for ${id} (exit ${code}): ${stderr.trim().split('\n').pop() ?? ''}`);
      }
    });
  }

  return {
    // 'ready', 'loading', 'failed', or 'none' (not asked for).
    status(id) {
      if (!validId(id)) return 'none';
      if (fs.existsSync(fileFor(id))) return 'ready';
      return jobs.get(id) ?? 'none';
    },

    // Starts fetching the video's audio unless it is cached, under way or failed.
    want(id) {
      if (missing || this.status(id) !== 'none') return;
      fs.mkdirSync(dir, { recursive: true });
      jobs.set(id, 'loading');
      run(id, 0);
    },

    // Serves the cached file, with Range support so the page can seek. False if not ready.
    serve(id, req, res) {
      if (this.status(id) !== 'ready') return false;
      const file = fileFor(id);
      const { size } = fs.statSync(file);
      const range = parseRange(req.headers.range, size);
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-store');
      if (range) {
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
        res.setHeader('Content-Length', String(range.end - range.start + 1));
      } else res.setHeader('Content-Length', String(size));
      if (req.method === 'HEAD') return res.end(), true;
      fs.createReadStream(file, range ?? {}).pipe(res);
      return true;
    },
  };
}
