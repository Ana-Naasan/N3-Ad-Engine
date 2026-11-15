# Quest VR without the Unity editor

Researched 2026-11-15, about 11:40 to 11:55 EST. Versions come from the npm registry and GitHub releases, read today. Time estimates are mine and no source backs them.

## Recommendation

Use Meta's Immersive Web SDK (IWSDK) 1.1.0 in the Quest Browser, and deploy the static build to Vercel.

Reasons:

- One scaffold command gives controller grab, hand-pinch grab, Havok physics, and a desktop XR emulator. No GUI editor is needed. https://iwsdk.dev/guides/01-project-setup
- It ships tooling for coding agents. `npx @iwsdk/cli adapter sync --tools claude` writes `.mcp.json`, and the agent can then take screenshots and drive emulated controllers. https://github.com/facebook/immersive-web-sdk/blob/main/docs/ai/getting-started.md
- The deploy is a URL. No APK, no sideloading, no Android SDK. https://github.com/facebook/immersive-web-sdk/blob/main/docs/guides/08a-web-hosting.md
- It is plain three.js underneath (`three` aliased to `super-three@0.185.0`), so any three.js code still works. https://www.npmjs.com/package/@iwsdk/core

Main risk: IWSDK 1.x is new. npm shows `@iwsdk/core` 1.1.0 modified on 2026-11-14 and the repo has 352 stars. The coding agent's built-in knowledge of the API is probably wrong, so it must read the docs in the repo or install `@iwsdk/reference`. I also did not confirm how a held object collides with a dynamic target (see "Could not verify").

Fallback if IWSDK fights back in the first 30 minutes: React Three Fiber 9.8.2 with `@react-three/xr` 6.6.32, `@react-three/handle` 6.6.32 and `@react-three/rapier` 2.2.0. https://www.npmjs.com/package/@react-three/xr

Scope advice for a 4-hour build: do the hit test by hand first (distance from blade to target plus a speed threshold) and add physics only if time remains. Treat multiplayer as a stretch goal after the single-player sabotage loop works.

## First three steps to a grabbable sword

1. Scaffold. Run `npm create @iwsdk@latest`. Answer TypeScript, Virtual Reality, hand tracking Optional, grabbing Yes, physics Yes, install dependencies Yes. The prompts are interactive, so Bader may need to run this one himself. https://iwsdk.dev/guides/01-project-setup
2. Add the sword in `src/index.ts`. Confirm `features: { grabbing: true }` is in `World.create(...)`, then:
   ```ts
   const sword = new Mesh(new BoxGeometry(0.05, 0.9, 0.02), new MeshStandardMaterial({ color: 0xcccccc }));
   sword.position.set(0, 1.2, -0.5);
   world.createTransformEntity(sword)
     .addComponent(RayInteractable)
     .addComponent(OneHandGrabbable, { translate: true, rotate: true });
   ```
   The component calls come from https://github.com/facebook/immersive-web-sdk/blob/main/docs/guides/06-built-in-interactions.md. The mesh lines are standard three.js and I did not run them.
3. Run `npm run dev`, then `npx @iwsdk/cli dev status` to get the URL. Open the Network URL in the Quest Browser, accept the self-signed certificate warning, and press "Enter XR". https://iwsdk.dev/guides/02-testing-experience

If venue WiFi blocks laptop-to-headset traffic, connect USB and run `adb reverse tcp:<port> tcp:<port>`, then open `https://localhost:<port>` on the headset. This needs Developer Mode on the headset. https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/

## 1. Options without the Unity editor

| Option | Version today | All code? | Deploy | Zero to headset (estimate) | Notes |
|---|---|---|---|---|---|
| IWSDK | 1.1.0, npm modified 2026-11-14, repo pushed 2026-11-13 | Yes | URL | 15 to 30 min | Grab, locomotion, Havok, emulator, agent tools included. https://github.com/facebook/immersive-web-sdk |
| three.js | 0.187.0, npm modified 2026-10-30 | Yes | URL | 20 to 40 min | Ships `webxr_xr_dragging`, `webxr_vr_handinput_cubes`, `webxr_vr_video` examples. You write grab logic yourself. https://github.com/mrdoob/three.js/tree/dev/examples |
| R3F + @react-three/xr | fiber 9.8.2, xr 6.6.32, repo pushed 2026-10-15 | Yes | URL | 20 to 40 min | `<Handle>` for grabbing. https://pmndrs.github.io/xr/docs/handles/introduction |
| A-Frame | 1.8.0, npm modified 2026-06-23 | Yes, HTML tags | URL | 15 to 30 min | Grab components not checked today. https://www.npmjs.com/package/aframe |
| Babylon.js | 9.36.0, npm modified 2026-11-12 | Yes | URL | 30 to 60 min | Havok plugin 1.3.14. Held-object collisions need workarounds (see section 2). https://www.npmjs.com/package/@babylonjs/core |
| PlayCanvas engine | 2.24.1, npm modified 2026-11-14 | Engine yes, its editor is a web GUI | URL | not estimated | Not researched past the version. https://www.npmjs.com/package/playcanvas |
| Godot + OpenXR | Godot 4.7.2-stable (2026-08-18), OpenXR vendors plugin 5.2.0 (2026-11-10) | Mostly, but export setup is easier in the editor | APK sideload | 1.5 to 3 h on this Mac | Godot and the Android SDK are not installed here. https://github.com/godotengine/godot/releases |
| Meta Spatial SDK | version not found, samples repo pushed 2026-11-03 | Yes, Kotlin | APK sideload | 2 h or more | Needs Android Studio and SDK, neither installed. https://github.com/meta-quest/Meta-Spatial-SDK-Samples |
| Unreal | not researched | No | APK sideload | too long | Ruled out on install size alone, which is my judgment. |
| Needle Engine | 6.0.0-alpha.7, npm modified 2026-11-14 | not checked | URL | not estimated | Alpha release. https://www.npmjs.com/package/@needle-tools/engine |
| Wonderland Engine | @wonderlandengine/api 1.6.1, npm modified 2026-04-23 | No, has its own editor | URL | not estimated | https://www.npmjs.com/package/@wonderlandengine/api |

