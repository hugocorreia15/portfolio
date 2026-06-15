"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DAY } from "@/lib/daynight";
import type { PortDef } from "@/lib/ports";
import {
  Barrel,
  Bench,
  Bush,
  Crates,
  House,
  Lamppost,
  Planter,
  Tree,
} from "@/components/three/City";
import { getSurface, getTexture } from "@/lib/textures";

/** Triangle prism roof with the ridge running along z — the Costa Nova gable. */
function useGableGeometry(w: number, h: number, d: number) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geom.translate(0, 0, -d / 2);
    return geom;
  }, [w, h, d]);
}

export function StripedHouse({
  position,
  color,
  stripes = 5,
}: {
  position: [number, number, number];
  color: string;
  stripes?: number;
}) {
  const sw = 0.46;
  const width = stripes * sw;
  const roof = useGableGeometry(width + 0.3, 0.95, 1.9);
  return (
    <group position={position}>
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} position={[(i - (stripes - 1) / 2) * sw, 0.95, 0]} castShadow>
          <boxGeometry args={[sw, 1.9, 1.55]} />
          <meshStandardMaterial color={i % 2 === 0 ? color : "#f8f4ea"} roughness={0.9} />
        </mesh>
      ))}
      <mesh geometry={roof} position-y={1.88} castShadow>
        <meshStandardMaterial color="#d9c0ae" {...getSurface("roofTiles", 0.6, 0.6)} />
      </mesh>
      <mesh position={[0, 0.62, 0.81]}>
        <boxGeometry args={[0.4, 1.1, 0.07]} />
        <meshStandardMaterial color="#f8f4ea" />
      </mesh>
      <mesh position={[0.75, 1.15, 0.81]}>
        <boxGeometry args={[0.4, 0.45, 0.06]} />
        <meshStandardMaterial color="#2a2a30" />
      </mesh>
      <mesh position={[-0.75, 1.15, 0.81]}>
        <boxGeometry args={[0.4, 0.45, 0.06]} />
        <meshStandardMaterial color="#2a2a30" />
      </mesh>
    </group>
  );
}

export function Facade({
  position,
  w,
  h,
  color,
}: {
  position: [number, number, number];
  w: number;
  h: number;
  color: string;
}) {
  const windows: Array<[number, number]> = [
    [-w * 0.22, h * 0.62],
    [w * 0.22, h * 0.62],
    [-w * 0.22, h * 0.34],
    [w * 0.22, h * 0.34],
  ];
  return (
    <group position={position}>
      <mesh position-y={h / 2} castShadow>
        <boxGeometry args={[w, h, 0.8]} />
        <meshStandardMaterial color={color} {...getSurface("plaster", 1.2, 2.2)} />
      </mesh>
      {/* art nouveau cornice */}
      <mesh position-y={h + 0.08} castShadow>
        <boxGeometry args={[w + 0.18, 0.18, 0.95]} />
        <meshStandardMaterial color="#fbf7ec" roughness={0.85} />
      </mesh>
      <mesh position-y={h + 0.26}>
        <boxGeometry args={[w * 0.55, 0.22, 0.6]} />
        <meshStandardMaterial color="#fbf7ec" roughness={0.85} />
      </mesh>
      {windows.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.43]}>
          <boxGeometry args={[w * 0.26, h * 0.16, 0.05]} />
          <meshStandardMaterial color="#243640" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, h * 0.14, 0.43]}>
        <boxGeometry args={[w * 0.24, h * 0.26, 0.05]} />
        <meshStandardMaterial color="#3d2c1f" />
      </mesh>
    </group>
  );
}

