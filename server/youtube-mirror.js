// The real YouTube site in a headless Chrome on this machine, mirrored to the TV.
// A WebXR page can't draw YouTube's own player (a cross-origin iframe), so the
// dev server runs the browser instead: Chrome's screen comes out as JPEG frames
// (DevTools screencast) and the viewer's pointer goes back in as mouse events.
// Chrome starts on first use and keeps its profile in the gitignored logs folder.
// Nothing is downloaded and YouTube's own ads are left alone.
//
// The mirror has no sound. A featured video, one with a prepared file at
// public/videos/<YouTube id>.mp4, is reported as `local` so the page plays
// that file through its own <video> instead.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Signed out, YouTube's home page is empty ("Try searching to get started"),
// so the TV opens on search results for the video the viewer came to watch.
export const START_URL = process.env.YT_START_URL
  ?? 'https://www.youtube.com/results?search_query=how+to+build+a+hackathon+project+in+6+hours';
// The remote page, in CSS px. Frames come out this size: about one pixel per
// Quest 3 display pixel on the 1.6 m screen, and big enough targets for a hand ray.
export const VIEW = { width: 1024, height: 576 };
const PROBE_MS = 250; // how often the page is asked what it is doing
const IDLE_MS = 3000; // no frame request for this long: pause the remote video
const START_TIMEOUT_MS = 15000;
const MAX_WHEEL = 2000; // px per scroll event

// What the page is doing: the video page it is on (`videoId`, or null) and
// whether that page's player has started (`playing`).
const PROBE = `(() => {
  const shorts = location.pathname.match(/^\\/shorts\\/([^/?]+)/);
  const videoId = location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : shorts ? shorts[1] : null;
  const playing = Boolean(videoId) && [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0.1);
  return { url: location.href, videoId, playing };
})()`;
const PAUSE = `document.querySelectorAll('video').forEach((v) => v.pause())`;
const PLAY = `(document.querySelector('video.html5-main-video') ?? document.querySelector('video'))?.play()`;
const IDLE_STATE = { url: '', videoId: null, playing: false, local: null };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// The tunnel is public, so the browser stays on YouTube: no typing reaches it,
// and a click that leaves the site is sent back to the start page.
function allowedUrl(url) {
  if (!url || url.startsWith('about:') || url.startsWith('chrome-error:')) return true;
  try {
    const { hostname } = new URL(url);
    return hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

// Returns a pointer event in the shape `input` takes, or null if `raw` isn't one.
// x and y are 0-1 across the screen from its top-left corner; dy is remote px.
export function parseInput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'reset') return { type: 'reset' };
  if (!['move', 'click', 'scroll'].includes(raw.type)) return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
  const event = { type: raw.type, x: clamp(raw.x, 0, 1), y: clamp(raw.y, 0, 1) };
  if (raw.type === 'scroll') {
    if (!Number.isFinite(raw.dy)) return null;
    event.dy = clamp(raw.dy, -MAX_WHEEL, MAX_WHEEL);
  }
  return event;
}

// The id, if public/videos/<id>.mp4 exists (a featured video), else null.
function localVideo(videosDir, id) {
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  return fs.existsSync(path.join(videosDir, `${id}.mp4`)) ? id : null;
}

