"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BEACON, DAY } from "@/lib/daynight";
import type { PortDef } from "@/lib/ports";
import { getSurface, getTexture } from "@/lib/textures";
import { getWindowGlassMaterial } from "@/lib/nightMaterials";
import { registerLamps } from "@/lib/lampLights";
import { Barrel, Bench, Bush, Crates, Lamppost, Planter, Tree } from "@/components/three/props";
import { type BuildingItem, Buildings } from "@/components/three/buildings";
import { Flamingos } from "@/components/three/wildlife";

const _bd = new THREE.Vector3();
const _bq = new THREE.Quaternion();

const at = (
  x: number,
  z: number,
  bays: number,
  floors: number,
  tint: string,
  extra: Partial<BuildingItem> = {}
): BuildingItem => ({ x, y: 0, z, rotY: 0, bays, depth: 2, floors, tint, ...extra });

// ── salinas ─────────────────────────────────────────────────────────────────

/** A shallow evaporation pan: clay rim and a sheet of glassy brine. */
function SaltPan({
  position,
  w,
  d,
  brine = "#cfe4e0",
}: {
  position: [number, number, number];
  w: number;
  d: number;
  brine?: string;
}) {
  return (
    <group position={position}>
      <mesh position-y={0.06} receiveShadow>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial color="#b49c74" roughness={1} />
      </mesh>
      <mesh position-y={0.125} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - 0.22, d - 0.22]} />
        <meshStandardMaterial color={brine} roughness={0.08} metalness={0.2} envMapIntensity={1.4} />
      </mesh>
    </group>
  );
}

export function SaltHeap({
  position,
  r,
  h,
}: {
  position: [number, number, number];
  r: number;
  h: number;
}) {
  return (
    <mesh position={[position[0], position[1] + h / 2, position[2]]} castShadow receiveShadow>
      <coneGeometry args={[r, h, 18, 3]} />
      <meshStandardMaterial color="#fbfaf5" roughness={0.75} map={getTexture("sand", 2, 2)} />
    </mesh>
  );
}

function Salinas() {
  return (
    <group>
      <SaltPan position={[-2.5, 0, -2.3]} w={3} d={2.2} />
      <SaltPan position={[0.75, 0, -2.3]} w={3} d={2.2} brine="#d9e6d8" />
      <SaltPan position={[-2.5, 0, 0.2]} w={3} d={2.2} brine="#e3dcd0" />
      <SaltPan position={[0.75, 0, 0.2]} w={3} d={2.2} />
      {/* raked salt drying in heaps along the bank */}
      <SaltHeap position={[3.3, 0, 0.9]} r={0.85} h={1.15} />
      <SaltHeap position={[2.4, 0, 1.9]} r={0.6} h={0.82} />
      <SaltHeap position={[4.2, 0, 1.9]} r={0.55} h={0.72} />
      {/* plank walkway between the pans */}
      <mesh position={[-0.88, 0.07, -1.05]}>
        <boxGeometry args={[6.6, 0.06, 0.32]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 2, 0.3)} />
      </mesh>
      <Buildings style="armazem" items={[at(3.7, -2.2, 2, 1, "#ffffff", { depth: 2 })]} />
      <Flamingos
        spots={[
          { position: [-3.1, 0.12, -2.6], rotY: 0.6 },
          { position: [-2.2, 0.12, -1.9], rotY: 2.4 },
          { position: [1.2, 0.12, -2.7], rotY: -1.2 },
          { position: [-1.9, 0.12, 0.5], rotY: 1.8 },
          { position: [0.3, 0.12, 0.6], rotY: -2.6 },
        ]}
      />
    </group>
  );
}

// ── the old ceramics factory (Publications) ─────────────────────────────────

/** Sawtooth roof profile: steep glazed face, long slope. */
function useSawtoothGeometry(w: number, h: number, d: number) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2 - w * 0.12, h);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geom.translate(0, 0, -d / 2);
    return geom;
  }, [w, h, d]);
}

/** Fábrica Jerónimo Pereira Campos — the brick ceramics factory that became
 *  Aveiro's congress centre: a long hall under sawtooth roofs, two chimneys. */