export function SaltPyramid({
  position,
  r,
  h,
}: {
  position: [number, number, number];
  r: number;
  h: number;
}) {
  return (
    <mesh position={position} castShadow>
      <coneGeometry args={[r, h, 14]} />
      <meshStandardMaterial color="#fdfbf4" roughness={0.95} />
    </mesh>
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
  const spot = useRef<THREE.SpotLight>(null);
  const spotTarget = useRef<THREE.Object3D>(null);

  useEffect(() => {
    if (spot.current && spotTarget.current) spot.current.target = spotTarget.current;
  }, []);

  useFrame((state, dt) => {
    const n = DAY.night;
    if (beacon.current) beacon.current.rotation.y += dt * 0.85; // the sweep
    const flick = 0.78 + 0.22 * Math.sin(state.clock.elapsedTime * 3.3);
    if (beam.current) beam.current.opacity = (0.05 + n * 0.55) * flick;
    if (lantern.current) lantern.current.emissiveIntensity = 0.9 + n * 3.2;
    if (glow.current) glow.current.opacity = 0.22 + n * 0.6;
    if (spot.current) spot.current.intensity = n * 26;
  });

  const bands = 7;
  const shaftBase = 2.0;
  const bandH = 0.82;
  const shaftTop = shaftBase + bands * bandH;
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
      {Array.from({ length: bands }, (_, i) => {
        const rB = THREE.MathUtils.lerp(0.62, 0.47, i / bands);
        const rT = THREE.MathUtils.lerp(0.62, 0.47, (i + 1) / bands);
        return (
          <mesh key={i} position-y={shaftBase + i * bandH + bandH / 2} castShadow>
            <cylinderGeometry args={[rT, rB, bandH + 0.002, 24]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#f6f2e7" : "#c9402f"} roughness={0.82} />
          </mesh>
        );
      })}

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
      <group position-y={lanternY}>
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
          <object3D ref={spotTarget} position={[-13, -3.5, 0]} />
          <spotLight
            ref={spot}
            position={[0, 0, 0]}
            angle={0.34}
            penumbra={0.7}
            distance={44}
            decay={1.0}
            intensity={0}
            color="#fff2cf"
          />
          <mesh position={[-BEAM_LEN / 2, 0, 0]} rotation-z={-Math.PI / 2}>
            <coneGeometry args={[1.35, BEAM_LEN, 22, 1, true]} />
            <meshBasicMaterial
              ref={beam}
              color="#fff4cf"
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

function University() {
  return (
    <group>
      <mesh position={[-1, 0.95, 0]} castShadow>
        <boxGeometry args={[3.4, 1.9, 1.8]} />
        <meshStandardMaterial color="#ffffff" {...getSurface("brick", 2.2, 1.2)} />
      </mesh>
      <mesh position={[-1, 1.97, 0]}>
        <boxGeometry args={[3.5, 0.14, 1.9]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.85} />
      </mesh>
      <mesh position={[1.7, 1.4, -0.2]} castShadow>
        <boxGeometry args={[1.9, 2.8, 1.5]} />
        <meshStandardMaterial color="#ffffff" {...getSurface("brick", 1.3, 1.9)} />
      </mesh>
      <mesh position={[1.7, 2.87, -0.2]}>
        <boxGeometry args={[2.0, 0.14, 1.6]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.85} />
      </mesh>
      {/* glazed entrance */}
      <mesh position={[-1, 0.7, 0.93]}>
        <boxGeometry args={[1.6, 1.2, 0.06]} />
        <meshStandardMaterial color="#27434f" roughness={0.3} />
      </mesh>
      {/* flag pole */}
      <mesh position={[3.1, 1.6, 0.8]}>
        <cylinderGeometry args={[0.04, 0.04, 3.2, 6]} />
        <meshStandardMaterial color="#d8d3c6" />
      </mesh>
      <mesh position={[3.43, 2.95, 0.8]}>
        <planeGeometry args={[0.62, 0.4]} />
        <meshStandardMaterial color="#159a5b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function LandmarkContent({ id }: { id: PortDef["id"] }) {
  switch (id) {
    case "about":
      return (
        <group>
          <House position={[-1.9, 0, -0.4]} w={1.8} h={2.0} color="#f4d35e" />
          <House position={[0.2, 0, -1.2]} w={1.6} h={1.6} color="#3d8ea9" roof="#d9b5a5" />
          <House position={[2.2, 0, -0.3]} w={1.7} h={2.3} color="#ee6c4d" />
          <Tree position={[3.9, 0, 1.2]} />
          <Tree position={[-3.8, 0, 0.9]} s={0.85} />
        </group>
      );
    case "experience":
      return (
        <group>
          <Facade position={[-2.6, 0, -0.5]} w={1.7} h={3.2} color="#f3e3c3" />
          <Facade position={[-0.85, 0, -0.5]} w={1.6} h={3.9} color="#bcd8c1" />
          <Facade position={[0.85, 0, -0.5]} w={1.6} h={3.4} color="#eec4c4" />
          <Facade position={[2.6, 0, -0.5]} w={1.7} h={3.7} color="#bcd2e8" />
          <Tree position={[4.4, 0, 1.4]} s={0.9} />
        </group>
      );
    case "projects":
      return (
        <group>
          <StripedHouse position={[-2.7, 0, -0.4]} color="#d6452e" />
          <StripedHouse position={[0, 0, -0.9]} color="#2f6fae" />
          <StripedHouse position={[2.7, 0, -0.3]} color="#2e8b57" />
          <Tree position={[4.6, 0, 1.3]} s={0.8} />
        </group>
      );
    case "skills":
      return (
        <group>
          <SaltPyramid position={[-2.4, 0.8, -0.6]} r={1.25} h={1.7} />
          <SaltPyramid position={[-0.3, 0.7, -1.4]} r={1.05} h={1.5} />
          <SaltPyramid position={[1.7, 0.85, -0.5]} r={1.3} h={1.8} />
          <SaltPyramid position={[3.3, 0.55, -1.2]} r={0.8} h={1.15} />
          <SaltPyramid position={[0.8, 0.5, 0.6]} r={0.7} h={1.05} />
          {/* wooden walkway between the salt pans */}
          <mesh position={[0, 0.08, 1.8]}>
            <boxGeometry args={[7.5, 0.1, 0.7]} />
            <meshStandardMaterial color="#6e4f33" roughness={1} />
          </mesh>
        </group>
      );
    case "education":
      return <University />;
    case "contact":
      return <Lighthouse />;
  }
}

export default function Landmark({ port }: { port: PortDef }) {
  const isSalinas = port.id === "skills";
  const r = port.platformR ?? 7;
  const contentScale = Math.min(1, r / 6.2);
  const dress = {
    barrels: ["about", "experience", "projects", "skills"].includes(port.id),
    crates: ["experience", "projects", "contact"].includes(port.id),
    planter: ["education", "about", "contact"].includes(port.id),
  };
  return (
    <group
      position={[port.landmarkPos.x, 0, port.landmarkPos.z]}
      rotation-y={port.faceIn}
    >
      <mesh position-y={0.32} receiveShadow>
        <cylinderGeometry args={[r, r + 0.7, 0.64, 32]} />
        {isSalinas ? (
          <meshStandardMaterial color="#ecdfbe" roughness={1} map={getTexture("sand", 5, 5)} />
        ) : (
          <meshStandardMaterial color="#e9e1d0" {...getSurface("calcada", 4, 4)} />
        )}
      </mesh>
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
        {dress.crates && (
          <Crates position={[r * 0.44, 0, r * 0.56]} rotY={0.4} s={0.9} />
        )}
        {dress.planter && <Planter position={[0, 0, r * 0.8]} s={0.9} />}
      </group>
    </group>
  );
}
