// Keeps the picked YouTube video's sound (an <audio> on the page) with the
// mirrored picture (src/youtube-mirror.js): it plays only while the content
// screen shows the mirror and the remote player is really playing (not
// YouTube's own ad), and jumps to the player's time when they drift apart.

export const MAX_DRIFT = 0.2; // s: further apart than this, the sound jumps to the picture

// One frame's step. `live`: the content screen shows a playing mirror with
// sound ready. `target`: the remote player's time. `current`, `seeking`: the
// audio element's. Returns { play, seek }, seek being a time to jump to or null.
export function audioStep({ live, target, current, seeking }) {
  if (!live) return { play: false, seek: null };
  const off = Math.abs(current - target) > MAX_DRIFT;
  return { play: true, seek: off && !seeking ? target : null };
}
