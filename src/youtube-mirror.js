import * as THREE from 'three';
import { rlog } from './remote-log.js';

// Client side of the YouTube mirror routes in vite.config.js: the real YouTube
// site, running in a Chrome on the dev machine, as a texture. Frames are
// fetched one at a time while the mirror is wanted and drawn to a canvas;
// clicks and scrolls go back as 0-1 screen coordinates.
// When the page stops wanting frames (an ad comes up), it tells the server to
// pause the remote video at once, and to play it again when it wants frames
// again, so the video carries on from where the ad cut in. The server's own
// idle pause (IDLE_MS) stays as the fallback for a headset that goes away.
// `available` is false until a frame of a loaded YouTube page has arrived, and
// again when the server stops answering or reports the page broken (a
// production build has no mirror), so callers can fall back to the card.

const WIDTH = 1024; // VIEW in server/youtube-mirror.js
const HEIGHT = 576;
const RETRY_MS = 3000; // wait this long after a failed request

export function createYoutubeMirror() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx2d = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  let wanted = false;
  let paused = false; // this client asked the server to pause the remote video
  let looping = false;
  let after = 0; // sequence number of the frame on the canvas
  let available = false;
  let playing = false;
  let local = null;
  let frames = 0;
  let ready = Promise.resolve(); // settles when the last reset has reached the server
  let resets = 0;
  let lastError = null; // logged once, not every retry

  async function fetchFrame() {
    const at = resets;
    const res = await fetch(`/api/youtube/frame?after=${after}`, { cache: 'no-store' });
    // Only the mirror route sends this header: a server without it answers with something else.
    if (!res.ok || !res.headers.has('x-yt-seq')) {
      throw new Error(`GET /api/youtube/frame: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
    if (res.status === 200) {
      const bitmap = await createImageBitmap(await res.blob());
      ctx2d.drawImage(bitmap, 0, 0, WIDTH, HEIGHT);
      bitmap.close();
      texture.needsUpdate = true;
      after = Number(res.headers.get('x-yt-seq'));
      frames++;
      if (!available) rlog('youtube-mirror', { available: true });
      available = true;
    }
    if (at !== resets || !wanted) return; // asked before a reset or a pause: its state is out of date
    playing = res.headers.get('x-yt-playing') === '1';
    local = res.headers.get('x-yt-local') || null;
  }

  async function loop() {
    looping = true;
    while (wanted) {
      try {
        await ready;
        await fetchFrame();
      } catch (e) {
        if (available || e.message !== lastError) rlog('youtube-mirror', { available: false, error: e.message });
        lastError = e.message;
        available = false;
        playing = false;
        local = null;
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
    }
    looping = false;
  }

  function send(event) {
    return fetch('/api/youtube/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {});
  }

  return {
    texture,

    get available() {
      return available;
    },

    // A video page's player has started (a pick from the mirror).
    get playing() {
      return playing;
    },

    // The YouTube id of a featured video the viewer opened (public/videos/<id>.mp4 exists), or null.
    get local() {
      return local;
    },

    get frames() {
      return frames;
    },

    // Fetch frames while wanted. Going from wanted to not, the remote video
    // pauses at once; wanted again, it plays on from there. A page that never
    // wants frames (a Mac tab without ?mirror) never sends either.
    setWanted(on) {
      if (wanted && !on) {
        paused = true;
        playing = false; // until the server reports it playing again
        send({ type: 'pause' });
      } else if (!wanted && on && paused) {
        paused = false;
        send({ type: 'play' });
      }
      wanted = on;
      if (wanted && !looping) loop();
    },

    move: (x, y) => send({ type: 'move', x, y }), // hover
    click: (x, y) => send({ type: 'click', x, y }),
    scroll: (x, y, dy) => send({ type: 'scroll', x, y, dy }),

    // Back to the start page, for a new run. Frames wait until the server has it.
    reset() {
      resets++;
      playing = false;
      local = null;
      ready = send({ type: 'reset' });
    },
  };
}
