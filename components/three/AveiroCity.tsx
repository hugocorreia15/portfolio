"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  AVEIRO_BRIDGES,
  AVEIRO_PORTS,
  CHANNELS,
  CONGRESS_POS,
  MARSH_ISLETS,
  SALINAS_CENTER,
  type Channel,
} from "@/lib/aveiro";
import { mulberry32 } from "@/lib/ports";
import { getSurface } from "@/lib/textures";
import { BridgeModel, Clouds, House, Tree } from "@/components/three/City";
import { SaltPyramid, StripedHouse } from "@/components/three/Landmarks";

const PASTELS = ["#f4d35e", "#ee6c4d", "#3d8ea9", "#e8a87c", "#9bc4bc", "#f2939b", "#d9b26f", "#f3e3c3"];

/** Mitred per-vertex offset of a polyline (side > 0 = left of travel). */
function offsetPolyline(pts: THREE.Vector3[], offset: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1e-6;
    dx /= len;
    dz /= len;
    // left normal, mitre clamped so sharp corners don't explode
    out.push([pts[i].x - dz * offset, pts[i].z + dx * offset]);
  }
  return out;
}

function polygonGeometry(points: Array<[number, number]>, h: number) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % points.length];
    area += x1 * -z2 - x2 * -z1;
  }
  const pts = area < 0 ? [...points].reverse() : points;
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

interface Slot {
  x: number;
  z: number;
  rotY: number;
}

/** Quay strip along one bank of a canal, with building slots facing the water. */
function useQuay(channel: Channel, side: 1 | -1) {
  return useMemo(() => {
    const inner = offsetPolyline(channel.pts, side * (channel.halfW + 0.4));
    const outer = offsetPolyline(channel.pts, side * (channel.halfW + 5.2));
    const geom = polygonGeometry([...inner, ...outer.reverse()], 0.7);

    // building slots along the strip
    const mid = offsetPolyline(channel.pts, side * (channel.halfW + 3.6));
    const slots: Slot[] = [];
    let acc = 0;
    for (let i = 1; i < mid.length; i++) {
      const [ax, az] = mid[i - 1];
      const [bx, bz] = mid[i];
      const segLen = Math.hypot(bx - ax, bz - az);
      let t = (9 - acc) / segLen;
      while (t < 1) {
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        // face the canal
        const dirX = (bx - ax) / segLen;
        const dirZ = (bz - az) / segLen;
        const nx = side * dirZ;
        const nz = -side * dirX;
        slots.push({ x, z, rotY: Math.atan2(nx, nz) });
        t += 9 / segLen;
      }
      acc = (acc + segLen) % 9;
    }
    return { geom, slots };
  }, [channel, side]);
}

const AVOID = [
  ...AVEIRO_PORTS.flatMap((p) => [
    { x: p.dockPos.x, z: p.dockPos.z, r: 13 },
    { x: p.landmarkPos.x, z: p.landmarkPos.z, r: (p.platformR ?? 7) + 4 },
  ]),
  ...AVEIRO_BRIDGES.map((b) => ({ x: b.pos[0], z: b.pos[2], r: b.span / 2 + 7 })),
];

function clearOf(x: number, z: number) {
  for (const a of AVOID) {
    if (Math.hypot(x - a.x, z - a.z) < a.r) return false;
  }
  return true;
}

function QuaySide({
  channel,
  side,
  seed,
  buildings,
}: {
  channel: Channel;
  side: 1 | -1;
  seed: number;
  buildings: "houses" | "warehouses" | "none";
}) {
  const { geom, slots } = useQuay(channel, side);

  const placed = useMemo(() => {
    const rnd = mulberry32(seed);
    return slots
      .filter((s) => clearOf(s.x, s.z))
      .filter((s) => s.x > -60 || buildings === "warehouses") // west of town is salinas/marsh
      .filter(() => rnd() > 0.25)
      .map((s) => ({
        ...s,
        w: 1.5 + rnd() * 0.7,
        h: 1.5 + rnd() * 1.3,
        color: PASTELS[Math.floor(rnd() * PASTELS.length)],
      }));
  }, [slots, seed, buildings]);

  return (
    <group>
      <mesh geometry={geom} receiveShadow>
        <meshStandardMaterial color="#e8e0cf" {...getSurface("calcada", 0.18, 0.18)} />
      </mesh>
      {buildings === "houses" &&
        placed.map((s, i) => (
          <House
            key={i}
            position={[s.x, 0.7, s.z]}
            rotY={s.rotY}
            w={s.w}
            h={s.h}
            color={s.color}
          />
        ))}
      {buildings === "warehouses" &&
        placed
          .filter((_, i) => i % 2 === 0)
          .map((s, i) => (
            <Warehouse key={i} position={[s.x, 0.7, s.z]} rotY={s.rotY + Math.PI / 2} />
          ))}
    </group>
  );
}

