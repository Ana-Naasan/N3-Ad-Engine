// Makes the fake-out voice for one content video, public/videos/<id>.mp4:
//   public/voices/<id>.m4a   the voice saying "Don't skip the ad". The page
//                            plays it on a loop (src/features/fakeout-voice.js).
//   public/voices/<id>.json  { pauses: [[start, end], ...] }: the gaps in the
//                            video's sound, where the voice may cut in.
// For now the voice is the macOS `say` voice Daniel. It is a stand-in until the
// speaker's cloned voice replaces it.
// Needs macOS `say` and ffmpeg.
// Run: node scripts/make-voice.mjs [id]     (id defaults to "content")
// Run it again after the video changes.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LINE = "Oh. Don't skip the ad. [[slnc 350]] Don't skip the ad. [[slnc 350]] "
  + 'Watch the ad. [[slnc 350]] Watch the ad. [[slnc 600]]';
const PAUSE_BELOW_PEAK_DB = 30; // sound this far under the video's peak counts as a gap
const PAUSE_MIN_SECONDS = 0.25;
// The voice is set to the video's own average level, kept inside this range.
// The placeholder tones average about -40 dB, which would be too quiet.
const VOICE_MEAN_DB = [-32, -16];

const id = process.argv[2] ?? 'content';
const root = path.join(import.meta.dirname, '..');
const video = path.join(root, 'public/videos', `${id}.mp4`);
const voices = path.join(root, 'public/voices');
if (!fs.existsSync(video)) {
  console.error(`No video at ${video}`);
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'make-voice-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

// Runs an ffmpeg audio filter that only reports, and returns what it printed.
function measure(file, filter) {
  const args = ['-hide_banner', '-i', file, '-vn', '-af', filter, '-f', 'null', '-'];
  return spawnSync('ffmpeg', args, { encoding: 'utf8' }).stderr;
}
const number = (text, key) => Number(text.match(new RegExp(`${key}: (-?[\\d.]+)`))?.[1]);
const levels = (file) => {
  const text = measure(file, 'volumedetect');
  return { mean: number(text, 'mean_volume'), max: number(text, 'max_volume') };
};

// The gaps in the video's sound.
const videoLevels = levels(video);
const seconds = Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video,
], { encoding: 'utf8' }));
const threshold = videoLevels.max - PAUSE_BELOW_PEAK_DB;
const report = measure(video, `silencedetect=noise=${threshold}dB:d=${PAUSE_MIN_SECONDS}`);
const starts = [...report.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])));
const ends = [...report.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const round = (x) => Math.round(x * 100) / 100;
const pauses = starts.map((start, i) => [round(start), round(ends[i] ?? seconds)]);

// The voice, at the video's level.
const aiff = path.join(tmp, 'voice.aiff');
execFileSync('say', ['-v', 'Daniel', '-o', aiff, LINE]);
const target = Math.min(Math.max(videoLevels.mean, VOICE_MEAN_DB[0]), VOICE_MEAN_DB[1]);
const gain = target - levels(aiff).mean;
const m4a = path.join(tmp, 'voice.m4a');
execFileSync('ffmpeg', [
  '-loglevel', 'error', '-y', '-i', aiff, '-af', `volume=${gain.toFixed(1)}dB`,
  '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '1', m4a,
]);

fs.mkdirSync(voices, { recursive: true });
fs.copyFileSync(m4a, path.join(voices, `${id}.m4a`));
fs.writeFileSync(path.join(voices, `${id}.json`), `${JSON.stringify({ pauses })}\n`);
console.log(
  `made public/voices/${id}.m4a (${gain.toFixed(1)} dB, average ${target.toFixed(1)} dB) and `
  + `${id}.json with ${pauses.length} pauses`,
);