function Factory() {
  const hallW = 6.4;
  const hallD = 4.2;
  const teeth = 4;
  const toothW = hallW / teeth;
  const tooth = useSawtoothGeometry(toothW, 0.75, hallD);
  const glass = getWindowGlassMaterial();
  // the steep glazed face of each tooth, from the base corner to the apex
  const faceTilt = Math.atan2(toothW * 0.12, 0.75);
  const faceLen = Math.hypot(toothW * 0.12, 0.75);
  return (
    <group position-z={-0.6}>
      <mesh position-y={1.2} castShadow receiveShadow>
        <boxGeometry args={[hallW, 2.4, hallD]} />
        <meshStandardMaterial color="#ffffff" {...getSurface("brick", 3.6, 1.4)} />
      </mesh>
      {/* stone string course under the roofs */}
      <mesh position-y={2.42}>
        <boxGeometry args={[hallW + 0.12, 0.08, hallD + 0.12]} />
        <meshStandardMaterial color="#e6dccb" roughness={0.9} />
      </mesh>
      {Array.from({ length: teeth }, (_, i) => (
        <group key={i} position={[-hallW / 2 + toothW / 2 + i * toothW, 2.46, 0]}>
          <mesh geometry={tooth} castShadow>
            <meshStandardMaterial color="#c9705a" {...getSurface("roofTiles", 0.8, 1.6)} />
          </mesh>
          <group position={[toothW / 2 - (toothW * 0.12) / 2 + 0.01, 0.375, 0]} rotation-z={faceTilt}>
            <mesh rotation-y={Math.PI / 2} material={glass}>
              <planeGeometry args={[hallD - 0.1, faceLen - 0.06]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* tall arched windows in white stone surrounds along the canal face */}
      {[-2.4, -0.8, 0.8, 2.4].map((x) => (
        <group key={x} position={[x, 0, hallD / 2 + 0.01]}>
          <mesh position-y={1.15}>
            <boxGeometry args={[0.86, 1.62, 0.06]} />
            <meshStandardMaterial color="#efe6d3" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.08, 0.04]} material={glass}>
            <boxGeometry args={[0.6, 1.3, 0.03]} />
          </mesh>
          <mesh position={[0, 1.73, 0.04]} rotation-x={Math.PI / 2} material={glass}>
            <cylinderGeometry args={[0.3, 0.3, 0.03, 16, 1, false, -Math.PI / 2, Math.PI]} />
          </mesh>
        </group>
      ))}
      {/* the congress centre's glass foyer */}
      <mesh position={[2.3, 0.85, hallD / 2 + 0.6]} castShadow>
        <boxGeometry args={[1.9, 1.7, 1.2]} />
        <meshStandardMaterial
          color="#cfe3ea"
          roughness={0.05}
          metalness={0.4}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* chimneys */}
      {[
        [-2.7, -1.6, 6.8],
        [1.5, -1.8, 5.2],
      ].map(([x, z, h]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh position-y={h / 2} castShadow>
            <cylinderGeometry args={[0.24, 0.42, h, 14]} />
            <meshStandardMaterial color="#ffffff" {...getSurface("brick", 1.2, h * 0.5)} />
          </mesh>
          <mesh position-y={h + 0.1}>
            <cylinderGeometry args={[0.33, 0.27, 0.24, 14]} />
            <meshStandardMaterial color="#6d2b1d" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── university (Education) ──────────────────────────────────────────────────

/** The University of Aveiro: exposed red brick, ribbon windows, a green flag. */
function University() {
  return (
    <group>
      <Buildings
        style="tijolo"
        items={[
          at(-1.3, -1.3, 4, 3, "#ffffff", { depth: 2 }),
          at(3.0, -0.4, 2, 2, "#ffffff", { depth: 3 }),
        ]}
      />
      {/* covered walkway linking the blocks */}
      <mesh position={[1.25, 1.05, 0.15]} castShadow>
        <boxGeometry args={[1.3, 0.12, 1.1]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.9} />
      </mesh>
      {[0.75, 1.75].map((x) => (
        <mesh key={x} position={[x, 0.5, 0.6]}>
          <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
          <meshStandardMaterial color="#d8d3c6" />
        </mesh>
      ))}
      {/* flag pole */}
      <mesh position={[-3.9, 1.8, 1.2]}>
        <cylinderGeometry args={[0.04, 0.04, 3.6, 6]} />
        <meshStandardMaterial color="#d8d3c6" />
      </mesh>
      <mesh position={[-3.57, 3.35, 1.2]}>
        <planeGeometry args={[0.62, 0.4]} />
        <meshStandardMaterial color="#159a5b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

const BEAM_LEN = 17;

/** Farol da Barra — a tall slender red-and-white striped tower with a keeper's
 *  house, a glass lantern room and a rotating beacon that sweeps a beam at night. */
function Lighthouse() {
  const beacon = useRef<THREE.Group>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const lantern = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.SpriteMaterial>(null);

  // the lantern room also floods the keeper's house and the quay below; its
  // glow and beam show in the water. The sweep itself lights every surface it
  // crosses through lib/lampLights (BEACON), so there is no real spot light.
  const lanternRoom = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!lanternRoom.current) return;
    lanternRoom.current.updateWorldMatrix(true, false);
    const unregister = registerLamps([lanternRoom.current.localToWorld(new THREE.Vector3(0, -1.2, 0))]);
    return () => {
      unregister();
      BEACON.on = 0;
    };
  }, []);

  // a slender cone whose alpha fades from the lantern (apex) to nothing at the
  // far end — a soft volumetric beam with no hard cap
  const beamGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1.45, BEAM_LEN, 30, 1, true);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const tt = (p.getY(i) + BEAM_LEN / 2) / BEAM_LEN; // 0 far .. 1 at the lantern
      const a = Math.pow(Math.max(0, tt), 1.6);
      col[i * 4] = 1;
      col[i * 4 + 1] = 0.95;
      col[i * 4 + 2] = 0.8;
      col[i * 4 + 3] = a;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 4));
    return g;
  }, []);

  useFrame((state, dt) => {
    const n = DAY.night;
    const flick = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 3.3);
    if (beacon.current) {
      beacon.current.rotation.y += dt * 0.7; // the sweep
      // publish the beam to the water shader (world position + heading)
      beacon.current.getWorldPosition(BEACON.pos);
      _bd.set(-1, 0, 0).applyQuaternion(beacon.current.getWorldQuaternion(_bq));
      BEACON.dir = Math.atan2(_bd.x, _bd.z);
      BEACON.on = n;
    }
    if (beam.current) beam.current.opacity = n * 0.42 * flick;
    if (lantern.current) lantern.current.emissiveIntensity = 0.9 + n * 3.2;
    if (glow.current) glow.current.opacity = 0.18 + n * 0.55;
  });

  const shaftTop = SHAFT_BASE + BANDS * BAND_H;
  const lanternY = shaftTop + 0.6;
  const cupolaY = shaftTop + 1.04;

  return (
    <group>
      {/* keeper's house at the base */}
      <mesh position={[0, 0.64, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 1.28, 2.5]} />
        <meshStandardMaterial color="#efe7d2" {...getSurface("plaster", 2.4, 1.1)} />
      </mesh>
      <mesh position={[0, 1.34, 0.1]}>
        <boxGeometry args={[4.8, 0.16, 2.7]} />
        <meshStandardMaterial color="#d9cdb2" roughness={0.9} />
      </mesh>
      {[-1.7, -0.85, 0.95, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.72, 1.36]}>
          <boxGeometry args={[0.36, 0.54, 0.06]} />
          <meshStandardMaterial color="#3a5360" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}
      <mesh position={[0.1, 0.52, 1.36]}>
        <boxGeometry args={[0.54, 0.94, 0.06]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.7} />
      </mesh>

      {/* white plinth the tower rises from */}
      <mesh position={[0, 1.58, 0]} castShadow>
        <cylinderGeometry args={[0.66, 0.8, 0.92, 24]} />
        <meshStandardMaterial color="#f6f2e7" roughness={0.85} />
      </mesh>

      {/* striped shaft — red/white bands, gently tapering */}
      <mesh geometry={SHAFT} castShadow>
        <meshStandardMaterial vertexColors roughness={0.82} />
      </mesh>

      {/* gallery platform + railing under the lantern */}
      <mesh position-y={shaftTop + 0.06} castShadow>
        <cylinderGeometry args={[0.74, 0.74, 0.12, 24]} />
        <meshStandardMaterial color="#2c2a26" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position-y={shaftTop + 0.32}>
        <cylinderGeometry args={[0.72, 0.72, 0.42, 20, 1, true]} />
        <meshStandardMaterial color="#33312c" roughness={0.7} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* glass lantern room + the rotating beacon */}
      <group ref={lanternRoom} position-y={lanternY}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
          <meshStandardMaterial
            ref={lantern}
            color="#fff6da"
            emissive="#ffcf72"
            emissiveIntensity={0.9}
            transparent
            opacity={0.9}
            toneMapped={false}
          />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]}>
              <boxGeometry args={[0.05, 0.82, 0.05]} />
              <meshStandardMaterial color="#2b2925" roughness={0.6} metalness={0.4} />
            </mesh>
          );
        })}
        <sprite scale={[3.6, 3.6, 1]}>
          <spriteMaterial
            ref={glow}
            map={getTexture("foam")}
            color="#ffdf8a"
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </sprite>

        <group ref={beacon}>
          <mesh geometry={beamGeo} position={[-BEAM_LEN / 2, 0, 0]} rotation-z={-Math.PI / 2}>
            <meshBasicMaterial
              ref={beam}
              vertexColors
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      {/* red cupola + finial */}
      <group position-y={cupolaY}>
        <mesh castShadow>
          <coneGeometry args={[0.58, 0.44, 16]} />
          <meshStandardMaterial color="#c9402f" roughness={0.75} />
        </mesh>
        <mesh position-y={0.34}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial color="#2b2925" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position-y={0.54}>
          <cylinderGeometry args={[0.016, 0.016, 0.32, 6]} />
          <meshStandardMaterial color="#2b2925" />
        </mesh>
      </group>
    </group>
  );
}

