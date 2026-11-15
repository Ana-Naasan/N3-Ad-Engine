# Voice cloning for the fake-out line

Researched Sunday 2026-11-15. Read-only web research plus Hugging Face and PyPI metadata calls. Nothing was installed, no model was downloaded and no audio was generated, so every speed and quality statement comes from a source, not from this Mac. "Fetched" means I read the owner's page or file. "Snippet" means the fact came from a search summary. "Metadata" means the Hugging Face or PyPI API.

## Recommendation

1. Local pick. Use `mlx-audio` 0.6.5 with Chatterbox Turbo. It needs no transcript, no account and no gated download. Expect 10 to 15 minutes, most of it a 3.3 GB download. That time is my estimate.
2. Hosted pick. Use ElevenLabs on the Starter plan at $6 a month, the cheapest ElevenLabs plan with instant cloning. Expect about 10 minutes with the card form.
3. Real-time version. Use a hosted streaming model. First audio arrives in 0.1 to 0.2 seconds, so the 3.7 second `claude -p` call stays the slow step.
4. If Chatterbox Turbo sounds wrong, try Qwen3-TTS 0.6B Base next. It is the only model here with a published M1 Pro measurement.
5. Prepare the reference once with `ffmpeg -i recording.m4a -ac 1 -ar 24000 -t 15 ref.wav`. Use 10 to 15 seconds of the person talking casually, with no music or echo.

## Local options

### Chatterbox Turbo through mlx-audio (local pick)

```bash
uvx --python 3.12 --from 'mlx-audio==0.6.5' mlx_audio.tts.generate \
  --model mlx-community/chatterbox-turbo-fp16 \
  --text "Oh, don't skip the ad. Watch the ad." \
  --ref_audio ref.wav --file_prefix watch_the_ad
```

- The CLI writes `watch_the_ad_000.wav` in the current folder. Add `--play` to hear it. (Fetched, `generate.py`)
- `uv` resolved `mlx-audio==0.6.5` for Python 3.12 on this Mac from binary wheels only, without installing. The `mlx` 0.32.4 wheels need macOS 14 or newer. (Metadata)
- The download is 2.85 GB plus up to 0.47 GB for `mlx-community/S3TokenizerV2`. The 8-bit copy is 0.68 GB and the 4-bit copy is 0.40 GB. None is gated. (Metadata)
- It needs no transcript. `generate()` takes `ref_audio` only, so the CLI skips Whisper. The clip must be longer than 5 seconds and the model reads its first 10 to 15 seconds. (Fetched, `chatterbox_turbo.py`)
- On an M5 with 24 GB it takes 1.0 to 1.4 seconds per short sentence once loaded, with 3.6 to 3.8 GB peak memory. (Fetched, sglang-omni PR 3141, 2026-10-24) On an M4 it takes 0.51 seconds per second of audio. (Fetched, chatterbox-mlx page, 2026-11-03) My estimate for a 3 second line on the M1 Pro is 2 to 4 seconds plus a short load.
- It speaks English only and reads inline tags such as `[sigh]`, `[chuckle]` and `[laugh]`, which suit a casual line. I found no independent listening score.
- The licence is MIT upstream. Resemble marked the repo "retired research" in August 2026 and stopped updates. (Fetched)
- Avoid the PyTorch package `chatterbox-tts` here. An M1 Pro test needed 808 seconds for 40 seconds of audio on MPS. (Fetched, DEV post, 2026-10-02)

### Qwen3-TTS 0.6B Base through mlx-audio

- Use the same command with `--model mlx-community/Qwen3-TTS-12Hz-0.6B-Base-4bit` and `--ref_text "the exact words spoken in ref.wav"`. The download is 1.63 GB at 4-bit and 2.40 GB at bf16. The licence is Apache 2.0. (Metadata)
- Give it the transcript. Without `--ref_text` the CLI downloads `whisper-large-v3-turbo-asr-fp16`, 1.5 GB, and transcribes the clip itself. (Fetched, `generate.py`)
- On an M1 Pro with 32 GB it took 0.63 seconds per second of audio at 4-bit, with a 1 to 2 second load. A 28 second reference made the worst case 7 to 94 times slower than real time, so keep the clip near 6 to 10 seconds. (Fetched, DEV post)

### Pocket TTS from Kyutai

- Run `uvx --python 3.12 pocket-tts generate --voice ref.wav --text "Oh, don't skip the ad. Watch the ad."`. It writes `./tts_output.wav`. (Fetched, version 4.0.1, 2026-10-21)
- Cloning needs a Hugging Face account. Accept the terms at `huggingface.co/kyutai/pocket-tts`, then run `uvx hf auth login`. This Mac has no Hugging Face token. (Fetched, `tts_model.py`)
- It has 100M parameters, runs on two CPU cores and needs no transcript. Kyutai reports about 200 ms to the first audio chunk and 6 times real time on a MacBook Air M4. (Fetched)
- Code is MIT and weights are CC-BY 4.0. It is the smallest model here, so I expect a weaker voice match than Chatterbox Turbo. That is my reading, not a measurement.

