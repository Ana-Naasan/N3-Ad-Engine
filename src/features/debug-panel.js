import { createPanel } from '../panels.js';

// Debug readout beside the TV. Only exists with ?debug in the URL.
export default function debugPanel({ world, tv }) {
  if (!new URLSearchParams(location.search).has('debug')) return () => {};

  const panel = createPanel({ height: 0.42 });
  panel.mesh.position.set(1.3, tv.group.position.y, -2.0);
  panel.mesh.rotation.y = -0.45;
  world.add(panel.mesh);

  let peakMic = 0;
  let frames = 0;
  let fps = 0;
  let fpsWindowStart = 0;
  let lastUpdate = 0;

  return (output, s) => {
    if (s.micLevel !== null) peakMic = Math.max(peakMic, s.micLevel);
    frames++;
    if (s.t - fpsWindowStart >= 1) {
      fps = Math.round(frames / (s.t - fpsWindowStart));
      frames = 0;
      fpsWindowStart = s.t;
    }
    if (s.t - lastUpdate < 0.1) return;
    lastUpdate = s.t;

    panel.mesh.position.y = tv.group.position.y; // follows calibration
    const mic = s.micLevel;
    const bar = mic === null ? '' : '#'.repeat(Math.min(20, Math.round(mic * 100)));
    panel.setLines([
      `Screen: ${output.screen}  ad ${output.adIndex}  ${output.playing ? 'playing' : 'paused'}`,
      `Head off TV: ${s.headAngle.toFixed(1)}°`,
      `Mic: ${mic === null ? 'off' : mic.toFixed(3)} ${bar}${s.micAvailable ? '' : ' (n/a)'}`,
      `Mic peak: ${peakMic.toFixed(3)}`,
      `Video: ${s.video.t.toFixed(1)}s${s.video.ended ? ' ended' : ''}${s.video.failed ? ' FAILED' : ''}`,
      `Select: ${s.selectHeld.toFixed(1)}s  tips ${s.fingertips.length}`,
      `FPS: ${fps}  ${s.inVR ? 'VR' : 'desktop'}`,
    ]);
  };
}
