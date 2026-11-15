# Real-time AI generation for the VR sabotage game

Researched Sunday 2026-11-15, 11:35 to 11:47 EST. Read-only web research, no accounts created, no APIs called.

How to read the sources. "Fetched" means I read the vendor's own page. "Snippet" means the number came from a search summary of that page and I did not open it. Everything else is in "Could not verify".

## Bottom line

1. Whole-view AI video in the headset does not work today. The best published result is 11 fps with 1.4 seconds of latency. Put the AI output on objects, textures, a skybox, or a screen inside a normal 3D scene.
2. Weapon morph. Generate the useless objects before 17:00 and swap GLBs at runtime. Live text-to-3D exists at about 10 seconds for an untextured mesh, but it costs a paid plan and adds stage risk.
3. Surroundings. Blockade Labs Skybox Model 3 returns an 8K 360 image in about 15 seconds through plain REST. Decart `lucy-restyle-2` is the only self-serve option that streams restyled video, and Decart's own Quest demo reports 150 to 200 ms.
4. Higgsfield is the wrong tool. It is an async job API with no streaming.

## 1. Higgsfield

- A public REST API exists at `https://api.higgsfield.ai`, with Python and Node SDKs. Fetched: https://docs.higgsfield.ai/docs/help/faq
- Every request is async. You submit, get a `request_id`, then poll `status_url` or wait for a webhook. The docs mention no streaming or real-time mode. Fetched: https://docs.higgsfield.ai/docs/help/faq
- Higgsfield publishes no generation time in seconds. The FAQ says only that timeouts are model-specific. Fetched: https://docs.higgsfield.ai/docs/help/faq
- Signup needs a payment method and a balance top-up before you can create a key. The blog mentions no free credits. Fetched: https://higgsfield.ai/blog/higgsfield-api
- Prices: Soul 2 $0.0032 per image, DoP $0.125 per generation, Kling 2.5 $0.042 per second. Fetched: https://higgsfield.ai/blog/higgsfield-api
- The key must stay server-side. The FAQ says not to expose it in browser code. Fetched: https://docs.higgsfield.ai/docs/help/faq

Verdict: usable only to pre-render clips or images before the demo.

## 2. Real-time generation

| Service | Input | Output | Latency or fps | Transport | Browser JS SDK | Price | Signup |
|---|---|---|---|---|---|---|---|
| Decart `lucy-restyle-2`, `lucy-2.6` | Live `MediaStream`, text prompt, optional reference image. `setPrompt()` changes the prompt mid-session | Restyled video stream, 720p default | Platform docs give no number. Decart's Quest 3 demo states 150 to 200 ms end to end at 1280x720, 30 fps | WebRTC | Yes, `@decartai/sdk`. The browser needs a short-lived client token from your backend | Restyle $0.01/s, Lucy $0.02/s, fast mode $0.04/s | Account at platform.decart.ai, free credits of unstated size |
| Decart `oasis-3-preview` | Scene prompt plus driving actions | 768x512 driving simulation | Not in the docs I read | gRPC, Python only | No | $0.02/s | Same account |
| fal realtime | Text prompt, optional image | Single image, 512x512 is fastest | "sub-100ms" | WebSocket, `fal.realtime.connect()` | Yes, `@fal-ai/client`, through a proxy or token provider | Not found | Not checked |
| fal FLUX.1 schnell | Text | Image | No number published. fal calls it "fastest inference in the world" | REST or queue | Yes | $0.003 per megapixel | Not checked |
| fal Worlds, Lingbot World 2 | Start image, prompt, WASD keys, quick actions | Interactive video session | Not on the model page | Not on the model page | Unknown | $0.00125 per second of video | Not checked |
| Odyssey-2 Pro | Text prompt, optional image, `interact({prompt})` while streaming | Video `MediaStream` for a `<video>` element | fps not in the docs I read. Each stream caps at 150 s | WebRTC | Yes, `@odysseyml/odyssey`, loads from a CDN | Not published | Docs say sign up and get a key at developer.odyssey.ml/dashboard. Third-party reviews say access is now by request |
| Blockade Labs Skybox AI | Text prompt and style | 360 equirectangular image, 8192x4096 on Model 3 | About 15 s on Model 3, 60 to 120 s on Model 4 | REST with polling or webhook | No, key must stay server-side | 1 credit per Model 3 skybox | Free plan has no API. Essential plan and up get a key |
| World Labs Marble | Text or image | Gaussian splat world (SPZ, PLY), GLB collider | About 5 minutes per call | REST | Unknown | About $1.20 per world, $0.12 for a draft | Not checked |
| Krea | Text | Async jobs. The real-time 14B model is open weights only | 11 fps on one NVIDIA B200, self-hosted | REST | Unknown | Compute units | Token at krea.ai/settings/api-tokens |
| Google Genie | n/a | n/a | n/a | No developer API found | No | n/a | Consumer product only, per third parties |
| Runway GWM Worlds | n/a | n/a | n/a | No public API found | No | n/a | Early-access form, per third parties |
| Luma Ray 3.2 | Text, image, video | Video file | Async | REST | No real-time mode found | Per second | Not checked |

