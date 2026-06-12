import * as THREE from "three";
import { BRIDGE_TS, CANAL, PORTS } from "@/lib/ports";

export interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

function frameAt(t: number) {
  const p = CANAL.getPointAt(t);
  const tan = CANAL.getTangentAt(t);
  const out = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  if (out.dot(p) < 0) out.negate();
  return { p, tan, out };
}

export const COLLIDERS: CircleCollider[] = (() => {
  const list: CircleCollider[] = [
    // main town island
    { x: -1, z: 1, r: 15.8 },
  ];
  for (const port of PORTS) {
    // landmark island
    list.push({ x: port.landmarkPos.x, z: port.landmarkPos.z, r: 8.2 });
    // outer half of the pier (inner half stays clear so the boat can moor)
    const pier = port.point.clone().addScaledVector(port.outward, 3.2);
    list.push({ x: pier.x, z: pier.z, r: 0.9 });
  }
  // keep in sync with the islets in components/three/City.tsx
  for (const t of [0.255, 0.59, 0.925]) {
    const { p, out } = frameAt(t);
    const c = p.clone().addScaledVector(out, 14.5);
    list.push({ x: c.x, z: c.z, r: 5.3 });
  }
  // bridge abutments — force passage through the arch
  for (const t of BRIDGE_TS) {
    const { p, tan } = frameAt(t);
    const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    for (const side of [-3.9, 3.9]) {
      list.push({ x: p.x + perp.x * side, z: p.z + perp.z * side, r: 1.7 });
    }
  }
  return list;
})();

export const WORLD_RADIUS = 58;
export const BOAT_RADIUS = 2.0;

/** Push pos out of every collider (and back inside the lagoon). Returns true on contact. */
export function resolveCollisions(pos: THREE.Vector3, radius = BOAT_RADIUS): boolean {
  let hit = false;
  for (const c of COLLIDERS) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const min = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.001;
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
      hit = true;
    }
  }
  const dist = Math.hypot(pos.x, pos.z);
  if (dist > WORLD_RADIUS) {
    pos.x *= WORLD_RADIUS / dist;
    pos.z *= WORLD_RADIUS / dist;
    hit = true;
  }
  return hit;
}
