"use client";

import { Html } from "@react-three/drei";
import type { PortDef } from "@/lib/ports";
import { getSurface } from "@/lib/textures";

const POST_POSITIONS: Array<[number, number]> = [
  [-0.72, 0.55],
  [0.72, 0.55],
  [-0.72, 4.25],
  [0.72, 4.25],
];

export default function PortDock({
  port,
  index,
  active,
  onSelect,
}: {
  port: PortDef;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const rotY = Math.atan2(port.outward.x, port.outward.z);

  return (
    <group>
      <group position={[port.point.x, 0, port.point.z]} rotation-y={rotY}>
        {/* pier deck reaching from the landmark island to the canal */}
        <mesh position={[0, 0.55, 2.4]} castShadow>
          <boxGeometry args={[1.7, 0.14, 4.4]} />
          <meshStandardMaterial color="#cbb393" {...getSurface("wood", 0.8, 2)} />
        </mesh>
        {POST_POSITIONS.map(([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0.18, z]}>
            <cylinderGeometry args={[0.09, 0.11, 1.1, 8]} />
            <meshStandardMaterial color="#54391f" roughness={1} />
          </mesh>
        ))}
        {/* striped mooring pole, Ria style */}
        <group position={[1.15, 0, 0.8]} rotation-z={0.05}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position-y={0.2 + i * 0.4}>
              <cylinderGeometry args={[0.15, 0.15, 0.4, 10]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? port.accent : "#f8f4ea"}
                roughness={0.7}
              />
            </mesh>
          ))}
          <mesh position-y={2.18}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color={port.accent} roughness={0.6} />
          </mesh>
        </group>
      </group>

      <Html
        position={[port.dockPos.x, 4.3, port.dockPos.z]}
        center
        distanceFactor={13}
        zIndexRange={[30, 10]}
      >
        <button
          onClick={(e) => {
            e.currentTarget.blur(); // keep Enter free for dock requests
            onSelect();
          }}
          className={`port-chip ${active ? "port-chip-active" : ""}`}
          style={{ "--accent": port.accent } as React.CSSProperties}
        >
          <span className="port-chip-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="port-chip-name">{port.caisName}</span>
          <span className="port-chip-label">{port.label}</span>
        </button>
      </Html>
    </group>
  );
}
