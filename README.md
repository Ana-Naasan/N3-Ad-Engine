# Unskippable VR

A WebXR page for Meta Quest 3: you sit in a cozy virtual living room, press Play,
and ads cut in that refuse to be skipped. The ads are real commercials: see
`public/videos/SOURCES.md` and `public/domain/SOURCES.md`.

## Run

```sh
npm install
npm run dev          # Vite on :5173, listening on the LAN
```

Open it on the Quest over HTTPS (WebXR requires it), e.g. through a Cloudflare tunnel
pointed at `http://localhost:5173`. Tap **Start** (allows the mic, unlocks video), then **Enter VR**.
On a Mac, Meta's Immersive Web Emulator works for logic testing.

`scripts/make-placeholders.sh` overwrites the videos in `public/videos/` with coloured
placeholder cards (needs ffmpeg and ImageMagick).

## YouTube on the TV

In dev, the TV opens on the real YouTube site and the viewer picks the video the ads interrupt.
A WebXR page can't draw YouTube's own player, so the dev server runs a headless Chrome
(`server/youtube-mirror.js`), sends its screen to the TV as frames and sends the viewer's
pointer back as mouse events. Chrome must be installed on the dev machine.

- Point a hand or controller at the TV. A pinch or trigger clicks, a held pinch moved up or
  down scrolls, and a thumbstick scrolls too. Only an XR session drives the mirror; add
  `?mirror` to the URL to drive it with the mouse on the flat page.
- The first ad cuts in after 8 s of real playback of the picked video, and the video comes
  back for 5 s between ads. Loading and YouTube's own ad don't count as playback.
- The picked video plays with sound: the mirror's Chrome is muted, so the dev server fetches
  the video's audio with `tools/yt-dlp_macos` (committed, see `tools/README.md`; elsewhere a
  `yt-dlp` on the PATH) into `logs/youtube-audio/`, and the page plays it in step with the
  picture. It starts a few seconds after the pick. Without yt-dlp the video plays silent and
  the server log says why. YouTube's own ad may play before the video, without sound.
- A featured video plays from its own file instead: put it at
  `public/videos/<YouTube id>.mp4`, where the id is the part after `v=` in its URL.
- During each ad the YouTube video pauses, and it carries on from the same spot afterwards.
- The TV opens on a search results page, because YouTube's home page is empty when signed
  out. Set `YT_START_URL` to open on another page, such as a playlist of the featured videos.
- Typing isn't supported, so the search box does nothing.
- Without the mirror (a production build, or no Chrome) the TV shows "Pinch to play" and
  plays `content.mp4`. In VR it first ignores pinches for up to 12 s while it waits for YouTube.

## Debugging the headset

In dev, the page posts status, events and errors to the dev server: see `logs/quest.jsonl`.
Add `?snap` to the URL for a rendered snapshot every 5 s in `logs/snaps/`.
