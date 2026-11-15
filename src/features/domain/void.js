import * as THREE from 'three';

// The domain's space: a dark orb that grows out of Gojo's hand, a white flash
// as it swallows the viewer, and the void around them afterwards (a black
// hole with a bright ring straight ahead and streaks of light running out of it).
// All three are centred on the viewer except the orb, which the caller places.

const VOID_RADIUS = 40; // metres: beyond everything else, inside the camera's far plane
const FLASH_RADIUS = 8; // as the room tint's shell
const FLASH_RENDER_ORDER = 30; // over everything, the banner included
const ORB_START_RADIUS = 0.05;

const VOID_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Cheap on purpose: it covers the whole view in both eyes.
const VOID_FRAGMENT = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;
  const float PI = 3.14159265;
  const float LANES = 150.0;
  const float RING = 0.30; // radians from the hole's centre

  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

  void main() {
    vec3 d = normalize(vDir);
    vec3 hole = normalize(vec3(0.0, 0.32, -1.0)); // ahead of the viewer and a little up
    vec3 right = normalize(cross(hole, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, hole);
    float ang = acos(clamp(dot(d, hole), -1.0, 1.0));
    float phi = atan(dot(d, up), dot(d, right));

    // Deep purple that brightens toward the hole, with slow blue bands.
    vec3 col = mix(vec3(0.012, 0.0, 0.05), vec3(0.11, 0.03, 0.32), smoothstep(2.6, 0.3, ang));
    col += vec3(0.04, 0.2, 0.5) * 0.3 * (0.5 + 0.5 * sin(phi * 3.0 + ang * 6.0 - uTime * 0.4));

    // Streaks running outward along lanes around the hole.
    float lanePos = (phi + PI) / (2.0 * PI) * LANES;
    float seed = hash(floor(lanePos));
    float along = fract(ang * (0.6 + seed) - uTime * (0.15 + seed * 0.5) + seed * 10.0);
    float across = fract(lanePos);
    float streak = smoothstep(0.9, 1.0, along) * step(0.5, seed)
      * smoothstep(0.0, 0.35, across) * smoothstep(1.0, 0.65, across);
    col += vec3(0.75, 0.85, 1.0) * streak * smoothstep(RING, RING + 0.25, ang);

    // The ring and its glow; inside it is black.
    col += vec3(0.45, 0.65, 1.0) * 0.7 * exp(-pow((ang - RING) / 0.16, 2.0));
    col *= smoothstep(RING - 0.07, RING - 0.01, ang);
    col += vec3(1.0, 0.97, 0.9) * 2.0 * exp(-pow((ang - RING) / 0.03, 2.0));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createVoid() {
  const uniforms = { uTime: { value: 0 } };
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(VOID_RADIUS, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VOID_VERTEX,
      fragmentShader: VOID_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  shell.renderOrder = -1; // behind everything in the domain
  shell.frustumCulled = false;
  shell.visible = false;

  // Seen from outside while it grows, from inside once it passes the viewer.
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x06021a, side: THREE.DoubleSide }),
  );
  const orbGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0x5f8dff, transparent: true, opacity: 0.35, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  orb.add(orbGlow);
  orb.visible = false;

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(FLASH_RADIUS, 16, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, side: THREE.BackSide,
      depthTest: false, depthWrite: false,
    }),
  );
  flash.renderOrder = FLASH_RENDER_ORDER;
  flash.frustumCulled = false;
  flash.visible = false;

  return {
    shell, // centre these two on the viewer
    flash,
    orb, // place this at the hand

    setShell(on, time) {
      shell.visible = on;
      uniforms.uTime.value = time;
    },

    // grow: 0 = hidden, 0..1 = growing to `reach` metres, the distance to the viewer.
    setOrb(grow, reach) {
      orb.visible = grow > 0 && grow < 1;
      if (orb.visible) orb.scale.setScalar(THREE.MathUtils.lerp(ORB_START_RADIUS, reach * 1.1, grow * grow));
    },

    // opacity: 0 = hidden … 1 = white-out.
    setFlash(opacity) {
      flash.visible = opacity > 0.005;
      flash.material.opacity = opacity;
    },
  };
}