Sources for the table:

- Decart prices and model IDs, fetched: https://docs.platform.decart.ai/getting-started/pricing and https://docs.platform.decart.ai/getting-started/models
- Decart real-time inputs, `setPrompt()`, client tokens, 720p default, fetched: https://docs.platform.decart.ai/sdks/javascript-realtime and https://docs.platform.decart.ai/sdks/javascript
- Decart Quest numbers, fetched: https://github.com/DecartAI/Decart-XR and https://cookbook.decart.ai/decart-xr
- Oasis 3 uses the `decart-oasis` Python gRPC SDK, fetched: https://docs.platform.decart.ai/getting-started/models
- fal realtime models (`fal-ai/fast-lcm-diffusion`, `fal-ai/fast-turbo-diffusion`), "sub-100ms", proxy auth, fetched: https://fal.ai/docs/documentation/model-apis/inference/real-time
- fal schnell price, fetched: https://fal.ai/models/fal-ai/flux-1/schnell
- fal Worlds list and Lingbot price, fetched: https://fal.ai/explore/worlds and https://fal.ai/models/robbyant/lingbot-world-2
- Odyssey key signup, npm package, CDN import, inputs, fetched: https://documentation.api.odyssey.ml/api-quick-start
- Odyssey 150 s stream cap and WebRTC requirement, snippet: https://documentation.api.odyssey.ml/stream-duration-limits
- Blockade times, credits, resolution, fetched: https://docs.blockadelabs.com/api/skybox.html
- Blockade plan limits and "Free: no API", fetched: https://docs.blockadelabs.com/api/pricing-and-limits.html
- Blockade server-side key rule, fetched: https://docs.blockadelabs.com/api/
- World Labs price and 5 minute wait, snippet: https://docs.worldlabs.ai/api/pricing and https://docs.worldlabs.ai/api
- Krea 11 fps, snippet: https://www.krea.ai/blog/krea-realtime-14b

## 3. Fast 3D generation

- Meshy publishes median times from September 2026. On `meshy-t2`, text-to-3D preview (mesh only) takes 10 s and image-to-3D (mesh only) takes 4 s. Image-to-3D with 2K textures takes 60 s. On `meshy-7.1` the mesh-only time is 75 s. Fetched: https://docs.meshy.ai/en/api/task-lifecycle
- Meshy outputs GLB, OBJ, FBX, STL, USDZ. Fetched: https://docs.meshy.ai/en/api/text-to-3d
- Meshy API keys need a paid plan. Free accounts cannot create keys or tasks. Fetched: https://docs.meshy.ai/en/api/quick-start
- Stability Stable Fast 3D takes one image and returns a textured mesh. Stability's 2024 launch post states 0.5 s on a GPU and "close to a second" on its API. Fetched: https://stability.ai/news-updates/introducing-stable-fast-3d
- Stable Fast 3D costs 10 credits ($0.10). Stable Point Aware 3D costs 4 credits ($0.04). New accounts get 25 free credits. Fetched: https://docs.stability.ai/pricing.md
- Stability's current API reference says 3D services are async. You get an `id` and poll for the result. Fetched: https://docs.stability.ai/api-reference
- Tripo outputs GLB and charges 10 to 20 credits ($0.10 to $0.20) for text-to-3D. Its docs say "production-ready mesh in seconds" with no number. Fetched: https://developers.tripo3d.ai/
- Rodin (Hyper3D) is async with status polling. Its docs state no generation time. Fetched: https://docs.hyper3d.ai/
- fal hosts Trellis at $0.02 per run and SAM 3D at $0.02 per call with GLB output. Snippet: https://fal.ai/models/fal-ai/hunyuan3d/v2 and https://fal.ai/models/fal-ai/sam-3/3d-objects

