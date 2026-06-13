"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BRIDGE_TS, CANAL, mulberry32 } from "@/lib/ports";
import { getSurface, getTexture } from "@/lib/textures";
import { OptionalGlb, useModelFile } from "@/components/three/PlacedModel";

const PASTELS = ["#f4d35e", "#ee6c4d", "#3d8ea9", "#e8a87c", "#9bc4bc", "#f2939b", "#d9b26f"];

export function House({
  position,
  rotY = 0,
  w = 1.6,
  h = 1.6,
  color = "#f4d35e",
  roof = "#e6cdbd",
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  color?: string;
  roof?: string;
}) {
  return (
    <group position={position} rotation-y={rotY}>
      <mesh position-y={h / 2} castShadow>
        <boxGeometry args={[w, h, w * 0.85]} />
        <meshStandardMaterial color={color} {...getSurface("plaster", 1.5, 1)} />
      </mesh>
      <mesh position-y={h + h * 0.3} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[w * 0.8, h * 0.62, 4]} />
        <meshStandardMaterial color={roof} {...getSurface("roofTiles", 1.8, 1.2)} />
      </mesh>
      <mesh position={[0, h * 0.27, w * 0.44]}>
        <boxGeometry args={[w * 0.22, h * 0.5, 0.06]} />
        <meshStandardMaterial color="#cbb9a4" {...getSurface("wood", 0.35, 0.7)} />
      </mesh>
    </group>
  );
}

export function Tree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.35} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 0.7, 6]} />
        <meshStandardMaterial color="#9b8266" {...getSurface("wood", 0.5, 1)} />
      </mesh>
      <mesh position-y={0.95} castShadow>
        <sphereGeometry args={[0.48, 12, 10]} />
        <meshStandardMaterial
          color="#5e9c52"
          roughness={1}
          map={getTexture("foliage", 1.5, 1.5)}
          bumpMap={getTexture("foliage", 1.5, 1.5)}
          bumpScale={0.06}
        />
      </mesh>
      <mesh position={[0.22, 1.25, 0.08]} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial
          color="#74b262"
          roughness={1}
          map={getTexture("foliage", 1.2, 1.2)}
          bumpMap={getTexture("foliage", 1.2, 1.2)}
          bumpScale={0.05}
        />
      </mesh>
    </group>
  );
}

