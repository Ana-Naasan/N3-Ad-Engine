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

## Debugging the headset

In dev, the page posts status, events and errors to the dev server: see `logs/quest.jsonl`.
Add `?snap` to the URL for a rendered snapshot every 5 s in `logs/snaps/`.