Answer: a live morph under 15 seconds is possible on paper. Meshy `meshy-t2` gives an untextured mesh in a median 10 s from text or 4 s from an image, and a textured one takes 60 s. Medians are not guarantees, and Meshy's page says not to use them as timeouts. For a 60-second stage demo, generate the assets ahead of time and swap them at runtime. Let a language model pick which object and when, so the sabotage is still decided live.

## 4. Fast text-to-image

- fal realtime over WebSocket claims "sub-100ms" per image at 512x512 with SDXL Turbo or LCM. It works from a browser through a proxy. Fetched: https://fal.ai/docs/documentation/model-apis/inference/real-time
- fal FLUX.1 schnell costs $0.003 per megapixel. fal publishes no time in milliseconds. Fetched: https://fal.ai/models/fal-ai/flux-1/schnell
- Stability's cheapest image services are SDXL 1.0 from 0.9 credits and SD 3.5 Flash at 2.5 credits. The page gives no speed. Fetched: https://docs.stability.ai/pricing.md
- Higgsfield Soul 2 is cheap at $0.0032 per image, but it is async with no stated time. Fetched: https://higgsfield.ai/blog/higgsfield-api

Use in the build: generate a 512x512 texture and apply it to the weapon or arena walls. That gives a visible live AI change without waiting on 3D generation.

## 5. Whole-view AI video in VR

- "Generated Reality" (arXiv 2602.18422) runs a video world model on a Meta Quest 3 through Unity, conditioned on tracked head and hand poses. The paper states "We achieve 11 FPS in real-time with 1.4 seconds of latency on a single H100 GPU." Training resolution was 480x480. The limitations section says stereo rendering lags behind modern VR. Fetched: https://arxiv.org/html/2602.18422v2
- Decart XR restyles the Quest 3 or 3S passthrough camera with `lucy-restyle-2`. It reports 1280x720 at 30 fps, VP8 over WebRTC, and 150 to 200 ms end to end. It is a Unity Android app, with no WebXR version. Fetched: https://github.com/DecartAI/Decart-XR
- Decart XR shows the result on world-space canvases as floating screens, and Meta exposes only one passthrough camera, so the feed is a single camera view. Fetched: https://cookbook.decart.ai/decart-xr

Answer: nobody has shown head-tracked stereo AI video at a usable frame rate. 1.4 seconds of head latency would make the player sick. Render a normal 3D scene on the headset and put AI output on a skybox, a wall, a held object, or a screen.

## Ranked shortlist

### (a) Morphing a held weapon mid-fight

| Rank | Option | Latency | Access friction | Cost | Why it fits a 4-hour build |
|---|---|---|---|---|---|
| 1 | Pre-generated GLB set, swapped at runtime. A language model picks the object and the moment | No generation at demo time | Any 3D tool works by hand before 17:00 | Free tiers or about $0.10 to $0.20 per model | No network call can fail on stage. The swap is one line in three.js |
| 2 | Live texture swap from fal realtime | "sub-100ms" claimed at 512x512 | fal key plus a small proxy | Not found | Adds a real live AI change on top of option 1 with one WebSocket call |
| 3 | Meshy `meshy-t2` live, text to untextured mesh | 10 s median, 4 s from an image | Paid plan needed for a key | Plan price not checked | Fits inside 60 s, but the mesh arrives with no texture |
| 4 | Stability Stable Fast 3D live, image to mesh | About 1 s claimed in 2024, API is async now | Account, 25 free credits cover 2 runs | $0.10 per run | Needs an image first, so it chains two calls |
| 5 | Tripo or Rodin live | No vendor number | Not checked | $0.10 to $0.20 on Tripo | Unknown timing is too risky for today |

