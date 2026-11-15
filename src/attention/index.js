// The attention module: runs the ad sequence. Pure: no three.js, no DOM, no
// clock. Call update(signals) once per frame with that frame's signals
// (time `t` in seconds included) and render the output it returns.
//
// Steps: the "Pinch to play" card, then the lineup in order. Rules (see
// ./rules) get the signals and the current step, and their results are merged
// here by fixed rules, never by registration order:
//   - any `playing: false` pauses; seeks add up, clamped so video time >= 0
//   - banner: lookAway > holdStill > gate > any other rule > the ad's own
//   - target 'palms', tvDim and tint 'red' apply if any rule sets them
//   - only the rule named 'skip' sets `skip`; `gate` comes from any rule
//   - any `passed` advances to the next step; `jumpTo` N goes to the Nth ad
//   - `addStats` {headTurns, chaseMetres} adds to the stats
//
// The `ad` a rule receives is the lineup entry plus `index` (position in the
// lineup, -1 for the card), `adIndex` (1–4, 0 before the ads) and `startedAt`.
import { LINEUP, FAILED_AD_SECONDS } from './lineup.js';
import { RULES } from './rules/index.js';

const BANNER_PRIORITY = ['lookAway', 'holdStill', 'gate'];
const CARD = { kind: 'card', screen: 'card' };

export function createAttention(lineup = LINEUP, rules = RULES) {
  const ruleFns = rules.map((r) => ({ name: r.name, fn: r.create() }));
  const ads = lineup.filter((s) => s.kind === 'ad');
  let step = { ...CARD, index: -1, adIndex: 0, startedAt: 0 };
  let lastT = null;
  let usedJump = false;
  let frozen = false;
  const stats = { adTime: 0, videoTime: 0, headTurns: 0, chaseMetres: 0, peakVolume: 0 };

  function goTo(index, t) {
    const entry = lineup[index];
    if (!entry) return;
    step = { ...entry, index, adIndex: ads.indexOf(entry) + 1, startedAt: t };
    if (entry.finale) frozen = true;
  }

  function update(signals) {
    const { t } = signals;
    const dt = lastT === null ? 0 : Math.max(0, t - lastT);
    lastT = t;

    if (!frozen) {
      if (step.kind === 'ad') stats.adTime += dt;
      if (step.kind === 'content') stats.videoTime += dt;
      if (signals.micLevel != null) stats.peakVolume = Math.max(stats.peakVolume, signals.micLevel);
    }

    const before = step;

    // Built-in steps: the card waits for a select; content plays for its seconds.
    if (step.kind === 'card' && signals.selectStarted) goTo(0, t);
    else if (step.kind === 'content' && t - step.startedAt >= step.seconds) goTo(step.index + 1, t);

    const results = ruleFns.map(({ name, fn }) => ({ name, r: fn(signals, step) || {} }));

    if (!frozen) {
      for (const { r } of results) {
        stats.headTurns += r.addStats?.headTurns ?? 0;
        stats.chaseMetres += r.addStats?.chaseMetres ?? 0;
      }
    }

    // Moving on: a jump, a pass, or a no-gimmick ad that ended or failed.
    const jump = results.map(({ r }) => r.jumpTo).find((n) => Number.isInteger(n) && n >= 1 && n <= ads.length);
    const video = signals.video || {};
    if (jump && !step.finale) {
      goTo(lineup.indexOf(ads[jump - 1]), t);
      usedJump = true;
    } else if (results.some(({ r }) => r.passed)) {
      goTo(step.index + 1, t);
    } else if (step.kind === 'ad' && !step.gimmick && !step.finale && step.startedAt < t) {
      const failedOut = video.failed && t - step.startedAt >= FAILED_AD_SECONDS;
      if (video.ended || failedOut) goTo(step.index + 1, t);
    }

    const out = {
      screen: step.screen,
      playing: step.kind !== 'card',
      loop: Boolean(step.gimmick || step.finale),
      seek: 0,
      target: 'tv',
      tvDim: false,
      tint: null,
      banner: step.banner ?? null,
      skip: { state: 'hidden', progress: 0, jump: false },
      gate: { visible: false, level: 0, line: null, label: null },
      finale: Boolean(step.finale),
      stats: { ...stats },
      usedJump,
      adIndex: step.adIndex,
    };

    // A new step starts clean: results computed for the old one don't apply.
    if (step !== before) return out;

    let seek = 0;
    for (const { name, r } of results) {
      if (r.playing === false) out.playing = false;
      if (r.seek) seek += r.seek;
      if (r.target === 'palms') out.target = 'palms';
      if (r.tvDim) out.tvDim = true;
      if (r.tint === 'red') out.tint = 'red';
      if (r.gate) out.gate = { ...out.gate, ...r.gate };
      if (name === 'skip' && r.skip) out.skip = { ...out.skip, ...r.skip };
    }
    out.seek = Math.max(seek, -(video.t ?? 0)) || 0;

    const banners = results.filter(({ r }) => r.banner);
    const rank = ({ name }) => {
      const i = BANNER_PRIORITY.indexOf(name);
      return i === -1 ? BANNER_PRIORITY.length : i;
    };
    banners.sort((a, b) => rank(a) - rank(b));
    if (banners.length) out.banner = banners[0].r.banner;

    return out;
  }

  return { update };
}
