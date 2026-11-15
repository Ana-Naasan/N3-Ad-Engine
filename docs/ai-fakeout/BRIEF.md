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
3. The ad gives up after three look-aways. This needs one new rule file and one line in the rule list. That list isn't meant to be edited, so ask Bader first. Without it the fake-out starts when GLOOP ends.

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
- Don't run a dev server on port 5173, because the live tunnel uses it.
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

## New direction from Bader, 14:00 on 2026-11-15

His words:

- "let's first focus on the actual TV and the recording with the AI because that's our MVP. Everything else is going to be built in like the original repo."
- "it should be streaming through YouTube, and if you click the YouTube video and you skip the ads later on, randomly within the video that you're watching, the user that's speaking just keeps saying, 'Watch the ads, watch the ad,' in his own voice. So it's not like a robotic voice."
- "it would keep saying, 'Watch the ad, watch the ad, watch the ad,' until you actually watch the ads completely and you finish them. And the sound won't go away until the ads are done, even if the ad is in front of the TV."
- "If you can do it in real time, then good. If not, then it's fine. We can pre-prepare them as a clip that just says, 'Don't skip the ad,' but it should be a seamless switch, like talking regularly to, 'Oh, don't skip the ad,' whatever. It shouldn't seem like a cutoff."
- "communicate back and forth with this thread for context work together", about the thread "Watch YouTube Videos With Interruptions".

This replaces the base cut's freeze-frame clip.

## The split with the YouTube thread

The thread "Watch YouTube Videos With Interruptions" works on branch `t3/youtube-tv-ad-interruptions`. It owns how the video gets on the TV and the picker. This branch owns the voice, the look-away give-up and the returning ad.

The contract, as that thread wrote it:

- The viewer browses real YouTube on the TV through a mirror of a headless Chrome on this Mac. The mirror has no sound.
- A featured video is one where `public/videos/<id>.mp4` exists. `<id>` is the YouTube video id. When the viewer picks it, the TV plays the local file through the `content` video element, with sound.
- `tv.contentId` is that id, or `null` for any other pick. The voice file for it is `public/voices/<id>.m4a`.
- The local file has to be the original of a video Bader uploaded. Neither thread downloads from YouTube.

On this branch alone `tv.contentId` does not exist, and the voice feature then uses `public/voices/content.m4a`.

## What is built

Written at 14:15 on 2026-11-15. This branch includes `main` at b8573bd.

With `?fakeout` in the URL:

1. On GLOOP every look-away is a warning. The banner shows "Warning 2 of 3" when the viewer looks back.
2. On the third warning, 3 s of looking away makes GLOOP give up. A 2 s pinch hold on GLOOP counts as a dodge too.
3. The content plays for 10 s with the banner "Fine. Enjoy your video."
4. Between 3 and 6 s in, at a gap in the speech, the content's own sound is muted and a voice starts saying "Don't skip the ad". The picture does not cut.
5. GLOOP comes back and has to be watched to its end. Looking away pauses and rewinds it. The voice carries on, also while the ad is paused.
6. When GLOOP ends, the voice stops and GRIN+ starts as usual.

A viewer who watches GLOOP to its end the first time goes to GRIN+ within three frames.

Files:

