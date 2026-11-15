import { createPanel } from '../panels.js';

// Rehearsal hints: one line above the TV saying what to try at each step.
// Only with ?hints in the URL, so recordings stay clean.
const SKIP_HINTS = {
  flying: 'Chase the Skip button with a fingertip',
  running: 'Chase the Skip button with a fingertip',
  catchable: 'Catch it! Touch the Skip button',
  locked: 'Hold perfectly still',
  enabled: 'Touch Skip',
};

export function hintFor(output) {
  if (output.finale) return 'Look around · hold a pinch 2 s to restart';
  switch (output.screen) {
    case 'card': return 'Pinch your fingers to play';
    case 'ad1': return 'Try: look away · cover your eyes · hold a pinch 2 s to skip';
    case 'ad2': return SKIP_HINTS[output.skip?.state] ?? '';
    case 'ad3': return 'Shout WRAPZILLA (or clap if the mic is off)';
    default: return '';
  }
}

const PICKER_HINT = 'Point at a video and pinch to play it · hold the pinch and move to scroll';

export default function hints(ctx) {
  const { world, tv } = ctx;
  if (!new URLSearchParams(location.search).has('hints')) return () => {};

  const panel = createPanel({ width: 1.8, height: 0.1, fontPx: 48 });
  panel.mesh.visible = false;
  world.add(panel.mesh);
  let lastText = null;

  return (output) => {
    const text = output.screen === 'card' && ctx.picker?.showing ? PICKER_HINT : hintFor(output);
    if (text !== lastText) {
      lastText = text;
      panel.mesh.visible = Boolean(text);
      if (text) panel.setLines([text]);
    }
    // Follow the TV (it moves with calibration and shrinks in the finale).
    const s = tv.group.scale.y;
    panel.mesh.position.set(tv.group.position.x, tv.group.position.y + 0.45 * s + 0.12, tv.group.position.z + 0.02);
    return { debug: { hint: text } };
  };
}