### (b) Generated surroundings

| Rank | Option | Latency | Access friction | Cost | Why it fits a 4-hour build |
|---|---|---|---|---|---|
| 1 | Blockade Labs Skybox Model 3 as the scene background | About 15 s per skybox | Paid plan needed for an API key, 1 concurrent job | 1 credit each, 100 credits a month on Essential | One REST call, one equirect texture. It is real 360, so it looks right in a headset |
| 2 | Decart `lucy-restyle-2` on a wall or dome | 150 to 200 ms in Decart's Quest demo | Self-serve account, free credits, needs a token endpoint | $0.01/s, so $0.60 per demo minute | Only self-serve live video option. More integration work: WebRTC plus a video texture |
| 3 | Odyssey-2 Pro stream on a dome | fps not confirmed, 150 s stream cap | Docs say self-serve, reviews say by request | Not published | Text to live video with `interact()` prompts. Access is uncertain today |
| 4 | fal realtime images as wall textures | "sub-100ms" claimed | fal key plus proxy | Not found | Simple, but the images are flat, not 360 |
| 5 | fal Lingbot World 2 | Not on the model page | Not checked | $0.00125/s | Cheap, specs unconfirmed |
| 6 | World Labs Marble | About 5 minutes | Not checked | About $1.20 per world | Pre-generation only, and splats are heavy for a Quest browser |

## Could not verify

- Higgsfield generation time in seconds. Higgsfield publishes none.
- Decart frame rate and latency in the platform docs. The only numbers are in the Decart XR repo and cookbook.
- The size of Decart's free signup credits.
- Whether Decart's real-time API accepts a `canvas.captureStream()` from a WebXR scene in the Quest Browser. This is my inference from the SDK taking any `MediaStream`. Nobody tested it.
- Whether Decart XR output is stereo. The sources imply a single camera view and do not say.
- Whether `fal-ai/fast-turbo-diffusion` is still live. The docs list it, but https://fal.ai/models/fal-ai/fast-turbo-diffusion returned 404.
- fal's price for realtime endpoints, fal signup friction, and fal free credits.
- fal FLUX.1 schnell latency in milliseconds. Third-party roundups say 1 to 2 s.
- fal Worlds resolution, frame rate, and transport. A third-party article (artrealmai.com) says WebRTC and 1664x960 at 48 fps.
- Odyssey-2 Pro frame rate and resolution. Third parties say 720p at 22 fps.
- Odyssey access. The quick start says sign up at the dashboard. Third-party reviews from September and October 2026 say new access is by request. I did not open the dashboard.
- Odyssey pricing, and anything about Odyssey-3.
- Krea's 11 fps figure and the absence of a hosted Krea real-time endpoint. Both come from search snippets.
- Google Genie 3 and Genie 4 developer access. I read no first-party Google page. Third parties say there is no developer API.
- Runway GWM Worlds access and Luma real-time status. Search snippets only.
- World Labs numbers. They come from a search snippet of the official docs, which I did not open.
- Blockade Labs dollar prices. Third-party sites list Essential at $20 to $24 a month.
- Tripo and Rodin generation times. Third parties quote 10 to 120 s for Tripo and about 4 s for Rodin's lowest tier.
- Stable Fast 3D speed today. The 1 second figure is from an August 2024 post, and the current API is async. The endpoint path `/v2beta/3d/stable-fast-3d` comes from a search snippet.
- Meshy plan price and credits per task.
- The 20 ms motion-to-photon budget for comfortable VR. It came from a third-party article, not a primary source.
- End-to-end time for a chained text-to-image then image-to-3D call. No source states it, so the shortlist gives no number for it.

## Note

The fetch tool reported that https://docs.blockadelabs.com/api/ contains promotional text and buying advice addressed to AI agents. I did not use it. The plan and timing facts above come from the reference tables on the other two Blockade pages.
