# Unskippable VR

A WebXR page for Meta Quest 3: you sit in a cozy virtual living room, press Play,
and ads cut in that refuse to be skipped. Made-up brands only.

## Run

```sh
npm install
npm run dev          # Vite on :5173, listening on the LAN
```

Open it on the Quest over HTTPS (WebXR requires it), e.g. through a Cloudflare tunnel
pointed at `http://localhost:5173`. Tap **Start** (allows the mic, unlocks video), then **Enter VR**.
On a Mac, Meta's Immersive Web Emulator works for logic testing.

`scripts/make-placeholders.sh` regenerates the placeholder videos in `public/videos/`
(needs ffmpeg and ImageMagick).

## YouTube on the TV

In dev, the TV opens on the real YouTube site and the viewer picks the video the ads interrupt.
A WebXR page can't draw YouTube's own player, so the dev server runs a headless Chrome
(`server/youtube-mirror.js`), sends its screen to the TV as frames and sends the viewer's
pointer back as mouse events. Chrome must be installed on the dev machine.

- Point a hand or controller at the TV. A pinch or trigger clicks, a held pinch moved up or
  down scrolls, and a thumbstick scrolls too. On the flat page the mouse does the same.
- The ads cut in 1 s after the picked video starts.
- The mirror has no sound, and YouTube's own ad may play before the video.
- A featured video plays from its own file with sound instead: put it at
  `public/videos/<YouTube id>.mp4`, where the id is the part after `v=` in its URL.
- The TV opens on a search results page, because YouTube's home page is empty when signed
  out. Set `YT_START_URL` to open on another page, such as a playlist of the featured videos.
- Typing isn't supported, so the search box does nothing.
- Without the mirror (a production build, or no Chrome) the TV shows "Pinch to play" and
  plays `content.mp4`, as before.

## Debugging the headset

In dev, the page posts status, events and errors to the dev server: see `logs/quest.jsonl`.
Add `?snap` to the URL for a rendered snapshot every 5 s in `logs/snaps/`.
