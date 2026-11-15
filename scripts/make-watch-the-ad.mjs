// Generates public/videos/watchTheAd.mp4, the clip the ?fakeout run cuts to.
// Picture: content.mp4 frozen on its frame at FAKEOUT_CONTENT_SECONDS, with a
// slow push-in. Sound: a voice that repeats "Watch the ad." The voice is in
// the clip so it plays from the headset.
// Needs macOS `say` (voice Daniel) and ffmpeg.
// Run: node scripts/make-watch-the-ad.mjs
// Run it again after changing content.mp4, FAKEOUT_CONTENT_SECONDS or
// WATCH_THE_AD_SECONDS.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FAKEOUT_CONTENT_SECONDS, WATCH_THE_AD_SECONDS,
} from '../src/attention/lineup-fakeout.js';

const FPS = 30;
const VOICE_LEAD = 0.2; // seconds of freeze before the voice starts
const VOICE_TAIL = 0.5; // the page cuts by wall clock and may clip the end
const ZOOM = 0.1; // the picture grows this much over the clip
// `say` speaks at full level and the placeholder tones peak near -36 dB, so
// turn the voice down: still clearly louder than the tones, but not a blast
// in a headset turned up for them. Set it nearer 0 once real videos are in.
const VOICE_GAIN_DB = -10;

const videos = path.join(import.meta.dirname, '../public/videos');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-the-ad-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const aiff = path.join(tmp, 'voice.aiff');
const clip = path.join(tmp, 'watchTheAd.mp4');

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });

// Speaks the line `repeats` times into the aiff. Returns the aiff's seconds.
// `say` ends the aiff with about 0.2 s of silence. It counts as voice here,
// which only makes the fit stricter.
function speak(repeats) {
  const text = Array(repeats).fill('Watch the ad.').join(' [[slnc 150]] ');
  run('say', ['-v', 'Daniel', '-o', aiff, text]);
  return Number(run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', aiff,
  ]));
}

// Fit as many repeats as the clip has room for.
const room = WATCH_THE_AD_SECONDS - VOICE_LEAD - VOICE_TAIL;
let repeats = 1;
while (speak(repeats + 1) <= room) repeats += 1;
const voiceSeconds = speak(repeats);
if (voiceSeconds > room) {
  console.error(
    `The voice takes ${voiceSeconds.toFixed(2)} s but a ${WATCH_THE_AD_SECONDS} s clip `
    + `has room for ${room.toFixed(2)} s. Raise WATCH_THE_AD_SECONDS.`,
  );
  process.exit(1);
}

// zoompan crops whole pixels, so a slow zoom on a still jitters. Zooming an 8x
// enlargement keeps the error to a quarter of a pixel. `on` counts from 1, so
// the first frame has no zoom and matches the content frame.
const frames = Math.ceil(WATCH_THE_AD_SECONDS * FPS);
const picture = [
  'trim=end_frame=1', // keep only the frame at FAKEOUT_CONTENT_SECONDS
  'scale=iw*8:-1:flags=neighbor',
  `zoompan=z='1+${ZOOM}*(on-1)/${frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2'`
    + `:d=${frames}:s=1280x720:fps=${FPS}`,
].join(',');

// Encode in the temp dir, so a failed run leaves the old clip alone.
run('ffmpeg', [
  '-loglevel', 'error', '-y',
  '-ss', String(FAKEOUT_CONTENT_SECONDS), '-i', path.join(videos, 'content.mp4'),
  '-i', aiff,
  '-filter_complex', `[0:v]${picture}[v];`
    + `[1:a]volume=${VOICE_GAIN_DB}dB,adelay=${VOICE_LEAD * 1000},apad[a]`, // adelay takes ms
  '-map', '[v]', '-map', '[a]', '-t', String(WATCH_THE_AD_SECONDS), '-r', String(FPS),
  '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '26',
  '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '1',
  '-movflags', '+faststart', clip,
]);
fs.copyFileSync(clip, path.join(videos, 'watchTheAd.mp4'));
console.log(
  `made public/videos/watchTheAd.mp4: "Watch the ad." x${repeats}, voice starts at `
  + `${VOICE_LEAD} s and is over by ${(VOICE_LEAD + voiceSeconds).toFixed(2)} s `
  + `of ${WATCH_THE_AD_SECONDS} s`,
);
