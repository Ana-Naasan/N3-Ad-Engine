import { describe, expect, it } from 'vitest';
import { MAX_DRIFT, audioStep } from '../src/youtube-audio-sync.js';
import { mirrorTime, parseRange, validId, ytDlpArgs, ytDlpCommands } from '../server/youtube-audio.js';

describe('audioStep: the sound follows the mirrored picture', () => {
  it('stays paused unless the mirror is live', () => {
    expect(audioStep({ live: false, target: 12, current: 3, seeking: false })).toEqual({ play: false, seek: null });
  });

  it('plays without a jump while close to the picture', () => {
    expect(audioStep({ live: true, target: 10, current: 10 + MAX_DRIFT * 0.9, seeking: false })).toEqual({ play: true, seek: null });
  });

  it('jumps to the picture when it drifts, e.g. after an ad', () => {
    expect(audioStep({ live: true, target: 42.5, current: 30, seeking: false })).toEqual({ play: true, seek: 42.5 });
    expect(audioStep({ live: true, target: 10, current: 10.3, seeking: false }).seek).toBe(10);
  });

  it('waits for a jump under way before another', () => {
    expect(audioStep({ live: true, target: 43, current: 42.5, seeking: true })).toEqual({ play: true, seek: null });
  });

  it('keeps under 0.3 s apart', () => {
    expect(MAX_DRIFT).toBeLessThan(0.3);
  });
});

describe('mirrorTime: the remote player runs on between probes', () => {
  it('adds the time since the probe while playing', () => {
    expect(mirrorTime({ t: 10, at: 1000, playing: true }, 1250)).toBeCloseTo(10.25);
  });

  it('holds still while paused or before any probe', () => {
    expect(mirrorTime({ t: 10, at: 1000, playing: false }, 5000)).toBe(10);
    expect(mirrorTime({ url: '', playing: false }, 5000)).toBe(0);
  });
});

describe('server/youtube-audio.js', () => {
  it('uses the committed yt-dlp first on macOS, else the PATH', () => {
    expect(ytDlpCommands('darwin', 'package.json')).toEqual(['package.json', 'yt-dlp']);
    expect(ytDlpCommands('linux', 'package.json')).toEqual(['yt-dlp']);
    expect(ytDlpCommands('darwin', 'no/such/file')).toEqual(['yt-dlp']);
  });

  it('asks yt-dlp for m4a audio only, solved with this Node', () => {
    const args = ytDlpArgs('dQw4w9WgXcQ', 'logs/youtube-audio/dQw4w9WgXcQ.m4a', '/usr/bin/node');
    expect(args.join(' ')).toContain('-f bestaudio[ext=m4a]');
    expect(args.join(' ')).toContain('--js-runtimes node:/usr/bin/node');
    expect(args.slice(-3)).toEqual(['logs/youtube-audio/dQw4w9WgXcQ.m4a', '--', 'dQw4w9WgXcQ']);
  });

  it('only takes YouTube-shaped ids', () => {
    expect(validId('dQw4w9WgXcQ')).toBe(true);
    expect(validId('../../etc')).toBe(false);
    expect(validId('-rf')).toBe(false);
    expect(validId(null)).toBe(false);
  });

  it('parses Range headers', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange(undefined, 1000)).toBe(null);
    expect(parseRange('bytes=2000-', 1000)).toBe(null);
  });
});