function LandmarkContent({ id }: { id: PortDef["id"] }) {
  switch (id) {
    case "about":
      return (
        <group>
          <Buildings
            style="ribeira"
            items={[
              at(-2.75, -1.0, 2, 2, "#f6dc7a", { chimney: true }),
              at(2.75, -0.8, 2, 2, "#f3a283", { chimney: true }),
            ]}
          />
          <Buildings style="azulejo" items={[at(0, -1.3, 2, 3, "#2f62b3")]} />
          <Tree position={[4.6, 0, 1.6]} />
          <Tree position={[-4.6, 0, 1.4]} s={0.85} />
        </group>
      );
    case "experience":
      return (
        <group>
          <Buildings
            style="artenova"
            items={[
              at(-3.45, -1.2, 2, 2, "#f0e2c4", { chimney: true }),
              at(-1.15, -1.2, 2, 3, "#cfe3d0"),
              at(1.15, -1.2, 2, 3, "#f1cdcd"),
              at(3.45, -1.2, 2, 2, "#cfdcef", { chimney: true }),
            ]}
          />
          <Tree position={[5.2, 0, 1.6]} s={0.9} />
        </group>
      );
    case "publications":
      return <Factory />;
    case "projects":
      return (
        <group>
          <Buildings
            style="palheiro"
            items={[
              at(-2.9, -0.7, 2, 2, "#c8402c"),
              at(0, -1.2, 2, 2, "#2e6fb0"),
              at(2.9, -0.6, 2, 2, "#2e8b57"),
            ]}
          />
          <Tree position={[4.9, 0, 1.4]} s={0.8} />
        </group>
      );
    case "skills":
      return <Salinas />;
    case "education":
      return <University />;
    case "contact":
      return <Lighthouse />;
  }
}

