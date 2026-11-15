import * as THREE from 'three';
import { fetchTotals, onSessionPosted } from '../session-api.js';

// "Q4 Attention Report" board: four KPI cards of real session totals, styled
// like a product-analytics dashboard: big compact number, change vs the
// previous session, and a sparkline of the running total.

// Feature: loads totals on start and again after each session post.
// `world` has the viewer at its origin after calibration, and the TV ahead of it.
export default function kpiBoard({ world, tv }) {
  const { x, z } = tv.group.position;
  const board = createKpiBoard(Math.atan2(x, -z));
  world.add(board.mesh);
  board.refresh();
  onSessionPosted(() => board.refresh());
  const debug = { kpi: board.status };
  return (output) => {
    // Eye height comes from the TV, which calibration sets. The finale may move
    // the TV, so the board stays where it was from then on.
    if (!output.finale) board.mesh.position.y = tv.group.position.y;
    debug.kpi = board.status;
    return { debug };
  };
}

const WIDTH = 0.9; // metres
const HEIGHT = 0.6;
const DISTANCE = 1.8; // metres from the viewer to the board's centre
const PX_PER_METRE = 1000;

// Angle from the TV line (straight ahead, -Z) to the board's nearest edge.
// Look-away starts above 30°, so reading any part of the board trips it.
export const NEAR_EDGE_DEG = 38;

const C = {
  board: '#f5f7fb',
  card: '#ffffff',
  border: '#e1e5ee',
  ink: '#1d2433',
  muted: '#5e6678',
  faint: '#e9ecf2',
  blue: '#1e61f0',
  up: ['#0b8a55', '#e2f5ec'], // text, chip
  down: ['#c8323a', '#fbe6e7'],
  flat: ['#5e6678', '#eef0f5'],
};
const FONT = 'system-ui, sans-serif';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const METRICS = [
  { key: 'sessions', label: 'Sessions', format: (v) => compact.format(v) },
  { key: 'ratio', label: 'Ad : video time', format: (v) => (v === null ? '—' : `${compact.format(v)} : 1`) },
  { key: 'headTurns', label: 'Head turns', format: (v) => compact.format(Math.round(v)) },
  { key: 'chaseMetres', label: 'Metres chased', format: (v) => compact.format(v) },
];

// Change from the previous session's running total to this one's.
function change(history, key) {
  if (history.length < 2) return null;
  const prev = history.at(-2)[key];
  const now = history.at(-1)[key];
  if (prev === null || now === null) return null;
  if (prev === 0) return now > 0 ? { dir: 'up', text: 'new' } : { dir: 'flat', text: '0%' };
  const pct = ((now - prev) / prev) * 100;
  const size = Math.abs(pct);
  if (size < 0.05) return { dir: 'flat', text: '0%' };
  return { dir: pct > 0 ? 'up' : 'down', text: `${size < 10 ? size.toFixed(1) : Math.round(size)}%` };
}

// What the board shows: a message, or four cards { label, value, change, first, series }.
// `totals` is a /api/totals answer, or null when loading failed.
export function kpiBoardView(totals) {
  if (!totals) return { message: 'Report unavailable' };
  if (totals.sessions === 0) return { message: 'No sessions yet' };
  return {
    cards: METRICS.map(({ key, label, format }) => ({
      label,
      value: format(totals[key]),
      change: change(totals.history, key),
      first: totals.history.length < 2,
      series: totals.history.map((h) => h[key]).filter((v) => v !== null),
    })),
  };
}