### ZONOS3-Mini from Zyphra

- Use the same `mlx-audio` command with `--model mlx-community/ZONOS3-Mini`. The download is 1.34 GB. It needs no transcript and it streams. (Fetched, model card)
- Zyphra released it on 2026-11-09. Weights are Apache 2.0 and code is MIT. Zyphra claims first audio in under 150 ms on an M3 MacBook Air. (Snippet)
- One tester reported about 16 GB of peak memory during the first clone, and this Mac has 16 GB. (Fetched, third-party guide) The model is six days old, so try it only with spare time.

### Other local models

- Sesame CSM. `mlx-community/csm-1b-8bit` is 1.63 GB and ungated. It needs the clip's transcript. Sesame says the base model "has not been fine-tuned on any specific voice", so expect a loose voice match. (Fetched)
- f5-tts-mlx. Version 0.2.6 dates from 2025-03-19. It needs a mono 24 kHz clip of 5 to 10 seconds plus its transcript. The upstream weights carry a CC-BY-NC 4.0 tag. (Fetched; Metadata)
- IndexTTS-2.5 from 2026-08-10 is 5.2 GB, uses a bilibili licence, and its docs cover CUDA only. (Fetched)
- VibeVoice. Microsoft removed the TTS code on 2025-09-05. The Realtime-0.5B model has preset speakers only. (Fetched)
- Fish Speech. S2-Pro is 10.5 GB under a research licence. The MLX copy of Drama 3 is 22.7 GB, more than this Mac's 16 GB of memory. (Fetched; Metadata)
- Kyutai TTS 1.6B restricts cloning to pre-computed voice embeddings. (Fetched)

## Hosted options

### ElevenLabs (hosted pick)

- Sign up at elevenlabs.io, subscribe to Starter, create an API key and export it as `ELEVENLABS_API_KEY`. The pricing page lists instant cloning from Starter at $6 a month. (Fetched)
- Instant cloning needs 10 seconds in total and 5 seconds per file. ElevenLabs recommends 1 to 2 minutes, so upload the whole recording. (Fetched)
- Consent is a confirmation that you have the right to clone the voice. The spoken voice check applies to professional clones only. (Fetched; Snippet for the voice check)
- `eleven_v4` is the most expressive model. `eleven_v4_turbo` and `eleven_flash_v2_5` list about 100 ms median latency before network time. If Starter refuses `eleven_v4`, drop `model_id` to get the default `eleven_multilingual_v2`. (Fetched)
- I built these two calls from the API reference and did not run them. The first returns `voice_id`.

```bash
curl -s https://api.elevenlabs.io/v1/voices/add -H "xi-api-key: $ELEVENLABS_API_KEY" -F name=fakeout -F files=@ref.wav
curl -s "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID/stream" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d "{\"text\":\"Oh, don't skip the ad. Watch the ad.\",\"model_id\":\"eleven_v4\"}" -o watch_the_ad.mp3
```

### Cartesia

- Instant cloning starts on Pro at $5 a month. The free plan has 20K credits and no cloning. (Fetched)
- Ten seconds of audio is enough and Sonic 3.6 uses up to 60 seconds. `POST /voices/clone` takes `clip`, `name` and `language`, and `POST /tts/bytes` returns audio. Both need the header `Cartesia-Version: 2026-08-14`. (Fetched)
- Cartesia states "first audio in under 90ms". Third parties measured 166 to 190 ms median with the network. (Fetched; Snippet) The docs I read state no consent step.

### Inworld

- The On-Demand plan costs $0 and includes up to 70 minutes of speech. The page says "Cloning is free on every plan". (Fetched)
- A clip of 10 to 30 seconds works best. `POST https://api.inworld.ai/voices/v1/voices:clone` takes base64 audio in JSON. You confirm that you hold the rights. (Fetched)
- Median first audio over WebSocket is 152 ms on TTS-2 and 121 ms on TTS-2 Flash. On-demand speech costs $25 and $15 per million characters. (Fetched)

### fal.ai

- `fal-ai/chatterbox/text-to-speech/turbo` takes `audio_url`, a 5 to 10 second clip, and returns a file URL. The page lists no streaming and no latency figure. fal bills from prepaid credits, and Chatterbox costs $0.025 per 1,000 characters. (Fetched)

### Fish Audio, Resemble, PlayHT and Hume

- Fish Audio charges $15 per million UTF-8 bytes for `s2.1-pro` and lists `s2.1-pro-free` at $0. The page does not say whether the free model accepts a reference clip. (Fetched)
- Resemble's pricing page now lists only detection plans. Trackers quote $0.0005 per second and $2 a month per rapid clone. (Fetched; Snippet)
- PlayHT shut down on 2025-12-31 after Meta bought it, and `play.ht` did not answer from this Mac today. Hume ended its TTS and EVI APIs on 2026-11-13. (Snippet) Hume's docs index now lists only Audio Decisions and Expression Measurement. (Fetched)

