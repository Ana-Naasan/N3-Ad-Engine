import * as THREE from 'three';
import { TINT_RENDER_ORDER } from './room-tint.js';

// The one banner under the TV (reference still 2). It draws whatever string the
// attention output's banner holds (look-away, hold-still, the gate, an ad's own
// banner, the finale) and hides on null. Same card style as src/panels.js, but
// one centred line on a card sized to the text.

const WIDTH = 2.0; // metres: the widest the card can get (still 2's card is about TV-wide)
const HEIGHT = 0.2; // metres
const PX_PER_METRE = 900; // as in src/panels.js
const FONT_PX = 80; // ~9 cm text, sized to the TV as in still 2
const PAD_X = 48; // px between the text and the card's sides
const RADIUS = 24; // px, as in src/panels.js
const FONT = (px) => `600 ${px}px system-ui, sans-serif`;

const TV_HALF_HEIGHT = 0.49; // metres: half the TV bezel in src/tv.js
const GAP = 0.08; // metres between the bezel and the card
const FORWARD = 0.08; // metres in front of the TV plane, clear of the cabinet

export function createBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * PX_PER_METRE);
  canvas.height = Math.round(HEIGHT * PX_PER_METRE);
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, HEIGHT),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  mesh.renderOrder = TINT_RENDER_ORDER + 1; // stays readable over the red tint
  mesh.visible = false;

  let lastText = null;

  function draw(text) {
    // Shrink the font only if the text wouldn't fit the widest card.
    let fontPx = FONT_PX;
    ctx.font = FONT(fontPx);
    const fit = (canvas.width - 2 * PAD_X) / ctx.measureText(text).width;
    if (fit < 1) {
      fontPx = Math.floor(fontPx * fit);
      ctx.font = FONT(fontPx);
    }
    const cardW = Math.min(canvas.width, ctx.measureText(text).width + 2 * PAD_X);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20, 14, 10, 0.82)';
    ctx.beginPath();
    ctx.roundRect((canvas.width - cardW) / 2, 0, cardW, canvas.height, RADIUS);
    ctx.fill();

    ctx.fillStyle = '#f4e9d8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  }

  // Show `text`, or hide the banner when it's null or empty. Redraws only on change.
  function setText(text) {
    const next = text || null;
    mesh.visible = next !== null;
    if (next === null || next === lastText) return;
    lastText = next;
    draw(next);
  }

  // Sit just under the TV, facing the same way. The banner and the TV group
  // must share a parent. Call it every frame: calibration moves the TV.
  const offset = new THREE.Vector3();
  function placeUnder(tvGroup) {
    offset.set(0, -(TV_HALF_HEIGHT * tvGroup.scale.y + GAP + HEIGHT / 2), FORWARD);
    offset.applyQuaternion(tvGroup.quaternion);
    mesh.position.copy(tvGroup.position).add(offset);
    mesh.quaternion.copy(tvGroup.quaternion);
  }

  return { mesh, setText, placeUnder };
}
