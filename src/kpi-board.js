import * as THREE from 'three';
import { fetchTotals } from './session-api.js';

// "Q4 Attention Report" board: four tiles of real session totals.
// Card style from src/panels.js; layout from design/reference.html still 8.

const WIDTH = 0.8; // metres
const HEIGHT = 0.56;
const DISTANCE = 1.8; // metres from the viewer to the board's centre
const PX_PER_METRE = 900;

// Angle from the TV line (straight ahead, -Z) to the board's nearest edge.
// Look-away starts above 30°, so reading any part of the board trips it.
export const NEAR_EDGE_DEG = 38;

const PANEL = 'rgba(20, 14, 10, 0.82)';
const TILE = 'rgba(255, 255, 255, 0.07)';
const CREAM = '#f4e9d8';
const AMBER = '#e9a03b';
const FONT = 'system-ui, sans-serif';

// What the board shows: a message, or four [label, value] tiles.
// `totals` is a /api/totals answer, or null when loading failed.
export function kpiBoardView(totals) {
  if (!totals) return { message: 'Report unavailable' };
  if (totals.sessions === 0) return { message: 'No sessions yet' };
  return {
    tiles: [
      ['Sessions', String(totals.sessions)],
      ['Ad : video', totals.ratio === null ? '—' : `${formatRatio(totals.ratio)} : 1`],
      ['Head turns', String(Math.round(totals.headTurns))],
      ['m chased', totals.chaseMetres.toFixed(1)],
    ],
  };
}

function formatRatio(r) {
  return r >= 10 ? String(Math.round(r)) : r.toFixed(1);
}

// The board mesh sits right of the TV, facing the viewer at the world origin.
// The caller adds it to the world group and sets mesh.position.y to eye height.
export function createKpiBoard() {
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

  // Centre yaw puts the near edge at NEAR_EDGE_DEG: edge angle = yaw - atan(half width / distance).
  const yaw = THREE.MathUtils.degToRad(NEAR_EDGE_DEG) + Math.atan(WIDTH / 2 / DISTANCE);
  mesh.position.set(DISTANCE * Math.sin(yaw), 0, -DISTANCE * Math.cos(yaw));
  mesh.rotation.y = -yaw;

  function draw(view) {
    const w = canvas.width, h = canvas.height, pad = 28;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 24);
    ctx.fill();

    ctx.textBaseline = 'top';
    ctx.fillStyle = AMBER;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText('Q4 ATTENTION REPORT', pad, pad);
    const top = pad + 40 + 22;

    if (view.message) {
      ctx.fillStyle = CREAM;
      ctx.font = `600 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(view.message, w / 2, (top + h - pad) / 2);
      ctx.textAlign = 'left';
    } else {
      const gap = 14;
      const tileW = (w - 2 * pad - gap) / 2;
      const tileH = (h - top - pad - gap) / 2;
      view.tiles.forEach(([label, value], i) => {
        const x = pad + (i % 2) * (tileW + gap);
        const y = top + Math.floor(i / 2) * (tileH + gap);
        ctx.fillStyle = TILE;
        ctx.beginPath();
        ctx.roundRect(x, y, tileW, tileH, 14);
        ctx.fill();

        ctx.fillStyle = CREAM;
        ctx.font = `500 30px ${FONT}`;
        ctx.fillText(label, x + 20, y + 22);
        let size = 64;
        ctx.font = `700 ${size}px ${FONT}`;
        while (size > 28 && ctx.measureText(value).width > tileW - 40) { // shrink long values to fit
          size -= 4;
          ctx.font = `700 ${size}px ${FONT}`;
        }
        ctx.fillText(value, x + 20, y + 68);
      });
    }
    texture.needsUpdate = true;
  }

  function show(totals) {
    draw(kpiBoardView(totals));
  }

  // Loads totals into the board; shows "Report unavailable" if that fails.
  async function refresh() {
    try {
      show(await fetchTotals());
    } catch (e) {
      console.warn('KPI board: totals failed to load', e.message);
      show(null);
    }
  }

  draw({ message: 'Loading report…' });
  return { mesh, show, refresh };
}
