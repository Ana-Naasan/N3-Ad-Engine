// Applies the output's screen, playing, loop and seek to the TV every frame.
export default function tvScreen({ tv }) {
  return (output) => tv.apply(output);
}
