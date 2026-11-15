import * as THREE from 'three';

// The TV: a 1.6 x 0.9 m screen in a thin bezel, showing the "Pinch to play"
// card or one of several videos.
//
// With the YouTube mirror (src/features/picker.js) the card is the mirror's
// live texture instead, and the content is the viewer's pick: a featured
// video's own file, or the mirror itself.

const VIDEO_NAMES = ['content', 'ad1', 'ad2', 'ad3', 'ad4'];
const videoUrl = (name) => `/videos/${name}.mp4`;
const TV_DIM_BRIGHTNESS = 0.2; // screen brightness while the ad plays on the palms

function makeVideo(name) {
  const video = document.createElement('video');
  video.src = videoUrl(name);
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { video, texture };
}

// The "Pinch to play" card. setLabel redraws its bottom line (e.g. while
// YouTube loads); the ▶ only shows with the default label.
function makeCardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let label = null;
  texture.setLabel = (text) => {
    if (text === label) return;
    label = text;
    ctx.fillStyle = '#14100c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (text === 'Pinch to play') {
      ctx.fillStyle = '#e9a03b';
      ctx.font = '700 120px system-ui, sans-serif';
      ctx.fillText('▶', 640, 290);
    }
    ctx.fillStyle = '#f4e9d8';
    ctx.font = '700 96px system-ui, sans-serif';
    ctx.fillText(text, 640, text === 'Pinch to play' ? 450 : 360);
    texture.needsUpdate = true;
  };
  texture.setLabel('Pinch to play');
  return texture;
}

export function createTV() {
  const group = new THREE.Group();

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.68, 0.98, 0.04),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  bezel.position.z = -0.025;
  group.add(bezel);

  const cardTexture = makeCardTexture();
  const screenMaterial = new THREE.MeshBasicMaterial({ map: cardTexture });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), screenMaterial);
  group.add(screen);

  const videos = Object.fromEntries(VIDEO_NAMES.map((n) => [n, makeVideo(n)]));
  let shown = 'card';
  let current = null; // null while the card or the live texture shows
  let playFailed = false;
  let live = null; // the YouTube mirror's texture, while there is one
  let contentLive = false; // the content screen is the mirror (a pick with no file of its own)
  let contentId = 'content'; // the content's file is /videos/<contentId>.mp4; null when it is the mirror

  function showMap(map) {
    if (screenMaterial.map === map) return;
    screenMaterial.map = map;
    screenMaterial.needsUpdate = true;
  }

  function switchTo(name) {
    current?.video.pause();
    shown = name;
    playFailed = false;
    current = (name === 'content' && contentLive ? null : videos[name]) ?? null;
    if (current) current.video.currentTime = 0; // every screen starts from the top
    showMap(current ? current.texture : live ?? cardTexture);
  }

  function setContentUrl(url) {
    const { video } = videos.content;
    if (new URL(video.src, location.href).pathname !== url) video.src = url;
  }

  function play(video) {
    video.play().catch((e) => {
      if (e.name === 'AbortError') return; // a pause or switch interrupted it
      playFailed = true; // stop retrying; the attention module times the ad out
      console.warn('video play failed', video.src, e.name, e.message);
    });
  }

  return {
    group, // #10 shrinks this for the finale
    screenMaterial,
    videos,

    // Must run inside a user gesture: one play() per element unlocks it with sound.
    // The pause lands asynchronously, so leave alone whichever video is showing by then.
    primeAll() {
      for (const { video } of Object.values(videos)) {
        video.play().then(() => { if (video !== current?.video) video.pause(); }).catch(() => {});
      }
    },

    // Apply one frame of attention output: { screen, playing, loop, seek, tvDim }.
    apply({ screen: name, playing, loop, seek, tvDim }) {
      if (name !== shown) switchTo(name);
      screenMaterial.color.setScalar(tvDim ? TV_DIM_BRIGHTNESS : 1);
      if (!current) return;
      const { video } = current;
      video.loop = Boolean(loop);
      if (seek) video.currentTime = Math.max(0, video.currentTime + seek);
      // An ended, non-looping video stays ended: play() would restart it.
      if (playing && video.paused && !video.ended && !playFailed) play(video);
      else if (!playing && !video.paused) video.pause();
    },

    // The card's text, e.g. 'Loading YouTube…' while the mirror comes up.
    setCardLabel(text) {
      cardTexture.setLabel(text);
    },

    // The mirror's texture stands in for the card (null: the "Pinch to play" card).
    setLive(texture) {
      live = texture;
      if (!current) showMap(live ?? cardTexture);
    },

    // The viewer's pick, set before the content screen shows. With an id, the
    // content is the featured video's file, with sound; without, it's the mirror.
    pickContent(id) {
      contentId = id ?? null;
      contentLive = !id;
      if (id) setContentUrl(videoUrl(id));
    },

    // A new run: the content is the placeholder again until the next pick.
    resetContent() {
      contentId = 'content';
      contentLive = false;
      setContentUrl(videoUrl('content'));
    },

    // Names the content's file, /videos/<contentId>.mp4: a featured video's YouTube
    // id, or 'content' for the placeholder. null when the content is the mirror,
    // which has no file and no sound.
    get contentId() {
      return contentId;
    },

    // What the content screen shows, for the finale's postcard.
    get contentTexture() {
      return contentLive && live ? live : videos.content.texture;
    },

    get currentVideo() {
      return current?.video ?? null;
    },

    get failed() {
      return playFailed || Boolean(current?.video.error);
    },

    // What the screen shows now (video or card), for features like palm screens.
    get texture() {
      return screenMaterial.map;
    },
  };
}