/** Landmark island: dressed-stone quay wall, calçada (or sand) on top. */
export function Platform({ r, sandy }: { r: number; sandy: boolean }) {
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      color: "#d6cdbb",
      map: getTexture("ashlar", Math.round((2 * Math.PI * r) / 1.4), 2),
      roughness: 0.95,
    });
    // the top is flush with Aveiro's quays (LAND_Y): a depth offset keeps the
    // plaza on top instead of flickering against the city ground
    const flush = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 };
    const top = sandy
      ? new THREE.MeshStandardMaterial({ color: "#ecdfbe", roughness: 1, map: getTexture("sand", 5, 5) })
      : new THREE.MeshStandardMaterial({ color: "#f2ede2", ...getSurface("calcada", r * 0.36, r * 0.36) });
    return [side, top, side];
  }, [r, sandy]);
  return (
    <mesh position-y={0.32} receiveShadow material={materials}>
      <cylinderGeometry args={[r, r + 0.3, 0.64, 48]} />
    </mesh>
  );
}

export default function Landmark({ port }: { port: PortDef }) {
  const isSalinas = port.id === "skills";
  const r = port.platformR ?? 7;
  const contentScale = Math.min(1, r / 6.2);
  const dress = {
    barrels: ["about", "experience", "projects", "skills"].includes(port.id),
    crates: ["experience", "projects", "contact", "publications"].includes(port.id),
    planter: ["education", "about", "contact", "publications"].includes(port.id),
  };
  return (
    <group position={[port.landmarkPos.x, 0, port.landmarkPos.z]} rotation-y={port.faceIn}>
      <Platform r={r} sandy={isSalinas} />
      <group position-y={0.64} scale={contentScale}>
        <LandmarkContent id={port.id} />
      </group>
      {/* quayside dressing — lamps, seating, greenery and clutter on every island */}
      <group position-y={0.64}>
        <Lamppost position={[r * 0.62, 0, r * 0.5]} s={0.9} power={1.6} />
        <Bench position={[r * 0.52, 0, -r * 0.42]} rotY={-2.3} s={0.95} />
        <Bush position={[-r * 0.62, 0, -r * 0.4]} />
        <Bush position={[r * 0.5, 0, -r * 0.62]} s={0.9} />
        <Bush position={[-r * 0.28, 0, -r * 0.7]} s={1.1} />
        {!isSalinas && <Tree position={[-r * 0.74, 0, r * 0.05]} s={0.85} />}
        {dress.barrels && <Barrel position={[-r * 0.5, 0, r * 0.56]} s={0.9} />}
        {dress.crates && <Crates position={[r * 0.44, 0, r * 0.56]} rotY={0.4} s={0.9} />}
        {dress.planter && <Planter position={[-r * 0.2, 0, r * 0.82]} s={0.9} />}
      </group>
    </group>
  );
}