// The board mesh sits right of the TV, facing the viewer at the world origin.
// `tvYaw` is the TV's direction in radians, clockwise from -Z (0 = straight ahead).
// The caller adds it to the world group and sets mesh.position.y to eye height.
// Exported for checks outside the scene; the feature above is the real user.
export function createKpiBoard(tvYaw = 0) {
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
  const yaw = tvYaw + THREE.MathUtils.degToRad(NEAR_EDGE_DEG) + Math.atan(WIDTH / 2 / DISTANCE);
  mesh.position.set(DISTANCE * Math.sin(yaw), 0, -DISTANCE * Math.cos(yaw));
  mesh.rotation.y = -yaw;

  function text(str, x, y, { size, weight = 600, color = C.ink, align = 'left', base = 'top' }) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function sparkline(series, x, y, w, h) {
    ctx.fillStyle = C.faint;
    ctx.fillRect(x, y + h, w, 2);
    if (!series.length) return;
    const max = Math.max(...series) || 1; // axis starts at 0
    const step = series.length > 1 ? w / (series.length - 1) : 0;
    const pts = series.map((v, i) => [series.length > 1 ? x + i * step : x + w, y + h - (v / max) * h]);

    if (pts.length > 1) {
      const fill = ctx.createLinearGradient(0, y, 0, y + h);
      fill.addColorStop(0, 'rgba(30, 97, 240, 0.22)');
      fill.addColorStop(1, 'rgba(30, 97, 240, 0)');
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    const [lx, ly] = pts.at(-1);
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function changeChip(chg, first, x, y) {
    if (!chg) {
      if (first) text('First session', x, y + 16, { size: 20, weight: 500, color: C.muted, base: 'middle' });
      return;
    }
    const [ink, bg] = C[chg.dir];
    ctx.font = `700 22px ${FONT}`;
    const arrow = chg.dir === 'flat' ? 0 : 18;
    const chipW = 24 + arrow + ctx.measureText(chg.text).width;
    roundRect(x, y, chipW, 32, 8, bg);
    if (arrow) { // triangle drawn as a path: glyph coverage varies on the headset
      const cx = x + 12 + 7, cy = y + 16, up = chg.dir === 'up';
      ctx.beginPath();
      ctx.moveTo(cx - 7, up ? cy + 5 : cy - 5);
      ctx.lineTo(cx + 7, up ? cy + 5 : cy - 5);
      ctx.lineTo(cx, up ? cy - 6 : cy + 6);
      ctx.closePath();
      ctx.fillStyle = ink;
      ctx.fill();
    }
    text(chg.text, x + 12 + arrow, y + 17, { size: 22, weight: 700, color: ink, base: 'middle' });
    text('vs. prev. session', x + chipW + 10, y + 17, { size: 20, weight: 500, color: C.muted, base: 'middle' });
  }

  function draw(view, updated) {
    const w = canvas.width, h = canvas.height, pad = 28;
    ctx.clearRect(0, 0, w, h);
    roundRect(0, 0, w, h, 28, C.board);

    text('Q4 Attention Report', pad + 4, 28, { size: 36, weight: 700 });
    text('Running totals · key-jump runs left out', pad + 4, 74, { size: 22, weight: 500, color: C.muted });
    if (updated) text(`Updated ${updated}`, w - pad - 4, 36, { size: 22, weight: 500, color: C.muted, align: 'right' });
    const top = 116;

    if (view.message) {
      text(view.message, w / 2, (top + h - pad) / 2, { size: 40, align: 'center', base: 'middle' });
    } else {
      const gap = 16;
      const cardW = (w - 2 * pad - gap) / 2;
      const cardH = (h - top - pad - gap) / 2;
      view.cards.forEach((card, i) => {
        const x = pad + (i % 2) * (cardW + gap);
        const y = top + Math.floor(i / 2) * (cardH + gap);
        const inner = cardW - 44;
        roundRect(x, y, cardW, cardH, 14, C.card, C.border);
        text(card.label, x + 22, y + 20, { size: 24, color: C.muted });
        let size = 54;
        ctx.font = `700 ${size}px ${FONT}`;
        while (size > 28 && ctx.measureText(card.value).width > inner) { // shrink long values to fit
          size -= 4;
          ctx.font = `700 ${size}px ${FONT}`;
        }
        text(card.value, x + 22, y + 52, { size, weight: 700 });
        changeChip(card.change, card.first, x + 22, y + 114);
        sparkline(card.series, x + 22, y + 160, inner, cardH - 160 - 20);
      });
    }
    ctx.textAlign = 'left';
    texture.needsUpdate = true;
  }

  const board = { mesh, show, refresh, status: 'loading' };

  function show(totals) {
    board.status = totals ? `sessions ${totals.sessions}` : 'unavailable';
    draw(kpiBoardView(totals), totals ? new Date().toTimeString().slice(0, 5) : null);
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

  draw({ message: 'Loading report…' }, null);
  return board;
}
