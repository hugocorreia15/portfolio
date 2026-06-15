"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Stats } from "@react-three/drei";
import * as THREE from "three";
import type { MapDef } from "@/lib/maps";
import Water from "@/components/three/Water";
import City from "@/components/three/City";
import AveiroCity from "@/components/three/AveiroCity";
import Landmark from "@/components/three/Landmarks";
import PortDock from "@/components/three/PortDock";
import Moliceiro, { AmbientBoats } from "@/components/three/Moliceiro";
import PlacedModels from "@/components/three/PlacedModel";
import {
  DayNightController,
  NightStars,
  ShootingStars,
} from "@/components/three/Atmosphere";

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
  // add ?stats to the URL to show a live FPS / frame-time overlay
  const showStats =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("stats");
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.3]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      camera={{ position: [6, 10, 46], fov: 42, near: 0.5, far: 1600 }}
      className="!fixed inset-0"
    >
      {showStats && <Stats />}
      <color attach="background" args={["#cfe6f2"]} />
      <fog attach="fog" args={["#cfe6f2", 55, 185]} />

      {/* sun, moon, sky, fog and lights, all driven through the day-night loop */}
      <DayNightController />
      <NightStars />
      <ShootingStars />

      {/* lightweight baked reflections (no external HDRI) for PBR materials */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.6} position={[0, 6, 0]} scale={[12, 12, 1]} color="#eaf3ff" />
        <Lightformer intensity={1.0} position={[6, 2, 4]} scale={[8, 8, 1]} color="#fff2d8" />
        <Lightformer intensity={0.6} position={[-6, 1, -4]} scale={[8, 8, 1]} color="#9fb6d8" />
      </Environment>

      <Water />
      {map.id === "island" ? <City /> : <AveiroCity />}
      <PlacedModels map={map.id} />
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