## 2. The WebXR route

### Grabbing and swinging

IWSDK needs the least code. Set `features: { grabbing: true }` and add `OneHandGrabbable` to an entity. Controllers and hands appear without extra setup, and a hand pinch grabs by default. https://github.com/facebook/immersive-web-sdk/blob/main/docs/guides/06-built-in-interactions.md

In R3F the equivalent is `<Handle>` and `<HandleTarget>` from `@react-three/handle`, or pointer capture in `onPointerDown`. https://pmndrs.github.io/xr/docs/tutorials/interactions

### Physics

- Havok in IWSDK. The physics guide has an "Interactive Grabbable Objects" section that adds `PhysicsBody`, `PhysicsShape` and `OneHandGrabbable` to one entity. The repo has `examples/grab` and `examples/physics`. https://github.com/facebook/immersive-web-sdk/blob/main/docs/guides/12-physics.md
- Rapier. `@dimforge/rapier3d-compat` 0.21.0 (2026-09-25) and `@react-three/rapier` 2.2.0 (2026-08-07). https://www.npmjs.com/package/@react-three/rapier
- cannon-es. 0.20.0, last published 2022-08-12. Avoid it. https://www.npmjs.com/package/cannon-es
- Havok in Babylon. A forum answer says a mesh parented to the controller needs an ANIMATED body with TELEPORT prestep to register contacts. Another thread reports fast swings tunnelling through targets. Both are forum posts and roughly two years old. https://forum.babylonjs.com/t/webxr-controller-collision-detection-with-havok/55443 and https://forum.babylonjs.com/t/continuous-collision-detection-with-havok/49458

### Multiplayer

Playroom Kit is the fastest candidate. Its docs say it works "without running your own backend", and they list React Three Fiber and Three.js as supported. `insertCoin({ skipLobby: true, maxPlayersPerRoom: 2 })` starts a session. Version 0.0.97, npm modified 2026-07-06. https://docs.joinplayroom.com/ and https://docs.joinplayroom.com/api-reference/js/insertCoin

Caveat: an error page titled "No gameId provided in the insertCoin function" suggests a game ID, and so an account, is required. The docs claim a "generous free tier" with no numbers.

Others, versions only:

- Colyseus 0.18.12 (2026-11-07). You host the server yourself. https://www.npmjs.com/package/colyseus
- PartyKit 0.0.115 (2026-10-09), partyserver 0.5.10. https://www.npmjs.com/package/partykit
- Multisynq client 1.1.0, last modified 2025-07-24. Croquet 2.0.4 (2026-02-17). https://www.npmjs.com/package/@multisynq/client
- networked-aframe 0.14.3 (2026-03-30). A-Frame only. https://github.com/networked-aframe/networked-aframe
- Trystero 0.27.0 (2026-11-11) and PeerJS 1.5.5 (2025-06-07) for WebRTC. https://www.npmjs.com/package/trystero

### HTTPS and deploy

- WebXR requires HTTPS. The IWSDK dev server serves HTTPS with a self-signed certificate. https://iwsdk.dev/guides/02-testing-experience
- Quickest deploy that the IWSDK docs walk through: `npx vercel@latest deploy --prod --yes`. It needs a Vercel login (`npx vercel@latest whoami`). GitHub Pages is the other documented option. https://github.com/facebook/immersive-web-sdk/blob/main/docs/guides/08a-web-hosting.md
- Tunnel: `cloudflared tunnel --url http://localhost:8080` needs no account and gives a `trycloudflare.com` URL. Limits are 200 in-flight requests, no Server-Sent Events, no uptime guarantee. cloudflared is not installed on this Mac. https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- Port: one IWSDK page says 8081 and another says 5173. Trust `npx @iwsdk/cli dev status`.

