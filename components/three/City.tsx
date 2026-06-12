"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BRIDGE_TS, CANAL, mulberry32 } from "@/lib/ports";

const PASTELS = ["#f4d35e", "#ee6c4d", "#3d8ea9", "#e8a87c", "#9bc4bc", "#f2939b", "#d9b26f"];

export function House({
  position,
  rotY = 0,
  w = 1.6,
  h = 1.6,
  color = "#f4d35e",
  roof = "#a14a32",
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
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position-y={h + h * 0.3} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[w * 0.8, h * 0.62, 4]} />
        <meshStandardMaterial color={roof} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, h * 0.27, w * 0.44]}>
        <boxGeometry args={[w * 0.22, h * 0.5, 0.06]} />
        <meshStandardMaterial color="#3d2c1f" />
      </mesh>
    </group>
  );
}

export function Tree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.35} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 0.7, 6]} />
        <meshStandardMaterial color="#6b4a2c" roughness={1} />
      </mesh>
      <mesh position-y={0.95} castShadow>
        <sphereGeometry args={[0.48, 10, 8]} />
        <meshStandardMaterial color="#5e9c52" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.22, 1.25, 0.08]} castShadow>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#74b262" roughness={1} flatShading />
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
        <meshStandardMaterial color="#e9e2d2" side={THREE.DoubleSide} roughness={0.9} />
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

function Bridge({ t }: { t: number }) {
  const { pos, rotY } = useMemo(() => {
    const p = CANAL.getPointAt(t);
    const tan = CANAL.getTangentAt(t);
    return { pos: [p.x, 0, p.z] as [number, number, number], rotY: Math.atan2(tan.x, tan.z) };
  }, [t]);
  return <ArchBridge position={pos} rotY={rotY} />;
}

function Chapel() {
  return (
    <group>
      <mesh position-y={1.1} castShadow>
        <boxGeometry args={[2.6, 2.2, 2.1]} />
        <meshStandardMaterial color="#f7f1e3" roughness={0.85} />
      </mesh>
      <mesh position-y={2.75} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.7, 1.1, 4]} />
        <meshStandardMaterial color="#b35338" roughness={0.95} flatShading />
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
        <meshStandardMaterial color="#e2cf9f" roughness={1} />
      </mesh>
      <mesh position-y={0.74} receiveShadow>
        <cylinderGeometry args={[13.6, 13.6, 0.1, 48]} />
        <meshStandardMaterial color="#d9c697" roughness={1} />
      </mesh>
      <group position-y={0.74}>
        <Chapel />
      </group>
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
            <meshStandardMaterial color="#ffffff" transparent opacity={0.92} />
          </mesh>
          <mesh position={[2.4, -0.3, 0.4]}>
            <sphereGeometry args={[1.8, 10, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.92} />
          </mesh>
          <mesh position={[-2.3, -0.4, -0.3]}>
            <sphereGeometry args={[1.6, 10, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.92} />
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
