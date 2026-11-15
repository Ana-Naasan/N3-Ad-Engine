// Frame helper: drives the attention module one frame at a time and fakes
// the TV's video clock. It applies the output's play, pause, seek and loop
// to a fake video time and reports `ended` at the video's length.
import { createAttention } from '../../src/attention/index.js';
import { LINEUP } from '../../src/attention/lineup.js';

export const DT = 1 / 16; // exact in binary, so times add up without drift
export const VIDEO_LENGTH = 10; // seconds; every fake video is this long

export function baseSignals(t) {
  return {
    t,
    inVR: true,
    headAngle: 0,
    headPos: { x: 0, y: 1.2, z: 0 },
    headQuat: { x: 0, y: 0, z: 0, w: 1 },
    palmsUp: false,
    fingertips: [],
    fingertipTravel: 0,
    skipDistance: null,
    selectStarted: false,
    selectHeld: 0,
    micLevel: null,
    micAvailable: false,
    clap: false,
    jumpTo: null,
    pick: null,
  };
}

// createRun({ lineup, rules }) → run
//   run.frame(signals)          one frame at the current time, then time += DT
//   run.run(seconds, signals)   frames for `seconds`; `signals` may be a
//                               function (elapsed, t) => partial signals
//   run.t, run.out, run.video   current time, last output, fake video state
//   run.minVideoTime            lowest video time ever seen (after seeks)
//   run.seeks                   every non-zero seek, in order
export function createRun({ lineup = LINEUP, rules } = {}) {
  const attention = rules ? createAttention(lineup, rules) : createAttention(lineup);
  const video = { t: 0, ended: false, failed: false };
  const run = { t: 0, out: null, video, minVideoTime: 0, seeks: [] };

  function advanceVideo(dt) {
    const out = run.out;
    if (!out || !out.playing || video.ended || video.failed) return;
    video.t += dt;
    if (video.t >= VIDEO_LENGTH) {
      if (out.loop) video.t -= VIDEO_LENGTH;
      else {
        video.t = VIDEO_LENGTH;
        video.ended = true;
      }
    }
  }

  run.frame = (signals = {}) => {
    const out = attention.update({
      ...baseSignals(run.t),
      ...signals,
      t: run.t,
      video: { t: video.t, ended: video.ended, failed: video.failed },
    });
    if (!run.out || out.screen !== run.out.screen) {
      video.t = 0; // a new video starts from the top
      video.ended = false;
    }
    if (out.seek) {
      video.t += out.seek;
      run.seeks.push(out.seek);
      run.minVideoTime = Math.min(run.minVideoTime, video.t);
      if (video.ended && video.t < VIDEO_LENGTH) video.ended = false;
    }
    run.out = out;
    run.t += DT;
    advanceVideo(DT);
    return out;
  };

  run.run = (seconds, signals = {}) => {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      const elapsed = i * DT;
      run.frame(typeof signals === 'function' ? signals(elapsed, run.t) : signals);
    }
    return run.out;
  };

  // Shortcut: pinch on the card, then let the 1 s of content play out.
  run.toFirstAd = () => {
    run.frame({ selectStarted: true });
    while (run.out.screen !== 'ad1') run.frame();
    return run.out;
  };

  return run;
}
