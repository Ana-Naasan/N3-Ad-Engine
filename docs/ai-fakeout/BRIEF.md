# AI fake-out brief

Written at 13:45 on 2026-11-15 by the session that planned the dropped fight idea in the `sih-2026` project. Bader moved that work here. This file is the handoff. The agent that reads it starts with none of that conversation.

## What Bader asked for

Bader wants one small extra on a separate branch. The main project carries on as planned in issue #3.

His words, in order:

- "integrate a small piece of AI or whatever into that to make it cooler, add a couple other stupid features... We need it to work, and it should be done relatively quick."
- "if you try to skip the ads you get a couple of warnings, let's say 3, and then after those 3 warnings, if you keep looking away and the ad's rewinding, you would continue with the regular video, but the video would continue for a bit, and then all of a sudden, the person talking in the video just keeps saying, 'Watch the ad, watch the ad,' or, like, something on the TV, AI-generated, whatever."
- On a test where this Mac wrote and voiced the line: "It should come from the VR headset itself."
- On the content video being a title card: "Allow it to stream YouTube videos and then cut off for the ads there."
- "create a separate branch and work on it yourself using multiple subagents... the main idea can stay the same. I don't want to sacrifice the whole project for this, so make it a separate branch, but we need to get this done ASAP."
- His last word, which limits everything above: "It should be like an addition. I'm not sure if my idea fits well or integrates well with the original idea. I want it to be kind of like a simple addition that is easy to do. It shouldn't take too much time or have to change anything to do with the original repository, or not much change... And when I say change, I mean the routes or the infrastructure that was already set up for the original idea... Or the things being implemented right now."

## The rule for this branch

Add files. Change existing files by as little as possible. Do not change existing routes, the attention core, the rule list, or any file that an open ticket is working on.

## The base cut

Build this first. It is the planning session's design and nobody has run it.

1. A second lineup in a new file, such as `src/attention/lineup-fakeout.js`. It is `LINEUP` with two steps added after GLOOP. Both steps have `kind: 'content'`, so the ad numbers, the key jumps and the look-away guard stay as they are:
   - the content video for about 5 seconds, with a banner such as "Fine. Enjoy your video.";
   - a new clip, `watchTheAd`, for its own length.
2. `src/main.js` uses that lineup only when the URL has `?fakeout`. Without the flag the run is the original one, and the existing tests stay as they are. About eight assertions in `test/core.test.js` and `test/forcePass.test.js` expect GRIN+ straight after GLOOP, which is why `LINEUP` itself must not change.
3. `src/tv.js` gets one more name in `VIDEO_NAMES`.
4. `public/videos/watchTheAd.mp4` is made on this Mac by a new script. It is the content clip frozen on a frame, with a voice that repeats "Watch the ad". The voice is inside the clip, so it plays from the headset.
5. A new test file drives the fake-out lineup through `createAttention(lineup).update(signals)` and checks the order: GLOOP, content, `watchTheAd`, GRIN+.

Known side effect: the two steps count as video time on the finale receipt.

The core supports this without a change. A `content` step anywhere in the lineup plays for its `seconds` and then moves on, and a step's `banner` is shown for any kind of step.

## Extras, in this order, each only after the one before works

Each one is an addition. Stop and ask Bader before any that he has not confirmed.

1. A real video as the content. Download one YouTube video once with `yt-dlp` and save it as `public/videos/content.mp4`, then remake `watchTheAd.mp4` from it. This needs no code. Bader has to pick the video. YouTube's terms do not allow downloading this way, and the planning session told Bader so.
2. A live line. Claude writes one sentence from the viewer's numbers, a voice speaks it, and the page plays it over `watchTheAd`. This needs one new dev-server plugin file, one line in `vite.config.js`, one new feature file, and one line in the feature list. The voice inside the clip is the fallback.
3. The ad gives up after three look-aways. This needs one new rule file and one line in the rule list. `CLAUDE.md` says not to edit that list, so ask Bader first. Without it the fake-out starts when GLOOP ends.

