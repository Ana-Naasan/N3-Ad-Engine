// Microphone loudness (RMS of the waveform, 0..1). No speech recognition.

let audioCtx = null;
let track = null;
let analyser = null;
let samples = null;

// Call from a user gesture, before entering VR: Quest Browser can't show the
// permission prompt inside an immersive session.
export async function startMic() {
  audioCtx = new AudioContext(); // created before the await so the gesture still counts
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { autoGainControl: false }, // keep loud = loud, so a volume threshold means something
  });
  track = stream.getAudioTracks()[0];
  await audioCtx.resume();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  samples = new Float32Array(analyser.fftSize);
  audioCtx.createMediaStreamSource(stream).connect(analyser);
}

// The browser may suspend audio when entering VR; call this on sessionstart.
export function resumeMic() {
  return audioCtx?.resume();
}

export function getMicLevel() {
  if (!analyser) return null;
  analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export function getMicDiagnostics() {
  if (!audioCtx) return null;
  return {
    ctx: audioCtx.state,
    track: track ? `${track.readyState}${track.muted ? ' muted' : ''}${track.enabled ? '' : ' disabled'}` : 'none',
    label: track?.label ?? '',
  };
}
