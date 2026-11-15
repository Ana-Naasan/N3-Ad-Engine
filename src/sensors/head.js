import * as THREE from 'three';

// headPos / headQuat (reference space, same as scene space) and headAngle,
// the degrees between where the head points and the TV.
export default function head({ camera, tv }) {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const tvPos = new THREE.Vector3();
  const toTV = new THREE.Vector3();
  const forward = new THREE.Vector3();

  return (signals, { pose }) => {
    if (pose) {
      const { position: p, orientation: q } = pose.transform;
      pos.set(p.x, p.y, p.z);
      quat.set(q.x, q.y, q.z, q.w);
    } else {
      camera.getWorldPosition(pos);
      camera.getWorldQuaternion(quat);
    }
    tv.group.getWorldPosition(tvPos);
    toTV.subVectors(tvPos, pos).normalize();
    forward.set(0, 0, -1).applyQuaternion(quat);

    signals.headAngle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(forward.dot(toTV), -1, 1)));
    signals.headPos = { x: pos.x, y: pos.y, z: pos.z };
    signals.headQuat = { x: quat.x, y: quat.y, z: quat.z, w: quat.w };
  };
}
