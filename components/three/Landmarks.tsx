"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PortDef } from "@/lib/ports";
import { House, Tree } from "@/components/three/City";

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
        <meshStandardMaterial color="#7a4a3a" roughness={0.95} flatShading />
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
        <meshStandardMaterial color={color} roughness={0.9} />
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

function Lighthouse() {
  const bands = 5;
  return (
    <group>
      <mesh position-y={0.3} castShadow>
        <cylinderGeometry args={[1.2, 1.35, 0.6, 14]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.85} />
      </mesh>
      {Array.from({ length: bands }, (_, i) => {
        const rBottom = THREE.MathUtils.lerp(1.05, 0.72, i / bands);
        const rTop = THREE.MathUtils.lerp(1.05, 0.72, (i + 1) / bands);
        return (
          <mesh key={i} position-y={0.6 + 0.85 * i + 0.425} castShadow>
            <cylinderGeometry args={[rTop, rBottom, 0.85, 14]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#d63426" : "#f5f1e6"}
              roughness={0.8}
            />
          </mesh>
        );
      })}
      <mesh position-y={4.95}>
        <cylinderGeometry args={[0.92, 0.92, 0.14, 14]} />
        <meshStandardMaterial color="#33312c" roughness={0.7} />
      </mesh>
      <mesh position-y={5.32}>
        <cylinderGeometry args={[0.46, 0.46, 0.6, 10]} />
        <meshStandardMaterial
          color="#fff3d0"
          emissive="#ffd27d"
          emissiveIntensity={1.6}
        />
      </mesh>
      <mesh position-y={5.85} castShadow>
        <coneGeometry args={[0.56, 0.5, 10]} />
        <meshStandardMaterial color="#d63426" roughness={0.8} />
      </mesh>
      <House position={[2.4, 0, 0.6]} rotY={-0.6} w={1.3} h={1.1} color="#f5f1e6" roof="#d63426" />
    </group>
  );
}

function University() {
  return (
    <group>
      <mesh position={[-1, 0.95, 0]} castShadow>
        <boxGeometry args={[3.4, 1.9, 1.8]} />
        <meshStandardMaterial color="#a8402f" roughness={0.95} />
      </mesh>
      <mesh position={[-1, 1.97, 0]}>
        <boxGeometry args={[3.5, 0.14, 1.9]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.85} />
      </mesh>
      <mesh position={[1.7, 1.4, -0.2]} castShadow>
        <boxGeometry args={[1.9, 2.8, 1.5]} />
        <meshStandardMaterial color="#b04a36" roughness={0.95} />
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
          <House position={[0.2, 0, -1.2]} w={1.6} h={1.6} color="#3d8ea9" roof="#8a4030" />
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
  return (
    <group
      position={[port.landmarkPos.x, 0, port.landmarkPos.z]}
      rotation-y={port.faceIn}
    >
      <mesh position-y={0.32} receiveShadow>
        <cylinderGeometry args={[7, 7.7, 0.64, 32]} />
        <meshStandardMaterial color={isSalinas ? "#ecdfbe" : "#e2cf9f"} roughness={1} />
      </mesh>
      <group position-y={0.64}>
        <LandmarkContent id={port.id} />
      </group>
    </group>
  );
}
