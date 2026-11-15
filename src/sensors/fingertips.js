// Fingertip positions (scene space), plus how far they moved since the last
// frame. With hand tracking that's each index fingertip, from the WebXR hand
// joints. A held controller counts as a fingertip too, at its grip (where the
// fist stand-in is drawn), so Skip can be chased and touched with controllers.
// three.js only shows a grip for a real controller, never for a tracked hand,
// so an input is counted once. No hand models here (#8 adds them to the same
// hand groups).
export default function fingertips({ renderer, scene }) {
  const inputs = [0, 1].map((i) => {
    const hand = renderer.xr.getHand(i);
    scene.add(hand); // joints are posed relative to their hand group
    return { hand, grip: renderer.xr.getControllerGrip(i) }; // the grip's position is in scene space
  });
  const last = [null, null]; // { kind, p } per input

  return (signals) => {
    const tips = [];
    let travel = 0;
    inputs.forEach(({ hand, grip }, i) => {
      const tip = hand.joints['index-finger-tip'];
      let kind = null;
      let position = null;
      if (hand.visible && tip?.visible) {
        kind = 'hand';
        position = tip.position;
      } else if (grip.visible) {
        kind = 'controller';
        position = grip.position;
      }
      if (!position) {
        last[i] = null;
        return;
      }
      const p = { x: position.x, y: position.y, z: position.z };
      // A switch between hand and controller is not travel.
      if (last[i]?.kind === kind) {
        travel += Math.hypot(p.x - last[i].p.x, p.y - last[i].p.y, p.z - last[i].p.z);
      }
      last[i] = { kind, p };
      tips.push(p);
    });
    signals.fingertips = tips;
    signals.fingertipTravel = travel;
  };
}
