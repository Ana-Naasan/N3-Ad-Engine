import * as THREE from 'three';

// The TV: a 1.6 x 0.9 m screen in a thin bezel, showing one of several videos.

const VIDEO_NAMES = ['content', 'ad1', 'ad2', 'ad3', 'ad4'];

function makeVideo(name) {
  const video = document.createElement('video');
  video.src = `/videos/${name}.mp4`;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { video, texture };
}

export function createTV() {
  const group = new THREE.Group();

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.68, 0.98, 0.04),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  bezel.position.z = -0.025;
  group.add(bezel);

  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), screenMaterial);
  group.add(screen);

  const videos = Object.fromEntries(VIDEO_NAMES.map((n) => [n, makeVideo(n)]));
  let current = null;

  return {
    group,
    videos,

    // Must run inside a user gesture: one play() per element unlocks it with sound.
    // The pause lands asynchronously, so leave alone whichever video is showing by then.
    primeAll() {
      for (const { video } of Object.values(videos)) {
        video.play().then(() => { if (video !== current?.video) video.pause(); }).catch(() => {});
      }
    },

    show(name, { loop = false } = {}) {
      if (current && current !== videos[name]) current.video.pause();
      current = videos[name];
      current.video.loop = loop;
      screenMaterial.map = current.texture;
      screenMaterial.color.set(0xffffff);
      screenMaterial.needsUpdate = true;
      return current.video.play();
    },

    get currentVideo() {
      return current?.video ?? null;
    },
  };
}
