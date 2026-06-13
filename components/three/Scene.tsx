"use client";

import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import type { MapDef } from "@/lib/maps";
import { SUN_DIR, SUN_POS } from "@/lib/sun";
import { getTexture } from "@/lib/textures";
import Water from "@/components/three/Water";
import City from "@/components/three/City";
import AveiroCity from "@/components/three/AveiroCity";
import Landmark from "@/components/three/Landmarks";
import PortDock from "@/components/three/PortDock";
import Moliceiro, { AmbientBoats } from "@/components/three/Moliceiro";

/** The visible sun: a bright disc and a soft additive glow, immune to fog. */
function SunDisc() {
  const p = SUN_DIR.clone().multiplyScalar(280);
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh>
        <sphereGeometry args={[11, 24, 24]} />
        <meshBasicMaterial color="#fff2cf" fog={false} toneMapped={false} />
      </mesh>
      <sprite scale={[70, 70, 1]}>
        <spriteMaterial
          map={getTexture("foam")}
          color="#ffb36b"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </sprite>
    </group>
  );
}

export default function Scene({
  map,
  targetIndex,
  dockedIndex,
  joystick,
  onArrive,
  onNavigate,
  onManualStart,
  onNearPort,
  onRequestDock,
}: {
  map: MapDef;
  targetIndex: number | null;
  dockedIndex: number | null;
  joystick: { current: { x: number; y: number } };
  onArrive: (index: number) => void;
  onNavigate: (index: number) => void;
  onManualStart: () => void;
  onNearPort: (index: number | null) => void;
  onRequestDock: (index: number) => void;
}) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [6, 10, 46], fov: 42, near: 0.5, far: 320 }}
      className="!fixed inset-0"
    >
      <color attach="background" args={["#eed2b4"]} />
      <fog attach="fog" args={["#eed2b4", 55, 185]} />
      <Sky
        sunPosition={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}
        turbidity={7.5}
        rayleigh={2.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.9}
        distance={3000}
      />
      <SunDisc />

      <hemisphereLight args={["#f4bd8a", "#5d5566", 0.5]} />
      <ambientLight intensity={0.24} color="#ffe2c4" />
      <directionalLight
        castShadow
        position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}
        intensity={1.8}
        color="#ffb070"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-far={260}
        shadow-bias={-0.0005}
        shadow-normalBias={0.6}
      />

      <Water />
      {map.id === "island" ? <City /> : <AveiroCity />}
      {map.ports.map((port, i) => (
        <group key={port.id}>
          <Landmark port={port} />
          <PortDock
            port={port}
            index={i}
            active={dockedIndex === i}
            onSelect={() => onNavigate(i)}
          />
        </group>
      ))}
      <Moliceiro
        map={map}
        targetIndex={targetIndex}
        dockedIndex={dockedIndex}
        joystick={joystick}
        onArrive={onArrive}
        onManualStart={onManualStart}
        onNearPort={onNearPort}
        onRequestDock={onRequestDock}
      />
      <AmbientBoats curve={map.ambientCurve} />
    </Canvas>
  );
}
