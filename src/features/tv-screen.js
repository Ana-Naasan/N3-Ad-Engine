// Applies the output's screen, playing, loop, seek and tvDim to the TV every frame.
export default function tvScreen({ tv }) {
  return (output) => tv.apply(output);
}
