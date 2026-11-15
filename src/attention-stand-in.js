// TEMPORARY stand-in for #4's attention module, with the same contract:
// createAttention(lineup, rules).update(signals) -> output. Delete it once #4
// lands and import the real one from src/attention/index.js in src/main.js.
// It only does the card, 1 s of content, the ad order, GLOOP ending,
// the 2 s force-pass and key jumps. No gimmicks.

const CONTENT_SECONDS = 1;
const FORCE_PASS_SECONDS = 2;
const FAILED_AD_SECONDS = 10;
const LOOPING = new Set(['ad2', 'ad3', 'ad4']); // gimmick ads and the finale

// The stand-in ignores lineup and rules; they are here to match the real signature.
export function createAttention(lineup, rules) {
  let screen = 'card';
  let screenStart = 0;
  let failedAt = null;
  let usedJump = false;

  function go(next, t) {
    screen = next;
    screenStart = t;
    failedAt = null;
  }

  return {
    update(s) {
      const adIndex = screen.startsWith('ad') ? Number(screen[2]) : 0;
      const finale = screen === 'ad4';
      const heldThisAd = Math.min(s.selectHeld, s.t - screenStart); // hold resets on ad change

      if (!finale && s.jumpTo) {
        usedJump = true;
        go(`ad${s.jumpTo}`, s.t);
      } else if (screen === 'card') {
        if (s.selectStarted) go('content', s.t);
      } else if (screen === 'content') {
        if (s.t - screenStart >= CONTENT_SECONDS) go('ad1', s.t);
      } else if (!finale) {
        if (s.video.failed && failedAt === null) failedAt = s.t;
        const ended = screen === 'ad1' &&
          (s.video.ended || (failedAt !== null && s.t - failedAt >= FAILED_AD_SECONDS));
        if (ended || heldThisAd >= FORCE_PASS_SECONDS) go(`ad${adIndex + 1}`, s.t);
      }

      return {
        screen,
        playing: screen !== 'card',
        loop: LOOPING.has(screen),
        seek: 0,
        target: 'tv',
        tvDim: false,
        tint: null,
        banner: null,
        skip: { state: 'hidden', progress: 0, jump: 0 }, // jump: number of jumps so far
        gate: { visible: false, level: 0, line: 0, label: '' },
        finale: screen === 'ad4',
        stats: { adTime: 0, videoTime: 0, headTurns: 0, chaseMetres: 0, peakVolume: 0 },
        usedJump,
        adIndex: screen.startsWith('ad') ? Number(screen[2]) : 0, // 0 for card and content
      };
    },
  };
}
