// The YouTube mirror's client pauses the remote video the moment the page stops
// watching it (an ad comes up) and plays it on from there when it watches again,
// instead of leaving it to the server's 3 s idle pause. The server's half (the
// hold in server/youtube-mirror.js) needs Chrome, so only its input parsing is here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseInput } from '../server/youtube-mirror.js';

vi.mock('../src/remote-log.js', () => ({ rlog: () => {} }));

let posts; // bodies POSTed to /api/youtube/input
let frameReplies; // queued replies to GET /api/youtube/frame; empty: the long-poll stays open

beforeEach(() => {
  posts = [];
  frameReplies = [];
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) });
  vi.stubGlobal('fetch', async (url, opts) => {
    if (opts?.method === 'POST') {
      posts.push(JSON.parse(opts.body));
      return new Response(null, { status: 204 });
    }
    return frameReplies.shift() ?? new Promise(() => {});
  });
});

const mirrorClient = async () => (await import('../src/youtube-mirror.js')).createYoutubeMirror();

describe('YouTube mirror pause during ads', () => {
  it('pauses the remote video the moment frames stop being wanted, and plays it again when they are', async () => {
    const mirror = await mirrorClient();
    mirror.setWanted(true); // the viewer's video shows
    mirror.setWanted(true);
    expect(posts).toEqual([]);
    mirror.setWanted(false); // an ad comes up
    mirror.setWanted(false);
    expect(posts).toEqual([{ type: 'pause' }]);
    mirror.setWanted(true); // the video comes back
    expect(posts).toEqual([{ type: 'pause' }, { type: 'play' }]);
  });

  it('a page that never wants frames (a Mac tab) never pauses or plays the shared video', async () => {
    const mirror = await mirrorClient();
    for (let i = 0; i < 5; i++) mirror.setWanted(false);
    expect(posts).toEqual([]);
  });

  it('stops reporting the video as playing once it pauses it', async () => {
    const mirror = await mirrorClient();
    frameReplies.push(new Response(null, { status: 204, headers: { 'x-yt-seq': '1', 'x-yt-playing': '1' } }));
    mirror.setWanted(true);
    await vi.waitFor(() => expect(mirror.playing).toBe(true));
    mirror.setWanted(false);
    expect(mirror.playing).toBe(false);
  });

  it('the server takes pause and play as events', () => {
    expect(parseInput({ type: 'pause' })).toEqual({ type: 'pause' });
    expect(parseInput({ type: 'play', x: 3 })).toEqual({ type: 'play' });
  });
});
