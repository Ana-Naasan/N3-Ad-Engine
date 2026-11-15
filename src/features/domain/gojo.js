import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Gojo: the rigged model in public/domain/gojo.glb (credit in
// public/domain/SOURCES.md). The file has no animations and ships in a
// fighting stance, so its bones are reset to the bind pose and posed here.
// The group's origin is at his feet and he faces +Z.

const MODEL_URL = '/domain/gojo.glb';
const POP_OVERSHOOT = 1.7;
const ARRIVE_STRETCH = 1.4; // times his height as he snaps in, settling to 1
const ARRIVE_FLICKERS = 2; // times he blinks out while snapping in
const BOB_METRES = 0.03;
const BOB_PER_SECOND = 1.6; // radians

// Poses: per bone, a rotation in degrees (Euler XYZ, in the bone's own axes)
// applied on top of the bind pose. Bone names are the file's without the
// dots and the trailing number: `upper_arm.R_143` is `upper_armR`.
//   rest  standing, arms down
//   sign  the Domain Expansion sign: right hand raised, index up, middle
//         finger crossed over it, the others curled
// A bone missing from a pose stays in the bind pose.
const ARMS_DOWN = {
  upper_armR: [0, 0, 40],
  forearmR: [15, 0, 0],
  upper_armL: [0, 0, -40],
  forearmL: [15, 0, 0],
};
const CURLED = Object.fromEntries(
  ['f_ring', 'f_pinky'].flatMap((finger) => [
    [`${finger}01R`, [80, 0, 0]],
    [`${finger}02R`, [90, 0, 0]],
    [`${finger}03R`, [70, 0, 0]],
  ]),
);
export const POSES = {
  rest: ARMS_DOWN,
  sign: {
    ...ARMS_DOWN,
    upper_armR: [20, -25, 35], // the hand comes up beside his chin, its back to the viewer
    forearmR: [130, 0, 0],
    f_index01R: [12, 0, 18], // leans toward the middle finger
    f_middle01R: [-6, 0, -16], // which crosses over it
    f_middle02R: [15, 0, 0],
    ...CURLED,
    thumb01R: [30, 0, 40], // folded over the curled fingers
    thumb02R: [40, 0, 0],
    thumb03R: [50, 0, 0],
  },
};

// The orbs the file puts in his hands; they belong to another technique.
const HIDDEN_NODES = /^Sphere/;

const easeOutBack = (x) => 1 + (POP_OVERSHOOT + 1) * (x - 1) ** 3 + POP_OVERSHOOT * (x - 1) ** 2;
const boneKey = (name) => name.replace(/_\d+$/, '');

export function createGojo() {
  const group = new THREE.Group();
  group.visible = false;
  const body = new THREE.Group(); // scaled and bobbed inside `group`, which the caller places
  group.add(body);
  let rig = null; // Map of bone key -> { bone, bind } once the model has loaded

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      let skeleton = null;
      gltf.scene.traverse((o) => {
        o.frustumCulled = false; // a skinned mesh is culled by its bind-pose bounds, which a pose can leave
        if (HIDDEN_NODES.test(o.name)) o.visible = false;
        if (o.isSkinnedMesh) skeleton ??= o.skeleton;
      });
      if (skeleton) {
        // pose() rebuilds every bone from the bind matrices, but it gets a root
        // bone under plain nodes wrong: keep the root where the file put it.
        const root = skeleton.bones.find((b) => !b.parent?.isBone);
        const rootMatrix = root.matrix.clone();
        skeleton.pose();
        rootMatrix.decompose(root.position, root.quaternion, root.scale);
        rig = new Map(skeleton.bones.map((bone) => [boneKey(bone.name), { bone, bind: bone.quaternion.clone() }]));
      }
      body.add(gltf.scene);
    },
    undefined,
    (e) => console.warn('Gojo model failed to load', e?.message ?? e),
  );

  const euler = new THREE.Euler();
  const from = new THREE.Quaternion();
  const to = new THREE.Quaternion();
  const toRad = THREE.MathUtils.degToRad;
  function offset(target, pose, key) {
    const [x, y, z] = pose[key] ?? [0, 0, 0];
    return target.setFromEuler(euler.set(toRad(x), toRad(y), toRad(z)));
  }

  return {
    group,

    get loaded() {
      return rig !== null;
    },

    // Writes the raised hand's position (scene coordinates) to `target`; false until the model has loaded.
    handPosition(target) {
      const finger = rig?.get('f_index01R');
      if (!finger) return false;
      finger.bone.getWorldPosition(target);
      return true;
    },

    // appear: 0 = hidden … 1 = fully there (he snaps in from a tall thin sliver, flickering).
    // sign: 0 = rest pose … 1 = the hand sign. time: seconds, for the idle bob.
    update(appear, sign, time) {
      group.visible = appear > 0;
      if (!group.visible) return;
      const there = Math.min(1, appear);
      body.visible = Math.floor(there * ARRIVE_FLICKERS * 2) % 2 === 0;
      const wide = Math.max(0.001, easeOutBack(there));
      body.scale.set(wide, THREE.MathUtils.lerp(ARRIVE_STRETCH, 1, there), wide);
      body.position.y = BOB_METRES * Math.sin(time * BOB_PER_SECOND);
      if (!rig) return;
      const weight = THREE.MathUtils.smoothstep(sign, 0, 1);
      for (const key of new Set([...Object.keys(POSES.rest), ...Object.keys(POSES.sign)])) {
        const entry = rig.get(key);
        if (!entry) continue;
        offset(from, POSES.rest, key).slerp(offset(to, POSES.sign, key), weight);
        entry.bone.quaternion.copy(entry.bind).multiply(from);
      }
    },
  };
}