### Testing on the Mac

IWER is built into the IWSDK dev plugin and activates on localhost. Left mouse is trigger, right mouse is grip, and Left Shift with W/A/S/D moves the headset. It does not emulate WebXR Layers. iwer 2.8.0, npm modified 2026-11-04. https://iwsdk.dev/guides/02-testing-experience

The old Immersive Web Emulator Chrome extension is archived. Its last release was v1.3.0 on 2023-06-12. https://github.com/meta-quest/immersive-web-emulator

### Casting and recording for the stage

Use a USB-C cable and scrcpy, then put the scrcpy window on the projector. scrcpy 4.1 and OBS are both installed on this Mac. A cable avoids venue WiFi. The latest scrcpy is v5.0.1. https://github.com/Genymobile/scrcpy/releases

Wireless options and how they fail:

- Browser casting at horizon.meta.com/casting or oculus.com/casting needs the same Meta account and the same WiFi network on both devices. It fails on networks that block device-to-device traffic, such as corporate and hotel WiFi. An on-headset recording in progress also blocks casting. These points come from third-party guides. https://www.metaversewatcher.io/how-to-cast-meta-quest-3-tv-phone-pc-guide/
- Meta Quest Developer Hub has casting and a record button. It is not installed here. https://developers.meta.com/vr/documentation/unity/ts-mqdh-media/

Record a clean run before 17:00 as the backup. The rules accept a video.

## 3. AI calls, streams and video inside an immersive session

- The Quest Browser is Chromium-based. The latest release is Browser 154.1 on 2026-10-30. https://developers.meta.com/horizon/release-notes/web/
- `fetch`, WebSocket and WebRTC are standard Chromium features. I found no Meta page that lists limits on them during an immersive session.
- CORS applies as on any page. An API key in page code is visible to anyone, so route AI calls through a small serverless function on the same host.
- Video as a texture works. three.js ships `webxr_vr_video`, and IWSDK's camera system turns a `MediaStream` into a three.js `VideoTexture` in XR worlds. https://github.com/mrdoob/three.js/tree/dev/examples and https://github.com/facebook/immersive-web-sdk/blob/main/docs/guides/13-camera-access.md
- Passthrough is available through an `immersive-ar` session, but Meta's page says "There is no way to get to the pixels of the passthrough content". https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/
- IWSDK's camera guide (updated 2026-09-05) says a headset's passthrough view "is not automatically available as a browser camera". Same camera-access URL as above.
- Camera access needs a secure context and a user permission prompt. Same URL.

## 4. Local machine

| Tool | Status |
|---|---|
| node | v26.0.0 at /opt/homebrew/bin/node. IWSDK needs 20.19.0 or higher. |
| npm | 11.12.1 |
| pnpm | 11.1.2 |
| bun | not installed |
| adb | 1.0.41, platform-tools 37.0.1-15733141, at /opt/homebrew/bin/adb |
| Meta Quest Developer Hub | not in /Applications |
| Godot | not installed |
| Android SDK | none. ANDROID_HOME is unset, ~/Library/Android/sdk is missing, no sdkmanager. |
| Also present | scrcpy 4.1, OBS.app, Xcode.app, gh 2.93.0, OpenJDK 25.0.2 |
| Also missing | cloudflared, ngrok |

## Could not verify

- Whether a sword held with `OneHandGrabbable` pushes or registers hits on a dynamic Havok body in IWSDK. I read the guide's headings and snippets, not the example code, and ran nothing.
- Whether `npm create @iwsdk@latest` accepts flags that skip the interactive prompts.
- Whether Playroom Kit needs an account and game ID for local development, its free-tier limits, and its transport. Setup times for every multiplayer option are unmeasured.
- PartyKit, Colyseus, Multisynq and Trystero setup steps and free tiers. I checked only versions.
- Whether venue WiFi isolates clients. If it does, the laptop-IP dev URL and wireless casting both fail, and peer-to-peer WebRTC may fail too.
- Whether the headset already has Developer Mode on. adb and scrcpy need it. A deployed URL does not.
- scrcpy flags for cropping to one eye and for recording on Quest. I confirmed only that scrcpy is installed.
- Chromium autoplay rules in the Quest Browser. The usual approach is a muted video started inside the "Enter XR" click handler, which I did not test.
- Passthrough cameras through `getUserMedia`. Third-party posts say Quest 3 and 3S expose them behind a permission since Browser 40.1. Meta's own pages read today say the opposite or stay silent.
- Whether the Quest Browser supports the WebXR `camera-access` feature. One forum report says no on Horizon OS v85.
- CORS behaviour of any specific AI provider's API.
- A-Frame's current grab components, PlayCanvas XR, Needle, Wonderland and Unreal beyond version numbers.
- Godot's Android export requirements and Meta Spatial SDK's current version.
- All "zero to headset" times in the table.
