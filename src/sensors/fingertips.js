// Index-fingertip positions from WebXR hand joints (scene space), plus how far
// they moved since the last frame. No hand models here (#8 adds them to the
// same hand groups).
export default function fingertips({ renderer, scene }) {
  const hands = [0, 1].map((i) => {
    const hand = renderer.xr.getHand(i);
    scene.add(hand); // joints are posed relative to their hand group
    return hand;
  });
  const last = [null, null];

  return (signals) => {
    const tips = [];
    let travel = 0;
    hands.forEach((hand, i) => {
      const tip = hand.joints['index-finger-tip'];
      if (!hand.visible || !tip?.visible) {
        last[i] = null;
        return;
      }
      const p = { x: tip.position.x, y: tip.position.y, z: tip.position.z };
      if (last[i]) travel += Math.hypot(p.x - last[i].x, p.y - last[i].y, p.z - last[i].z);
      last[i] = p;
      tips.push(p);
    });
    signals.fingertips = tips;
    signals.fingertipTravel = travel;
  };
}