export function ArchBridge({
  position,
  rotY,
  r = 3.6,
  span = 3.4,
}: {
  position: [number, number, number];
  rotY: number;
  r?: number;
  span?: number;
}) {
  return (
    <group position={position} rotation-y={rotY}>
      {/* arch shell — the boat sails through the opening */}
      <mesh rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[r, r, span, 28, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial
          color="#e9e2d2"
          side={THREE.DoubleSide}
          {...getSurface("plaster", 4, 1)}
        />
      </mesh>
      {/* railings along both edges of the deck */}
      {[-(span / 2 - 0.1), span / 2 - 0.1].map((z) => (
        <mesh key={z} position-z={z}>
          <torusGeometry args={[r + 0.06, 0.07, 8, 28, Math.PI]} />
          <meshStandardMaterial color="#c8bfa8" roughness={0.8} />
        </mesh>
      ))}
      {/* abutments resting on the banks (drafted deep so waves never expose them) */}
      {[-(r + 0.3), r + 0.3].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[1.7, 2.2, span + 0.2]} />
          <meshStandardMaterial color="#ddd5c2" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

const RIBBON_COLORS = [
  "#e5484d", "#f2a73d", "#f2d43d", "#3fa45b",
  "#3d8ad9", "#7a52c9", "#e3559e", "#f4efe6",
];

const BRIDGE_GLB = "/models/ponte-carcavelos.glb";

/** The real Ponte de Carcavelos, with ribbons measured onto its actual deck. */
function BridgeGlb({ size, seed }: { size: number; seed: number }) {
  const { scene } = useGLTF(BRIDGE_GLB);

  const { obj, dims } = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(o);
    const sz = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    o.position.sub(ctr);
    // keep the model's native orientation (the group's rotY aligns it to the canal)
    const longest = Math.max(sz.x, sz.z);
    const s = size / longest;
    const wrap = new THREE.Group();
    wrap.add(o);
    wrap.scale.setScalar(s);
    const groundY = -0.5;
    wrap.position.y = (sz.y * s) / 2 + groundY;
    return {
      obj: wrap,
      dims: {
        // the deck span is always local X (matches the procedural arch + rotY);
        // local Z can be longer because the capture includes the canal banks.
        spanX: sz.x * s,
        topH: sz.y * s,
        groundY,
      },
    };
  }, [scene, size]);

  const ribbons = useMemo(() => {
    const rnd = mulberry32(seed);
    const { spanX, topH, groundY } = dims;
    const half = spanX * 0.34; // along the span, central portion
    const zEdge = spanX * 0.12; // deck railing offset (walkway is narrow)
    const railY = groundY + topH * 0.5; // railing height (below any lamp/finial)
    const out: Array<{
      x: number;
      z: number;
      topY: number;
      h: number;
      c: string;
      tilt: number;
    }> = [];
    for (const z of [zEdge, -zEdge]) {
      const n = Math.max(8, Math.round((half * 2) / 0.24));
      for (let i = 0; i < n; i++) {
        const x = -half + (i + 0.5) * ((half * 2) / n);
        const u = x / half;
        const topY = railY - topH * 0.08 * u * u; // gentle dip toward the ends
        out.push({
          x,
          z,
          topY,
          h: 0.3 + rnd() * 0.4,
          c: RIBBON_COLORS[Math.floor(rnd() * RIBBON_COLORS.length)],
          tilt: (rnd() - 0.5) * 0.4,
        });
      }
    }
    return out;
  }, [dims, seed]);

  return (
    <group>
      <primitive object={obj} />
      {ribbons.map((rb, i) => (
        <mesh key={i} position={[rb.x, rb.topY - rb.h / 2, rb.z]} rotation-z={rb.tilt}>
          <boxGeometry args={[0.08, rb.h, 0.03]} />
          <meshStandardMaterial color={rb.c} roughness={0.65} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Real Ponte de Carcavelos (a ribbon bridge) spanning the canal; procedural arch is the fallback. */
export function BridgeModel({
  position,
  rotY,
  r = 3.6,
  span = 3.4,
}: {
  position: [number, number, number];
  rotY: number;
  r?: number;
  span?: number;
}) {
  const size = THREE.MathUtils.clamp(r * 2.9, 10, 16);
  const seed = Math.round(position[0] * 7 + position[2] * 13);
  const has = useModelFile(BRIDGE_GLB);
  return (
    <group position={position} rotation-y={rotY}>
      {has ? (
        <Suspense fallback={<ArchBridge position={[0, 0, 0]} rotY={0} r={r} span={span} />}>
          <BridgeGlb size={size} seed={seed} />
        </Suspense>
      ) : (
        <ArchBridge position={[0, 0, 0]} rotY={0} r={r} span={span} />
      )}
    </group>
  );
}

function Bridge({ t }: { t: number }) {
  const { pos, rotY } = useMemo(() => {
    const p = CANAL.getPointAt(t);
    const tan = CANAL.getTangentAt(t);
    return { pos: [p.x, 0, p.z] as [number, number, number], rotY: Math.atan2(tan.x, tan.z) };
  }, [t]);
  return <BridgeModel position={pos} rotY={rotY} />;
}

function Chapel() {
  return (
    <group>
      <mesh position-y={1.1} castShadow>
        <boxGeometry args={[2.6, 2.2, 2.1]} />
        <meshStandardMaterial color="#f7f1e3" {...getSurface("plaster", 2, 1.6)} />
      </mesh>
      <mesh position-y={2.75} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.7, 1.1, 4]} />
        <meshStandardMaterial color="#deb9a4" {...getSurface("roofTiles", 2, 1)} />
      </mesh>
      <mesh position={[1.85, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.55, 3.6, 10]} />
        <meshStandardMaterial color="#f7f1e3" roughness={0.85} />
      </mesh>
      <mesh position={[1.85, 3.85, 0]} castShadow>
        <sphereGeometry args={[0.62, 14, 12]} />
        <meshStandardMaterial color="#1e4f8f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 1.08]}>
        <boxGeometry args={[0.6, 1.3, 0.07]} />
        <meshStandardMaterial color="#4a3320" />
      </mesh>
    </group>
  );
}

function MainIsland() {
  const houses = useMemo(() => {
    const rnd = mulberry32(7);
    return Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * Math.PI * 2 + rnd() * 0.25;
      const r = 10.4 + rnd() * 1.4;
      return {
        position: [Math.cos(a) * r, 0.7, Math.sin(a) * r] as [number, number, number],
        rotY: -a + Math.PI / 2 + Math.PI, // face outward, toward the water
        w: 1.4 + rnd() * 0.7,
        h: 1.4 + rnd() * 1.1,
        color: PASTELS[Math.floor(rnd() * PASTELS.length)],
      };
    });
  }, []);

  const trees = useMemo(() => {
    const rnd = mulberry32(21);
    return Array.from({ length: 7 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 4 + rnd() * 4.5;
      return {
        position: [Math.cos(a) * r, 0.7, Math.sin(a) * r] as [number, number, number],
        s: 0.8 + rnd() * 0.7,
      };
    });
  }, []);

  return (
    <group position={[-1, 0, 1]}>
      <mesh position-y={0.35} receiveShadow>
        <cylinderGeometry args={[14.5, 15.2, 0.7, 48]} />
        <meshStandardMaterial color="#e2cf9f" roughness={1} map={getTexture("sand", 6, 6)} />
      </mesh>
      <mesh position-y={0.74} receiveShadow>
        <cylinderGeometry args={[13.6, 13.6, 0.1, 48]} />
        <meshStandardMaterial color="#e3d8c0" {...getSurface("calcada", 8, 8)} />
      </mesh>
      {/* the real Igreja das Barrocas is the town centrepiece (chapel = fallback) */}
      <OptionalGlb
        url="/models/igreja-barrocas.glb"
        position={[0, 0.74, 0]}
        rotY={0.3}
        size={7}
      >
        <group position-y={0.74}>
          <Chapel />
        </group>
      </OptionalGlb>
      {houses.map((h, i) => (
        <House key={i} {...h} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </group>
  );
}

function Islets() {
  const islets = useMemo(() => {
    const rnd = mulberry32(99);
    return [0.255, 0.59, 0.925].map((t) => {
      const p = CANAL.getPointAt(t);
      const tan = CANAL.getTangentAt(t);
      const out = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      if (out.dot(p) < 0) out.negate();
      const c = p.clone().addScaledVector(out, 14.5);
      return {
        position: [c.x, 0, c.z] as [number, number, number],
        rotY: rnd() * Math.PI * 2,
        color: PASTELS[Math.floor(rnd() * PASTELS.length)],
        treeS: 0.9 + rnd() * 0.6,
      };
    });
  }, []);

  return (
    <>
      {islets.map((islet, i) => (
        <group key={i} position={islet.position}>
          <mesh position-y={0.3} receiveShadow>
            <cylinderGeometry args={[4.2, 4.8, 0.6, 24]} />
            <meshStandardMaterial color="#e2cf9f" roughness={1} />
          </mesh>
          <House position={[-1, 0.6, 0.4]} rotY={islet.rotY} color={islet.color} />
          <Tree position={[1.6, 0.6, -0.9]} s={islet.treeS} />
          <mesh position={[1.1, 0.62, 1.6]} rotation-y={islet.rotY}>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#9d958a" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Clouds() {
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    group.current?.children.forEach((cloud, i) => {
      cloud.position.x += dt * (0.35 + i * 0.08);
      if (cloud.position.x > 130) cloud.position.x = -130;
    });
  });

  const clouds: Array<[number, number, number]> = [
    [-40, 20, -35],
    [30, 25, -60],
    [-75, 18, 18],
    [55, 23, 38],
  ];

  return (
    <group ref={group}>
      {clouds.map((pos, i) => (
        <group key={i} position={pos} scale={[1 + i * 0.2, 0.55, 1]}>
          <mesh>
            <sphereGeometry args={[2.6, 10, 8]} />
            <meshStandardMaterial color="#ffdfc0" transparent opacity={0.9} />
          </mesh>
          <mesh position={[2.4, -0.3, 0.4]}>
            <sphereGeometry args={[1.8, 10, 8]} />
            <meshStandardMaterial color="#ffd2ac" transparent opacity={0.9} />
          </mesh>
          <mesh position={[-2.3, -0.4, -0.3]}>
            <sphereGeometry args={[1.6, 10, 8]} />
            <meshStandardMaterial color="#ffdfc0" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function City() {
  return (
    <>
      <MainIsland />
      <Islets />
      {BRIDGE_TS.map((t) => (
        <Bridge key={t} t={t} />
      ))}
      <Clouds />
    </>
  );
}
