"use client";

import { Canvas } from "@react-three/fiber";
import type { MapDef } from "@/lib/maps";
import Water from "@/components/three/Water";
import City from "@/components/three/City";
import AveiroCity from "@/components/three/AveiroCity";
import Landmark from "@/components/three/Landmarks";
import PortDock from "@/components/three/PortDock";
import Moliceiro, { AmbientBoats } from "@/components/three/Moliceiro";

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
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [6, 10, 46], fov: 42, near: 0.5, far: 320 }}
      className="!fixed inset-0"
    >
      <color attach="background" args={["#d8edf2"]} />
      <fog attach="fog" args={["#d8edf2", 55, 175]} />

      <hemisphereLight args={["#bfe6f0", "#caa97a", 0.55]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        castShadow
        position={[45, 60, 18]}
        intensity={1.6}
        color="#fff4e0"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={170}
        shadow-bias={-0.0004}
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
