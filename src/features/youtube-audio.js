import { audioStep } from '../youtube-audio-sync.js';
import { rlog } from '../remote-log.js';

// The picked YouTube video's sound. The mirror's Chrome is muted, so the dev
// server fetches the video's audio (server/youtube-audio.js) and this plays it
// in step with the mirrored picture: only while the content screen shows the
// mirror, the run wants it playing and its player is playing, so it stops for
// our ads, the finale's pauses and YouTube's own ads, and picks up at the
// picture's time when the video comes back.
// Without that file (no yt-dlp on the dev machine) the video stays silent.

// A tenth of a second of silence (8 kHz, 8-bit mono WAV), to unlock the element.
function silence() {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + n, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, n, true);
  bytes.fill(128, 44);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

export default function youtubeAudio({ tv, picker }) {
  const audio = document.createElement('audio');
  audio.id = 'youtube-audio';
  audio.preload = 'auto';
  document.body.appendChild(audio); // no controls: not drawn
  let id = null; // the id whose sound is loaded
  let starting = false; // a play() is under way

  // Must run inside a user gesture, like tv.primeAll(): one silent play unlocks the element.
  document.getElementById('start')?.addEventListener('click', () => {
    audio.src = silence();
    audio.play().then(() => { if (!id) audio.pause(); }).catch(() => {});
  });

  return (output) => {
    const { mirror } = picker;
    if (mirror.audio && mirror.audio !== id) {
      id = mirror.audio;
      audio.src = `/api/youtube/audio/${id}.m4a`;
      rlog('youtube-audio', { id });
    }
    const live = Boolean(id && mirror.audio === id && output.playing && tv.showingLiveContent && mirror.available && mirror.playing);
    const step = audioStep({ live, target: mirror.time, current: audio.currentTime, seeking: audio.seeking });
    if (step.seek !== null) audio.currentTime = step.seek;
    if (step.play && audio.paused && !starting) {
      starting = true;
      audio.play().catch((e) => {
        if (e.name !== 'AbortError') console.warn('YouTube audio play failed', audio.src, e.name, e.message);
      }).finally(() => { starting = false; });
    } else if (!step.play && !audio.paused) audio.pause();
    return { debug: { ytAudio: id ? `${audio.paused ? 'paused' : 'playing'} at ${audio.currentTime.toFixed(2)}, picture ${mirror.time.toFixed(2)}` : null } };
  };
}
