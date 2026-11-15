import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

// Visible hands, always:
//   - hand tracking: three.js's hand mesh ('mesh' profile), loaded from
//     public/hands/ (left.glb, right.glb: the generic-hand profile from
//     @webxr-input-profiles/assets 1.0.20, MIT), so nothing comes from a CDN;
//     the 'spheres' profile takes over if a mesh fails to load
//   - controllers: a simple fist stand-in at each controller grip
export const HAND_MODEL_PATH = '/hands/'; // served from public/hands/

const SKIN = 0xd9a57e;

// GLTFLoader that reports load errors (XRHandMeshModel passes none).
class ReportingLoader extends GLTFLoader {
  constructor(onError) {
    super();
    this.onError = onError;
  }

  load(url, onLoad, onProgress, onError) {
    return super.load(url, onLoad, onProgress, (e) => {
      this.onError(url, e);
      onError?.(e);
    });
  }
}

// A rough fist, about hand-sized, centred on the grip.
function makeFist(handedness) {
  const material = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
  const fist = new THREE.Group();
  const side = handedness === 'left' ? 1 : -1; // the palm wraps the handle on this side of X

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.085), material);
  palm.position.x = -side * 0.03;
  fist.add(palm);

  const knuckles = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.06, 4, 8), material);
  knuckles.rotation.x = Math.PI / 2;
  knuckles.position.set(0, 0.03, 0);
  fist.add(knuckles);

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.045, 4, 8), material);
  thumb.rotation.x = Math.PI / 2.5;
  thumb.position.set(side * 0.005, 0.01, -0.045);
  fist.add(thumb);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.06, 10), material);
  wrist.position.set(-side * 0.03, -0.07, 0.01);
  fist.add(wrist);

  return fist;
}

export default function hands({ renderer, scene }) {
  let meshFailed = false;
  const fallbacks = [];
  const loader = new ReportingLoader((url, e) => {
    console.warn('hand mesh failed to load, using spheres', url, e);
    meshFailed = true;
  });
  loader.setPath(HAND_MODEL_PATH);
  const factory = new XRHandModelFactory(loader).setPath(HAND_MODEL_PATH);

  const models = [0, 1].map((i) => {
    const hand = renderer.xr.getHand(i); // already in the scene (fingertips sensor)
    const mesh = factory.createHandModel(hand, 'mesh');
    const spheres = factory.createHandModel(hand, 'spheres');
    spheres.visible = false;
    hand.add(mesh, spheres);
    fallbacks.push({ mesh, spheres });

    const grip = renderer.xr.getControllerGrip(i);
    scene.add(grip);
    let fist = null;
    grip.addEventListener('connected', (event) => {
      const source = event.data;
      if (fist) grip.remove(fist);
      fist = source.hand ? null : makeFist(source.handedness);
      if (fist) grip.add(fist);
    });
    grip.addEventListener('disconnected', () => {
      if (fist) grip.remove(fist);
      fist = null;
    });
    return { hand, grip, get fist() { return fist; } };
  });

  return () => {
    for (const f of fallbacks) {
      f.mesh.visible = !meshFailed;
      f.spheres.visible = meshFailed;
    }
    return {
      debug: {
        handModel: meshFailed ? 'spheres' : 'mesh',
        hands: models.map((m) => (m.fist && m.grip.visible ? 'controller' : m.hand.visible ? 'hand' : '-')).join('/'),
      },
    };
  };
}
