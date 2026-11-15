import * as THREE from 'three';

// WRAPZILLA gate meter (reference still 6): a volume bar beside the TV with a
// dashed line to cross. `group` goes in the TV group, to the right of the screen.
// Call update() every frame with the attention output's gate meter,
// { visible, level, line }. It hides when there is no meter: any other ad, or
// clap mode. The gate label isn't drawn here; the gate rule puts it in the
// banner, which the banner feature draws.

const WIDTH = 0.15; // metres
const HEIGHT = 0.9; // same as the TV screen
// Centre, TV-local: about 8 cm right of the bezel. At 2.2 m that's about 24° off the
// TV line, under look-away's 30°, so watching the meter doesn't pause the ad.
const X = 1.0;
const PAD = 0.012; // fill inset from the card edge
const RADIUS = 0.02;
// The line sits 75% up the bar, as in still 6, so the bar tops out at line / 0.75.
const LINE_AT = 0.75;
const LINE_OVERHANG = 0.022; // each side, past the card
const LINE_THICKNESS = 0.016;
const DASHES = 4;
// Fast rise, slow fall (per frame), so a shout stays readable for a moment.
const FALL = 0.95;

const PANEL = new THREE.Color(0x140e0a); // panels.js card colour
const AMBER = new THREE.Color(0xe9a03b);
const TEAL = new THREE.Color(0x2a9d8f);

function roundedRect(w, h, r) {
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s);
}

export function createGateMeter() {
  const group = new THREE.Group();
  group.position.x = X;
  group.visible = false;

  group.add(new THREE.Mesh(
    roundedRect(WIDTH, HEIGHT, RADIUS),
    new THREE.MeshBasicMaterial({ color: PANEL, transparent: true, opacity: 0.82 }),
  ));

  // Fill: amber at its top, teal at its base, grown upward by scaling y.
  const track = HEIGHT - 2 * PAD;
  const fillGeometry = new THREE.PlaneGeometry(WIDTH - 2 * PAD, 1);
  fillGeometry.translate(0, 0.5, 0);
  // PlaneGeometry vertex order: top-left, top-right, bottom-left, bottom-right.
  const colors = [AMBER, AMBER, TEAL, TEAL].flatMap((c) => [c.r, c.g, c.b]);
  fillGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const fill = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  fill.position.set(0, -track / 2, 0.002);
  group.add(fill);

  const lineWidth = WIDTH + 2 * LINE_OVERHANG;
  const dash = lineWidth / (2 * DASHES - 1); // dashes and gaps the same length
  const dashGeometry = new THREE.PlaneGeometry(dash, LINE_THICKNESS);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const line = new THREE.Group();
  for (let i = 0; i < DASHES; i++) {
    const d = new THREE.Mesh(dashGeometry, white);
    d.position.x = -lineWidth / 2 + dash * (2 * i + 0.5);
    line.add(d);
  }
  line.position.set(0, -track / 2 + LINE_AT * track, 0.004);
  group.add(line);

  let shown = 0;

  function update(meter) {
    group.visible = Boolean(meter?.visible);
    if (!group.visible) {
      shown = 0;
      return;
    }
    shown = Math.max(meter.level ?? 0, shown * FALL);
    const top = meter.line / LINE_AT;
    fill.scale.y = Math.max(1e-4, Math.min(1, shown / top) * track);
  }

  return { group, update };
}