## Dropped, with the reason

- A live YouTube stream through the dev server. It is a new route with range requests, and it depends on `yt-dlp` working against YouTube today. Extra 1 gives the same picture on camera.
- A change to the attention core for side steps. The second lineup makes it unnecessary.
- Two extras that were offered and not accepted: each warning spawns another TV, and the ad gets louder with each warning.

## Not decided

- "It should come from the VR headset itself" is read as: the voice plays from the headset's speakers. Bader has not confirmed that reading.
- The banner wording and the clip's length.
- Pushing the branch and opening a PR. Bader has not approved either. Ask first.

## Facts checked on this Mac on 2026-11-15

- `claude -p "<prompt>" --model haiku` returned a JSON ad written from viewer stats in 3.7 s. It printed two "Permission allow rule" warning lines before the JSON, so pick the JSON out of the output.
- `say -v Daniel -o line.aiff "<text>"` followed by `ffmpeg -i line.aiff -c:a aac line.m4a` took 1.41 s for a 3.9 s line.
- No API keys are set in the environment for Anthropic, OpenAI, fal, Decart or ElevenLabs.
- Installed: `yt-dlp` 2026.08.19, `ffmpeg`, `adb`, `scrcpy` 4.1, OBS, node 26, npm, pnpm. Not installed: ImageMagick, `cloudflared`. The team's `scripts/make-placeholders.sh` needs ImageMagick, so it does not run here.
- The content video is a title card. Nobody talks in it.
- The headset is a Quest 3 with Developer Mode on, and a USB-C cable is on hand. It was not plugged in at 13:17.

Not tested: the fake-out on the headset, `yt-dlp` against YouTube today, and the Quest Browser playing a separate audio file.

## Repo state at 13:33

- `origin/main` is at b888aaf. It has the attention core (PR #14) and the scene plumbing (PR #13). No PR is open.
- This branch starts from b888aaf.
- Bader's tickets #6 look-away, #9 gate, #10 finale and #11 KPI board are open. Other threads work on them in `~/.t3/worktrees/unskippable-vr/`. Leave those worktrees alone.
- `src/attention/rules/lookAway.js` was a stub when read at 13:30. Ticket #6 fills it in, and it also brings the banner feature that draws a step's `banner`.
- The spec's recording cutoff is 4:15 pm.
- `CLAUDE.md` says not to run a dev server on port 5173, because the live tunnel uses it.
- For a headset test without the tunnel, `adb reverse tcp:<port> tcp:<port>` lets the Quest Browser open `http://localhost:<port>`, which counts as a secure origin. This is untested here.

## How Bader works

- Lead with the answer. Keep replies short. Bring one question at a time with a recommendation.
- Ask before installing, deleting, changing credentials, pushing, or acting outside this Mac.
- Report failures plainly, with the evidence.
- Write every reply and document with the `unslop` skill.

## Suggested skills

`implement`, `tdd`, `diagnosing-bugs`, `unslop`.

## Background from the dropped fight idea

The fight idea was a Quest 3 fight where an AI model morphs the player's weapon. Bader dropped it for this project.

Three research files from it are in [research/](research/):

- [realtime-ai-generation.md](research/realtime-ai-generation.md): how fast AI services generate images, video and 3D. Its header states a wrong time range.
- [quest-non-unity-stack.md](research/quest-non-unity-stack.md): what a web page can do on a Quest. It cites `facebook/immersive-web-sdk`, and the repo is now `meta/immersive-web-sdk`. Its header states a wrong time range.
- [meta-look-outside-unity.md](research/meta-look-outside-unity.md): where a Meta-style look and free assets come from. It says the Horizon kit license carries a Meta copyright. The license reads "Copyright 2024 Bela Bohlender", MIT.

The rest stays in `~/.t3/projects/sih-2026`: the map at `.scratch/rigged-fight/map.md`, its tickets, and the Blade & Sorcery mod research.
