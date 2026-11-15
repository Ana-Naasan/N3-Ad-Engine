import {
  RESUME_SCREEN, RERUN_SCREEN, RESUME_SECONDS,
} from '../attention/lineup-fakeout.js';

// The fake-out voice: only with ?fakeout in the URL (../fakeout.js adds this
// feature after FEATURES). A few seconds after the video resumes, the speaker
// starts saying "Don't skip the ad". The picture does not cut: the content
// video keeps playing with its own sound muted, and the voice plays from a
// separate audio element. The voice carries on over the returning ad, also
// while that ad is paused, and stops when the ad has ended.
//
// Files, per content video id: /voices/<id>.m4a is the voice, on a loop, and
// /voices/<id>.json holds `pauses`, the [start, end] gaps in the video's
// speech. Both come from scripts/make-voice.mjs. The id is tv.contentId when
// the TV has a picker, and 'content' when it has none.
//
// A video can say the line itself, on camera: its json then has `lineAt`, the
// second where the line starts. That video is not muted and the voice stays
// off while it shows. The voice takes over when the ad comes back.

export const NAG_MIN_SECONDS = 3; // the voice starts this long after the video
export const NAG_MAX_SECONDS = 6; // resumes, at a random moment in this range,
export const PAUSE_WAIT_SECONDS = 1.5; // then waits this long at most for a gap in the speech
const AD_VOLUME_UNDER_VOICE = 0.35;

// Decides when the voice is on, from the screen alone. Pure: `random` returns
// 0 to 1. Call the returned function every frame with the output's screen,
// the time and whether the content is at a gap in its speech.
export function createNag(random = Math.random) {
  let phase = 'off'; // 'off' | 'armed' | 'on'
  let lastScreen = null;
  let startAt = 0;

  // `lineSpoken`: for a video that says the line itself, whether it has started
  // to. It then decides the moment, in place of the random delay.
  return ({ screen, t, atPause = true, lineSpoken }) => {
    if (screen !== lastScreen) {
      const resumed = screen === RESUME_SCREEN && lastScreen === RERUN_SCREEN;
      const adCameBack = screen === RERUN_SCREEN && lastScreen === RESUME_SCREEN;
      if (resumed) {
        phase = 'armed';
        startAt = t + NAG_MIN_SECONDS + random() * (NAG_MAX_SECONDS - NAG_MIN_SECONDS);
      } else if (phase === 'armed' || !adCameBack) {
        // The video was left before the voice began, or the returning ad ended.
        phase = 'off';
      }
      lastScreen = screen;
    }
    const due = lineSpoken === undefined
      ? t >= startAt && (atPause || t >= startAt + PAUSE_WAIT_SECONDS)
      : lineSpoken;
    if (phase === 'armed' && due) phase = 'on';
    return phase === 'on';
  };
}

// The voice must have begun before the ad comes back.
if (NAG_MAX_SECONDS + PAUSE_WAIT_SECONDS >= RESUME_SECONDS) {
  throw new Error('fakeout: the voice could start after the ad comes back');
}

export default function fakeoutVoice({ tv }) {
  const nag = createNag();
  const voice = new Audio();
  voice.loop = true;
  voice.preload = 'auto';
  let voiceId; // the content id whose voice is loaded, or null for none
  let pauses = [];
  let lineAt = null; // the second where the video says the line itself, or null
  let on = false;

  function load() {
    const id = tv.contentId === undefined ? 'content' : tv.contentId;
    if (id === voiceId) return;
    voiceId = id;
    pauses = [];
    lineAt = null;
    if (!id) {
      voice.removeAttribute('src');
      return;
    }
    voice.src = `/voices/${id}.m4a`;
    fetch(`/voices/${id}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((info) => {
        if (voiceId !== id) return;
        pauses = info.pauses ?? [];
        lineAt = info.lineAt ?? null;
      })
      .catch(() => {});
  }

  // Must run inside a user gesture, like tv.primeAll(): one play() unlocks the element.
  document.getElementById('start')?.addEventListener('click', () => {
    load();
    voice.play().then(() => { if (!on) voice.pause(); }).catch(() => {});
  });

  return (output, signals) => {
    if (output.screen !== 'card') load(); // a picker knows the content only after the card
    const content = tv.videos[RESUME_SCREEN].video;
    const ad = tv.videos[RERUN_SCREEN].video;
    const now = content.currentTime;
    const atPause = !pauses.length || pauses.some(([start, end]) => now >= start && now < end);

    // A video with no voice file keeps its own sound: muting it would leave silence.
    const missing = Boolean(voiceId && voice.error);
    const spoken = lineAt !== null;
    const nagging = nag({
      screen: output.screen, t: signals.t, atPause, lineSpoken: spoken ? now >= lineAt : undefined,
    });
    const onCamera = spoken && output.screen === RESUME_SCREEN; // the video is saying it
    const want = nagging && Boolean(voiceId) && !missing && !onCamera;
    if (want !== on) {
      on = want;
      content.muted = on;
      ad.volume = on ? AD_VOLUME_UNDER_VOICE : 1;
      if (on) {
        voice.currentTime = 0;
        voice.play().catch((e) => console.warn('fake-out voice failed', e.name, e.message));
      } else {
        voice.pause();
      }
    }
    const state = on ? `on (${voiceId})` : missing ? `no voice file (${voiceId})` : 'off';
    return { debug: { fakeoutVoice: state } };
  };
}