- `src/attention/lineup-fakeout.js`: the lineup.
- `src/attention/rules/fakeout.js`: the warnings, the give-up and the pass-through. `src/fakeout.js` adds it after `RULES`, so `rules/index.js` is untouched.
- `src/features/fakeout-voice.js`: when the voice is on, and the audio. `src/fakeout.js` adds it after `FEATURES`.
- `src/main.js`: three lines changed. No other existing file changed.
- `scripts/make-voice.mjs`: makes `public/voices/<id>.m4a` and `<id>.json` (the gaps in the video's sound) from `public/videos/<id>.mp4`. A second argument is a recording of the cloned voice. Without it the voice is the macOS voice Daniel, a stand-in.
- `test/fakeout.test.js`: 28 tests.

Checked on this Mac:

- `npm test` passes, 134 tests in 11 files. `npm run build` passes.
- Changing any of the six fake-out constants makes a test fail.
- The voice feature runs in the tests against a fake audio element and fake TV videos.

Side effects of a fake-out run:

- The ads count 1 to 5. Jump keys 1 to 4 go to GLOOP, GLOOP again, GRIN+ and WRAPZILLA, so no key reaches VOIDCOLA.
- The 10 s of resumed content count as video time and the returning GLOOP counts as ad time, on the receipt and on the KPI board.
- The content starts again from 0 when it seems to resume.

Checked in desktop Chrome at 14:25 (headless, sound muted, the camera turned by script to stand in for a head turn): three warnings, the give-up, the voice starting about 5 s after the video resumed with the content muted, the voice carrying on while a look-away paused the returning GLOOP, and the voice stopping when that GLOOP ended. No page errors.

Not tested: anything on the headset, the Quest Browser playing the separate audio element, and how the switch sounds. Nobody has listened to it yet.

Not decided:

- Who speaks in the featured videos. The voice is cloned only from someone who agreed. Bader was asked at 14:02.
- Which video the TV plays, and a voice sample of its speaker. This is the only thing the cloned voice waits on.
- A line written live from the viewer's numbers. It comes after the cloned voice works.

## The voice tool: Higgsfield, set up at 14:45

Bader chose Higgsfield and asked for the setup. On this Mac:

- `@higgsfield/cli` 1.2.2 is installed globally (`higgsfield`, `higgs`, `hf`). Bader signed in and a workspace is selected.
- The nine `higgsfield-*` skills are in `~/.agents/skills`, linked for Claude Code and Codex. They are not in this repo.
- The model `seed_audio` (Seed Audio 1.0) takes a prompt and `--audio-references`, a sample of a voice. `higgsfield generate cost seed_audio --prompt "<the line>"` reports 0.5 credits. No job has been created and nothing has been uploaded.
- `higgsfield voices list` shows 114 preset voices and no cloned one. The CLI has no command that creates a saved cloned voice.

To make the real voice: get a 10 to 15 s sample of the speaker, run `seed_audio` with it and the line, then `node scripts/make-voice.mjs <id> <the download>`. Other tools, should Higgsfield sound wrong: [research/voice-cloning.md](research/voice-cloning.md).

## Headset checklist for `?fakeout`

For whoever has the Quest. It goes in a comment on this branch's PR once Bader allows the PR. The repo is public: the tunnel URL, real voice clips and real videos stay out of it.

Open the page with `?fakeout` added to the address. Tap Start, then Enter VR. On the TV, pick a featured video: one with a file at `public/videos/<YouTube id>.mp4` and a voice at `public/voices/<YouTube id>.m4a` on the Mac that serves the page. Any other video on the mirror has no sound, so it gets no voice. Without the mirror the TV shows "Pinch to play", which has the stand-in voice.

1. GLOOP starts after 1 s. Turn your head away from the TV and back, twice. The banner reads "Warning 1 of 3", then "Warning 2 of 3".
2. Turn away a third time and stay away for 3 s. GLOOP ends and the video comes back with the banner "Fine. Enjoy your video."
3. Watch the video. Between 3 s and 7.5 s in, its own sound stops and a voice says "Don't skip the ad" on a loop. The picture must not cut or jump.
4. After 10 s of video, GLOOP comes back. The voice carries on over it and GLOOP is quieter.
5. Turn away once. GLOOP pauses and the voice keeps going.
6. Watch GLOOP to its end. The voice stops and GRIN+ starts at normal volume.
7. Reload with `?fakeout` and watch the first GLOOP to its end without turning away. GRIN+ follows, with no voice.
8. Reload without `?fakeout`. The run is the original one.

Report for step 3: whether the voice plays at all on the Quest, whether it is louder or quieter than the video, and whether its start sounds like a cut.
