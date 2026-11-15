import * as THREE from 'three';

// Finale: a paper receipt floating to the viewer's right, drawn from the frozen stats
// {adTime, videoTime, headTurns, chaseMetres, peakVolume} (design/reference.html, still 7).

const WIDTH = 0.45; // metres
const PX_PER_METRE = 1200;
const FONT_PX = 28;
const LINE_PX = 42;
const RULE_PX = 20;
const PAD_PX = 32;
const TOOTH_PX = 15; // torn bottom edge
const PAPER = '#fbf8f1';
const INK = '#222';

// Placement in the TV's parent space, where the viewer sits at the origin facing -Z.
// The height is fixed, like the room, so recentering or re-entering VR can't leave it stale.
const DISTANCE = 1.3; // metres from the viewer
const ANGLE = THREE.MathUtils.degToRad(22); // right of the TV line; far edge ~32°, short of the KPI board's 35°
const HEIGHT = 1.1; // a little under a seated viewer's eyes

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const formatted = (value, format) => (Number.isFinite(value) && value >= 0 ? format(value) : '—');

function receiptLines(stats) {
  return [
    ['center', '*** YOUR RECEIPT ***'],
    ['rule'],
    ['row', 'Time on ads', formatted(stats.adTime, clock)],
    ['row', 'Time on video', formatted(stats.videoTime, clock)],
    ['row', 'Head turns', formatted(stats.headTurns, (n) => String(Math.round(n)))],
    ['row', 'Metres chasing Skip', formatted(stats.chaseMetres, (m) => m.toFixed(1))],
    ['row', 'Peak volume', formatted(stats.peakVolume, (v) => v.toFixed(2))],
    ['rule'],
    ['center', 'Thank you for watching'],
  ];
}

const lineHeight = ([kind]) => (kind === 'rule' ? RULE_PX : LINE_PX);

export function createReceipt() {
  const layout = receiptLines({});
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * PX_PER_METRE);
  canvas.height = PAD_PX * 2 + TOOTH_PX + layout.reduce((h, line) => h + lineHeight(line), 0);
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, canvas.height / PX_PER_METRE), material);
  mesh.position.set(DISTANCE * Math.sin(ANGLE), HEIGHT, -DISTANCE * Math.cos(ANGLE));
  mesh.rotation.y = -ANGLE; // face the viewer
  mesh.visible = false;

  let lastText = null;

  function draw(lines) {
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);

    // Paper with a torn (zigzag) bottom edge
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h - TOOTH_PX);
    for (let x = w; x > 0; x -= TOOTH_PX * 2) {
      ctx.lineTo(x - TOOTH_PX, h);
      ctx.lineTo(Math.max(0, x - TOOTH_PX * 2), h - TOOTH_PX);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.font = `${FONT_PX}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'middle';

    let y = PAD_PX;
    for (const line of lines) {
      const [kind, text, value] = line;
      const mid = y + lineHeight(line) / 2;
      if (kind === 'rule') {
        ctx.beginPath();
        ctx.moveTo(PAD_PX, mid);
        ctx.lineTo(w - PAD_PX, mid);
        ctx.stroke();
      } else if (kind === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, mid);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(text, PAD_PX, mid);
        ctx.textAlign = 'right';
        ctx.fillText(value, w - PAD_PX, mid);
      }
      y += lineHeight(line);
    }
    texture.needsUpdate = true;
  }

  return {
    mesh,

    // stats: the frozen finale stats, or null to hide. fade: 0..1 opacity.
    update(stats, fade) {
      mesh.visible = Boolean(stats) && fade > 0;
      if (!mesh.visible) return;
      const lines = receiptLines(stats);
      const text = JSON.stringify(lines);
      if (text !== lastText) {
        lastText = text;
        draw(lines);
      }
      material.opacity = fade;
    },
  };
}
