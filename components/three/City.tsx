"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { BRIDGE_TS, CANAL, ISLET_TS, mulberry32 } from "@/lib/ports";
import { getSurface, getTexture } from "@/lib/textures";
import { MODELS } from "@/lib/models";
import { ModelPlacement } from "@/components/three/PlacedModel";
import { Barrel, Bench, Bush, Crates, Lamppost, Planter, Tree } from "@/components/three/props";
import {
  type BuildingItem,
  Buildings,
  pickTint,
  WALL_TINTS,
} from "@/components/three/buildings";
import type { FacadeStyle } from "@/lib/facades";
import { Platform } from "@/components/three/Landmarks";
import { Gulls } from "@/components/three/wildlife";

/** Ring of quayside houses around the town square, styles mixed like a real street. */
const RING_STYLES: FacadeStyle[] = ["ribeira", "azulejo", "ribeira", "artenova", "ribeira", "azulejo"];

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

/** Real Ponte de Carcavelos spanning the canal; procedural arch is the fallback. */
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
  return (
    <ModelPlacement
      url={MODELS.bridge}
      position={position}
      rotY={rotY}
      size={size}
      yOffset={-0.5}
    >
      <ArchBridge position={[0, 0, 0]} rotY={0} r={r} span={span} />
    </ModelPlacement>
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
    const byStyle = new Map<FacadeStyle, BuildingItem[]>();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rnd() * 0.12;
      const r = 10.6 + rnd() * 0.8;
      const style = RING_STYLES[i % RING_STYLES.length];
      const tints =
        style === "azulejo" ? WALL_TINTS.azulejo : style === "artenova" ? WALL_TINTS.artenova : WALL_TINTS.pastel;
      const list = byStyle.get(style) ?? [];
      list.push({
        x: Math.cos(a) * r,
        y: 0.74,
        z: Math.sin(a) * r,
        rotY: -a + Math.PI / 2 + Math.PI, // face outward, toward the water
        bays: 2 + Math.floor(rnd() * 2),
        depth: 2,
        floors: style === "artenova" ? 3 : 2 + Math.floor(rnd() * 2),
        tint: pickTint(tints, i * 13 + 5),
        chimney: style !== "artenova" && rnd() > 0.4,
      });
      byStyle.set(style, list);
    }
    return [...byStyle.entries()];
  }, []);

  const trees = useMemo(() => {
    const rnd = mulberry32(21);
    return Array.from({ length: 8 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 4 + rnd() * 5;
      return {
        position: [Math.cos(a) * r, 0.7, Math.sin(a) * r] as [number, number, number],
        s: 0.85 + rnd() * 0.8,
      };
    });
  }, []);

  const bushes = useMemo(() => {
    const rnd = mulberry32(57);
    return Array.from({ length: 5 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 4.5 + rnd() * 6.5;
      return {
        position: [Math.cos(a) * r, 0.74, Math.sin(a) * r] as [number, number, number],
        s: 0.8 + rnd() * 0.6,
      };
    });
  }, []);

  return (
    <group position={[-1, 0, 1]}>
      <group scale-y={0.74 / 0.64}>
        <Platform r={14.6} sandy={false} />
      </group>
      {/* the real Igreja das Barrocas is the town centrepiece (chapel = fallback) */}
      <ModelPlacement
        url={MODELS.church}
        position={[0, 0.74, 0]}
        rotY={0.3}
        size={7}
      >
        <Chapel />
      </ModelPlacement>
      {houses.map(([style, items]) => (
        <Buildings key={style} style={style} items={items} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {bushes.map((b, i) => (
        <Bush key={i} position={b.position} s={b.s} />
      ))}
      {/* lampposts ringing the church plaza — brighter, wider pools on the island */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        return (
          <Lamppost key={i} position={[Math.cos(a) * 5.2, 0.74, Math.sin(a) * 5.2]} power={1.7} />
        );
      })}
      {/* benches facing the church */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 1.1;
        return (
          <Bench
            key={i}
            position={[Math.cos(a) * 4.3, 0.74, Math.sin(a) * 4.3]}
            rotY={-a + Math.PI / 2}
          />
        );
      })}
      <Planter position={[2.7, 0.74, 1.3]} rotY={0.5} />
      <Planter position={[-2.5, 0.74, -1.7]} rotY={-0.8} />
      {/* working clutter at the quayside */}
      <Barrel position={[8.6, 0.74, 4.2]} />
      <Barrel position={[9.1, 0.74, 4.7]} s={0.9} />
      <Crates position={[-7.6, 0.74, 6.1]} rotY={0.6} />
      <Crates position={[6.4, 0.74, -7.2]} rotY={-0.5} s={0.85} />
    </group>
  );
}

function Islets() {
  const islets = useMemo(() => {
    const rnd = mulberry32(99);
    return ISLET_TS.map((t, i) => {
      const p = CANAL.getPointAt(t);
      const tan = CANAL.getTangentAt(t);
      const out = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      if (out.dot(p) < 0) out.negate();
      const c = p.clone().addScaledVector(out, 14.5);
      return {
        position: [c.x, 0, c.z] as [number, number, number],
        rotY: Math.atan2(-out.x, -out.z),
        tint: pickTint(WALL_TINTS.pastel, i * 7 + 3),
        treeS: 0.9 + rnd() * 0.6,
      };
    });
  }, []);
  const houses = useMemo(
    () =>
      islets.map(
        (islet): BuildingItem => ({
          x: islet.position[0],
          y: 0.6,
          z: islet.position[2],
          rotY: islet.rotY,
          bays: 2,
          depth: 2,
          floors: 2,
          tint: islet.tint,
          chimney: true,
        })
      ),
    [islets]
  );

  return (
    <>
      <Buildings style="ribeira" items={houses} />
      {islets.map((islet, i) => (
        <group key={i} position={islet.position} rotation-y={islet.rotY}>
          {/* reaches below the swell's troughs, so no gap opens under the edge */}
          <mesh receiveShadow>
            <cylinderGeometry args={[4.2, 5.4, 1.2, 28]} />
            <meshStandardMaterial color="#d9c79a" roughness={1} map={getTexture("sand", 3, 3)} />
          </mesh>
          {/* a scrap of lawn and a fisherman's boat pulled up on the sand */}
          <mesh position={[0.4, 0.61, -1.2]} rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[2.4, 20]} />
            <meshStandardMaterial color="#8fae6b" roughness={1} />
          </mesh>
          <Tree position={[2.4, 0.6, -0.9]} s={islet.treeS} />
          <Bush position={[-2.4, 0.6, -1.4]} />
          <mesh position={[2.2, 0.62, 1.9]} rotation-y={0.5}>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#9d958a" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </>
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
      <Gulls center={[0, 0]} radius={70} />
    </>
  );
}