## Real-time version

- Hosted is the realistic route to speech within 1.5 seconds. Clone once, keep the voice id and call a streaming endpoint per sentence. ElevenLabs `eleven_v4_turbo`, Cartesia `sonic-3.6` and Inworld TTS-2 publish first audio between 90 and 160 ms before network time.
- The whole line then takes about 4 seconds, because the `claude -p` call in `BRIEF.md` took 3.7 seconds. Keep the API key in the dev-server plugin, never in the headset page.
- Local works if one process keeps the model loaded. `mlx_audio.server` needs the `server` extra. Chatterbox Turbo answered in 1.0 to 1.4 seconds on an M5, so plan for 2 to 4 seconds on the M1 Pro on top of the 3.7 seconds.
- `uvx pocket-tts serve` is the only local option with a published sub-second first chunk, measured on an M4. It needs the Hugging Face terms step.

## Could not confirm

- Any speed or voice quality on this M1 Pro, and whether the 8-bit and 4-bit Chatterbox Turbo copies sound as good as fp16. Nothing was run.
- Whether `mlx-community/pocket-tts`, 224 MB and ungated, can clone from `--ref_audio`. The code accepts the flag but the model card does not say.
- Today's ElevenLabs first-month price. The page shows a $1 offer whose banner says it ends September 30. Also when the API sets `requires_verification` for an instant clone.
- Whether Inworld, fal.ai and Fish Audio need a card or a top-up before the first call, and Resemble's current cloning prices and consent step.

## Sources

- mlx-audio: [PyPI 0.6.5](https://pypi.org/project/mlx-audio/), [README](https://github.com/Blaizzy/mlx-audio/blob/main/README.md), [generate.py](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/tts/generate.py), [chatterbox_turbo.py](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/tts/models/chatterbox_turbo/chatterbox_turbo.py), [Qwen3-TTS notes](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/tts/models/qwen3_tts/README.md)
- Model cards: [chatterbox-turbo-fp16](https://huggingface.co/mlx-community/chatterbox-turbo-fp16), [Qwen3-TTS 0.6B Base 4-bit](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-0.6B-Base-4bit), [ZONOS3-Mini MLX](https://huggingface.co/mlx-community/ZONOS3-Mini), [kyutai/pocket-tts](https://huggingface.co/kyutai/pocket-tts), [kyutai/tts-1.6b-en_fr](https://huggingface.co/kyutai/tts-1.6b-en_fr)
- Upstream repos: [Chatterbox](https://github.com/resemble-ai/chatterbox), [Pocket TTS](https://github.com/kyutai-labs/pocket-tts), [ZONOS3-Mini](https://github.com/Zyphra/ZONOS3-Mini), [Sesame CSM](https://github.com/SesameAILabs/csm), [f5-tts-mlx](https://pypi.org/project/f5-tts-mlx/), [IndexTTS](https://github.com/index-tts/index-tts), [VibeVoice](https://github.com/microsoft/VibeVoice), [Fish Speech](https://github.com/fishaudio/fish-speech)
- Measurements: [sglang-omni PR 3141](https://github.com/sgl-project/sglang-omni/pull/3141), [chatterbox-mlx](https://pypi.org/project/chatterbox-mlx/), [M1 Pro bake-off on DEV](https://dev.to/chongwang/three-bake-offs-to-find-a-voice-cloning-engine-that-runs-entirely-on-a-macbook-p8l), [ZONOS3-Mini guide](https://freakyjolly.com/zonos3-mini-tts-guide/)
- ElevenLabs: [pricing](https://elevenlabs.io/pricing), [models](https://elevenlabs.io/docs/overview/models), [instant cloning guide](https://elevenlabs.io/docs/creative-platform/voices/voice-cloning/instant-voice-cloning), [create clone](https://elevenlabs.io/docs/api-reference/voices/ivc/create), [stream speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream)
- Cartesia: [pricing](https://cartesia.ai/pricing), [clone voices](https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices), [clone API](https://docs.cartesia.ai/api-reference/voices/clone), [TTS bytes](https://docs.cartesia.ai/api-reference/tts/bytes), [Sonic](https://cartesia.ai/sonic)
- Others: [Inworld cloning](https://inworld.ai/voice-cloning), [Inworld TTS API](https://inworld.ai/tts-api), [Inworld pricing](https://inworld.ai/pricing), [fal Chatterbox Turbo](https://fal.ai/models/fal-ai/chatterbox/text-to-speech/turbo/api), [fal pricing](https://fal.ai/pricing), [Fish Audio pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits), [Resemble pricing](https://www.resemble.ai/pricing/), [Hume docs index](https://dev.hume.ai/llms.txt)
