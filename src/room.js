import * as THREE from 'three';

// Cozy living room from basic shapes. Coordinates are relative to the viewer:
// the viewer's head is above (0, 0) on the floor, looking down -Z at the TV.

const mat = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

export function buildRoom(parent) {
  const room = new THREE.Group();

  // Floor and walls (room 5 m wide, 6 m deep, 2.8 m high)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), mat(0x7a5233));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -0.5;
  room.add(floor);

  const wallColor = 0xd9c3a5;
  const walls = [
    { w: 5, x: 0, z: -2.6, ry: 0 }, // behind the TV
    { w: 5, x: 0, z: 2.4, ry: Math.PI }, // behind the couch
    { w: 6, x: -2.5, z: -0.1, ry: Math.PI / 2 },
    { w: 6, x: 2.5, z: -0.1, ry: -Math.PI / 2 },
  ];
  for (const { w, x, z, ry } of walls) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.8), mat(wallColor));
    wall.position.set(x, 1.4, z);
    wall.rotation.y = ry;
    room.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), mat(0xefe4d2));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 2.8, -0.1);
  room.add(ceiling);

  // Rug between couch and TV
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), mat(0x9b2d30));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.005, -1.1);
  room.add(rug);

  // Couch the viewer sits on (seat under the viewer, back just behind)
  const couch = 0x3d5a80;
  room.add(box(2.0, 0.42, 0.8, couch, 0, 0.21, 0.15)); // seat
  room.add(box(2.0, 0.8, 0.22, couch, 0, 0.6, 0.6)); // back
  room.add(box(0.22, 0.62, 0.8, couch, -1.1, 0.31, 0.15)); // arms
  room.add(box(0.22, 0.62, 0.8, couch, 1.1, 0.31, 0.15));

  // TV cabinet under the screen
  room.add(box(1.9, 0.5, 0.4, 0x4a3426, 0, 0.25, -2.35));

  // Floor lamp in the corner with the room's one point light
  const lampX = 1.7, lampZ = -1.9;
  room.add(box(0.3, 0.04, 0.3, 0x222222, lampX, 0.02, lampZ)); // base
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), mat(0x222222));
  pole.position.set(lampX, 0.77, lampZ);
  room.add(pole);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 0.3, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide }),
  );
  shade.position.set(lampX, 1.6, lampZ);
  room.add(shade);
  const lampLight = new THREE.PointLight(0xffc27a, 6, 0, 2);
  lampLight.position.set(lampX, 1.55, lampZ);
  room.add(lampLight);

  // Warm ambient fill
  room.add(new THREE.HemisphereLight(0xffe6c4, 0x3a2a1e, 1.6));

  parent.add(room);
  return room;
}
