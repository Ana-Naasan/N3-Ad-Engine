import * as THREE from 'three';

// skipDistance: metres from the nearest fingertip to the Skip button's centre,
// or null when Skip is hidden or no fingertip is tracked. The skip feature
// owns the button and shares its position as ctx.skip (scene space, same as
// the fingertips). Sensors run before features, so this reads last frame's
// position. The attention rule decides what counts as a touch.
export default function skipProximity(ctx) {
  ctx.skip ??= { position: new THREE.Vector3(), visible: false };

  return (signals) => {
    const { position: p, visible } = ctx.skip;
    let nearest = null;
    if (visible) {
      for (const tip of signals.fingertips) {
        const d = Math.hypot(tip.x - p.x, tip.y - p.y, tip.z - p.z);
        if (nearest === null || d < nearest) nearest = d;
      }
    }
    signals.skipDistance = nearest;
    return { debug: { skipDist: nearest === null ? null : +nearest.toFixed(3) } };
  };
}