export function createYoutubeMirror({ profileDir = 'logs/youtube-profile', videosDir = 'public/videos' } = {}) {
  let starting = null; // the launch promise, once anything has asked for the mirror
  let chrome = null; // the process, when this server started it
  let ws = null;
  let port = null;
  let pageId = null;
  let nextId = 0;
  const pending = new Map(); // CDP call id -> { resolve, reject }
  let frame = null; // latest { seq, jpeg }
  let waiters = []; // long-polls waiting for a newer frame
  let state = IDLE_STATE;
  let idlePaused = false; // this module paused the remote player because nothing was watching
  let epoch = 0; // bumped by a reset, so a probe that straddles it is dropped
  let lastWanted = 0;
  let probeTimer = null;
  let probes = 0;

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('YouTube mirror: Chrome is not connected'));
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const { result } = await send('Runtime.evaluate', { expression, returnByValue: true });
    return result?.value;
  }

  function onMessage(message) {
    const msg = JSON.parse(message.data);
    if (msg.id) {
      const call = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) call?.reject(new Error(`${msg.error.message}`));
      else call?.resolve(msg.result);
      return;
    }
    if (msg.method !== 'Page.screencastFrame') return;
    send('Page.screencastFrameAck', { sessionId: msg.params.sessionId }).catch(() => {});
    // Wall-clock sequence numbers, so they keep rising across a Chrome or server restart.
    frame = { seq: Math.max(Date.now(), (frame?.seq ?? 0) + 1), jpeg: Buffer.from(msg.params.data, 'base64') };
    for (const wake of waiters.splice(0)) wake(frame);
  }

  function dropConnection() {
    clearInterval(probeTimer);
    probeTimer = null;
    for (const { reject } of pending.values()) reject(new Error('YouTube mirror: Chrome went away'));
    pending.clear();
    ws = null;
    starting = null; // the next request starts again
    state = IDLE_STATE;
  }

  async function findPage() {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return targets.filter((t) => t.type === 'page');
  }

  // The port of a Chrome already running on this profile (left by an earlier
  // dev server), or null. Chrome writes it to DevToolsActivePort on start.
  async function runningPort(portFile) {
    try {
      const candidate = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
      await fetch(`http://127.0.0.1:${candidate}/json/version`);
      return candidate;
    } catch {
      return null;
    }
  }

  async function launch() {
    fs.mkdirSync(profileDir, { recursive: true });
    const portFile = path.join(profileDir, 'DevToolsActivePort');
    port = await runningPort(portFile);
    if (!port) {
      fs.rmSync(portFile, { force: true });
      const spawned = spawn(CHROME, [
        '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.resolve(profileDir)}`,
        '--mute-audio', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required', 'about:blank',
      ], { stdio: 'ignore' });
      chrome = spawned;
      let spawnError = null;
      spawned.on('error', (e) => { spawnError = e; });
      spawned.on('exit', () => { if (chrome === spawned) chrome = null; });
      const deadline = Date.now() + START_TIMEOUT_MS;
      while (!(port = await runningPort(portFile))) {
        if (spawnError) throw new Error(`YouTube mirror: could not start Chrome at ${CHROME}: ${spawnError.message}`);
        if (Date.now() > deadline) throw new Error('YouTube mirror: Chrome did not open its DevTools port');
        await sleep(100);
      }
    }

    const page = (await findPage())[0];
    if (!page) throw new Error('YouTube mirror: Chrome has no page to drive');
    pageId = page.id;
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error('YouTube mirror: could not connect to Chrome'));
    });
    ws = socket;
    socket.onmessage = onMessage;
    socket.onclose = () => { if (ws === socket) dropConnection(); };

    await send('Page.enable');
    // Headless Chrome names itself in the user agent, and sites may treat that as a bot.
    const { userAgent } = await send('Browser.getVersion');
    await send('Network.setUserAgentOverride', { userAgent: userAgent.replace('HeadlessChrome', 'Chrome') });
    await send('Emulation.setDeviceMetricsOverride', {
      width: VIEW.width, height: VIEW.height, deviceScaleFactor: 1, mobile: false,
    });
    await send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 });
    await send('Page.navigate', { url: START_URL });
    probeTimer = setInterval(() => probe().catch(() => {}), PROBE_MS);
  }

  async function probe() {
    const at = epoch;
    const seen = await evaluate(PROBE);
    if (!seen || at !== epoch) return;
    state = { ...seen, local: localVideo(videosDir, seen.videoId) };
    if (!allowedUrl(seen.url)) await reset();
    else if (seen.playing && state.local) await evaluate(PAUSE); // the page plays its own file instead
    else if (seen.playing && Date.now() - lastWanted > IDLE_MS) {
      await evaluate(PAUSE);
      idlePaused = true;
    }
    // Links that open a new tab (ads, mostly) would pile up unseen: close them.
    if (++probes % 8 === 0) {
      for (const extra of (await findPage()).filter((t) => t.id !== pageId)) {
        await fetch(`http://127.0.0.1:${port}/json/close/${extra.id}`).catch(() => {});
      }
    }
  }

  async function reset() {
    epoch++;
    state = IDLE_STATE;
    idlePaused = false;
    await send('Page.navigate', { url: START_URL });
  }

  function ensureStarted() {
    starting ??= launch().catch((e) => {
      starting = null;
      throw e;
    });
    return starting;
  }

  return {
    get state() {
      return state;
    },

    // The newest frame if it is newer than `after`, else the next one, else
    // null after `timeoutMs`. Rejects if Chrome can't be started.
    async waitFrame(after, timeoutMs) {
      lastWanted = Date.now();
      await ensureStarted();
      if (idlePaused) { // someone is watching again: carry on where the video stopped
        idlePaused = false;
        evaluate(PLAY).catch(() => {});
      }
      if (frame && frame.seq > after) return frame;
      return new Promise((resolve) => {
        const wake = (f) => {
          clearTimeout(timer);
          resolve(f);
        };
        const timer = setTimeout(() => {
          waiters = waiters.filter((w) => w !== wake);
          resolve(null);
        }, timeoutMs);
        waiters.push(wake);
      });
    },

    // One pointer event from parseInput.
    async input(event) {
      await ensureStarted();
      if (event.type === 'reset') return reset();
      const x = event.x * VIEW.width;
      const y = event.y * VIEW.height;
      if (event.type === 'scroll') {
        return send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: event.dy });
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      if (event.type === 'move') return; // hover only
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    },

    stop() {
      clearInterval(probeTimer);
      ws?.close();
      chrome?.kill();
    },
  };
}
