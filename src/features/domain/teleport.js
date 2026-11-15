import * as THREE from 'three';

// Gojo's arrival: a thin line of light where he will stand, which bursts as he
// snaps in (the column widens and fades, a ring runs out along the floor, a
// flash at chest height). The caller plays the sound.
// The group's origin is at his feet.

const COLOR = 0x8fd0ff;
const COLUMN_HEIGHT = 2.3; // metres
const LINE_RADIUS = 0.02; // the column before the burst
const COLUMN_RADIUS = 0.32; // and when it has faded
const RING_REACH = 2.4; // metres: the floor ring's final radius
const BURST_RADIUS = 0.75;
const CHEST_HEIGHT = 1.2;
export const BURST_AT = 0.17; // of the effect: the moment he snaps in

const easeOut = (x) => 1 - (1 - x) ** 3;

// Light that is brightest where the surface faces the viewer and fades to
// nothing at its outline, so the column and the flash have soft edges.
function glow(color, side) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 uColor;
      uniform float opacity;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        gl_FragColor = vec4(uColor, opacity * facing * facing);
        #include <colorspace_fragment>
      }
    `,
    side, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

export function createTeleport() {
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, COLUMN_HEIGHT, 24, 1, true), glow(COLOR, THREE.DoubleSide));
  column.position.y = COLUMN_HEIGHT / 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 48),
    new THREE.MeshBasicMaterial({
      color: COLOR, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02; // just off the floor
  const burst = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), glow(0xffffff, THREE.FrontSide));
  burst.position.y = CHEST_HEIGHT;

  const group = new THREE.Group();
  group.add(column, ring, burst);
  group.visible = false;

  return {
    group,

    // progress: 0..1 over the effect; hidden outside that.
    update(progress) {
      group.visible = progress >= 0 && progress < 1;
      if (!group.visible) return;
      const after = THREE.MathUtils.clamp((progress - BURST_AT) / (1 - BURST_AT), 0, 1); // since the burst

      const radius = THREE.MathUtils.lerp(LINE_RADIUS, COLUMN_RADIUS, easeOut(after));
      column.scale.set(radius, 1, radius);
      column.material.uniforms.opacity.value = Math.min(1, progress / (BURST_AT / 2)) * (1 - after) ** 2;

      ring.visible = burst.visible = after > 0;
      ring.scale.setScalar(THREE.MathUtils.lerp(0.15, RING_REACH, easeOut(after)));
      ring.material.opacity = 0.9 * (1 - after);
      burst.scale.setScalar(THREE.MathUtils.lerp(0.1, BURST_RADIUS, easeOut(after)));
      burst.material.uniforms.opacity.value = 0.8 * (1 - after) ** 2;
    },
  };
}