/** Long low salt warehouse, São Roque style. */
function Warehouse({
  position,
  rotY = 0,
}: {
  position: [number, number, number];
  rotY?: number;
}) {
  const roof = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.9, 0);
    shape.lineTo(1.9, 0);
    shape.lineTo(0, 1);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 6.4, bevelEnabled: false });
  }, []);
  return (
    <group position={position} rotation-y={rotY}>
      <mesh position-y={0.9} castShadow>
        <boxGeometry args={[3.4, 1.8, 6]} />
        <meshStandardMaterial color="#f4efe2" {...getSurface("plaster", 2.4, 1)} />
      </mesh>
      <mesh geometry={roof} position={[0, 1.8, -3.2]} castShadow>
        <meshStandardMaterial color="#8d7355" {...getSurface("wood", 0.6, 0.6)} />
      </mesh>
      <mesh position={[0, 0.7, 3.02]}>
        <boxGeometry args={[1.3, 1.4, 0.07]} />
        <meshStandardMaterial color="#9a8068" {...getSurface("wood", 0.5, 0.6)} />
      </mesh>
    </group>
  );
}

/** Old ceramics factory — today's Centro de Congressos — with its brick chimney. */
function CongressCenter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={2.4}>
      <mesh position-y={0.34} receiveShadow>
        <cylinderGeometry args={[8, 8.7, 0.68, 24]} />
        <meshStandardMaterial color="#d9cba6" roughness={1} />
      </mesh>
      <group position-y={0.68}>
        <mesh position-y={1.5} castShadow>
          <boxGeometry args={[7, 3, 4]} />
          <meshStandardMaterial color="#ffffff" {...getSurface("brick", 4, 1.8)} />
        </mesh>
        <mesh position-y={3.08}>
          <boxGeometry args={[7.2, 0.16, 4.2]} />
          <meshStandardMaterial color="#f5f1e6" roughness={0.85} />
        </mesh>
        <mesh position={[2, 1.1, 2.05]}>
          <boxGeometry args={[1.4, 1.8, 0.08]} />
          <meshStandardMaterial color="#27434f" roughness={0.35} />
        </mesh>
        <mesh position={[-4.6, 4.5, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.85, 9, 12]} />
          <meshStandardMaterial color="#8f3525" roughness={1} />
        </mesh>
        <mesh position={[-4.6, 9.1, 0]}>
          <cylinderGeometry args={[0.75, 0.6, 0.5, 12]} />
          <meshStandardMaterial color="#7c2d1f" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

function SaltPan({
  position,
  w,
  d,
  heap = true,
}: {
  position: [number, number, number];
  w: number;
  d: number;
  heap?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position-y={0.11} receiveShadow>
        <boxGeometry args={[w, 0.22, d]} />
        <meshStandardMaterial color="#e8ddc2" roughness={1} />
      </mesh>
      <mesh position-y={0.24}>
        <boxGeometry args={[w - 0.8, 0.06, d - 0.8]} />
        <meshStandardMaterial color="#cfe2da" roughness={0.5} />
      </mesh>
      {heap && <SaltPyramid position={[w * 0.22, 0.7, d * 0.1]} r={0.85} h={1.25} />}
    </group>
  );
}

export default function AveiroCity() {
  const cityChannels = CHANNELS.filter((c) => c.city);
  const [sx, sz] = SALINAS_CENTER;

  return (
    <>
      {/* quays + buildings generated along the real canal centrelines */}
      {cityChannels.map((c, i) => (
        <group key={`${c.name ?? "canal"}-${i}`}>
          <QuaySide
            channel={c}
            side={1}
            seed={i * 7 + 1}
            buildings={/São Roque/i.test(c.name ?? "") ? "warehouses" : "houses"}
          />
          <QuaySide channel={c} side={-1} seed={i * 7 + 4} buildings="houses" />
        </group>
      ))}

      {/* salinas around the Marinha da Troncalhada */}
      <SaltPan position={[sx - 4, 0, sz - 10]} w={11} d={7} />
      <SaltPan position={[sx + 9, 0, sz - 4]} w={9} d={6} />
      <SaltPan position={[sx - 13, 0, sz + 1]} w={8} d={5.5} heap={false} />
      <SaltPan position={[sx + 3, 0, sz - 18]} w={7} d={4.5} />

      <CongressCenter position={CONGRESS_POS} />

      {/* the open ria */}
      {MARSH_ISLETS.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position-y={0.16} receiveShadow>
            <cylinderGeometry args={[m.r, m.r + 0.8, 0.32, 20]} />
            <meshStandardMaterial color="#9fae74" roughness={1} />
          </mesh>
          {i % 2 === 0 && <Tree position={[m.r * 0.3, 0.32, 0]} s={0.7} />}
        </group>
      ))}

      {/* dunes and extra palheiros near Costa Nova */}
      <mesh position={[-172, 0.2, 33]} rotation-y={0.4} receiveShadow>
        <boxGeometry args={[18, 0.5, 7]} />
        <meshStandardMaterial color="#ecdfbe" roughness={1} />
      </mesh>
      <StripedHouse position={[-169, 0.45, 31]} color="#d6452e" stripes={5} />
      <StripedHouse position={[-175, 0.45, 35.5]} color="#2e8b57" stripes={5} />

      {AVEIRO_BRIDGES.map((b, i) => (
        <BridgeModel key={i} position={b.pos} rotY={b.rotY} r={b.r} span={b.span} />
      ))}

      <Clouds />
    </>
  );
}
