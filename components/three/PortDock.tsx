"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PortDef } from "@/lib/ports";
import { getSurface } from "@/lib/textures";
import { tinted } from "@/lib/geometry";

// chips fade out with camera distance so far-off piers don't clutter the HUD,
// and near the top of the screen, where the header and map switch live
const CHIP_NEAR = 34;
const CHIP_FAR = 58;
const _ndc = new THREE.Vector3();

const POST_POSITIONS: Array<[number, number]> = [
  [-0.72, 0.55],
  [0.72, 0.55],
  [-0.72, 4.25],
  [0.72, 4.25],
];

// small parts merged into single meshes: a pier is three draw calls, not eleven
const POSTS = mergeGeometries(
  POST_POSITIONS.map(([x, z]) => new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8).translate(x, 0.18, z))
);
const BOLLARDS = mergeGeometries(
  [-3.3, 3.3].map((x) => new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8).translate(x, 0.55, 0.95))
);

/** The striped mooring pole and its ball, in the pier's accent colour. */
function poleGeometry(accent: string) {
  return mergeGeometries([
    ...[0, 1, 2, 3, 4].map((i) =>
      tinted(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10).translate(0, 0.2 + i * 0.4, 0), i % 2 === 0 ? accent : "#f8f4ea")
    ),
    tinted(new THREE.SphereGeometry(0.2, 12, 10).translate(0, 2.18, 0), accent),
  ]);
}

export default function PortDock({
  port,
  index,
  active,
  targeted,
  quayside = false,
  scale = 1,
  onSelect,
}: {
  port: PortDef;
  index: number;
  active: boolean;
  targeted: boolean;
  /** a pontoon along the quay (real canals) instead of a pier out into the water */
  quayside?: boolean;
  /** match the boat's size on this map */
  scale?: number;
  onSelect: () => void;
}) {
  const chipY = quayside ? 3.2 : 4.3;
  const rotY = Math.atan2(port.outward.x, port.outward.z);
  const chip = useRef<HTMLButtonElement>(null);
  const pole = useMemo(() => poleGeometry(port.accent), [port.accent]);
  const shown = useRef(-1);
  useFrame(({ camera }) => {
    const el = chip.current;
    if (!el) return;
    const d = camera.position.distanceTo(port.dockPos);
    _ndc.set(port.dockPos.x, chipY, port.dockPos.z).project(camera);
    const belowHud = 1 - THREE.MathUtils.smoothstep(_ndc.y, 0.55, 0.72);
    const o =
      (active || targeted ? 1 : 1 - THREE.MathUtils.smoothstep(d, CHIP_NEAR, CHIP_FAR)) * belowHud;
    const q = Math.round(o * 20) / 20; // only touch the DOM when it visibly changes
    if (q === shown.current) return;
    shown.current = q;
    el.style.opacity = String(q);
    el.style.pointerEvents = q < 0.15 ? "none" : "auto";
    el.style.visibility = q === 0 ? "hidden" : "visible";
  });

  return (
    <group>
      <group position={[port.point.x, 0, port.point.z]} rotation-y={rotY} scale={scale}>
        {quayside ? (
          <>
            {/* floating pontoon alongside the quay, gangway onto it */}
            <mesh position={[0, 0.32, 1.75]} castShadow receiveShadow>
              <boxGeometry args={[7, 0.16, 1.9]} />
              <meshStandardMaterial color="#cbb393" {...getSurface("wood", 2.2, 0.6)} />
            </mesh>
            <mesh position={[1.6, 0.48, 3.1]} rotation-x={-0.12}>
              <boxGeometry args={[1.2, 0.08, 1.2]} />
              <meshStandardMaterial color="#b49a78" {...getSurface("wood", 0.5, 0.5)} />
            </mesh>
            <mesh geometry={BOLLARDS}>
              <meshStandardMaterial color="#3b332a" roughness={0.6} metalness={0.3} />
            </mesh>
          </>
        ) : (
          <>
            {/* pier deck reaching from the landmark island to the canal */}
            <mesh position={[0, 0.55, 2.4]} castShadow>
              <boxGeometry args={[1.7, 0.14, 4.4]} />
              <meshStandardMaterial color="#cbb393" {...getSurface("wood", 0.8, 2)} />
            </mesh>
            <mesh geometry={POSTS}>
              <meshStandardMaterial color="#54391f" roughness={1} />
            </mesh>
          </>
        )}
        {/* striped mooring pole, Ria style */}
        <mesh geometry={pole} position={quayside ? [-3.9, 0, 1.2] : [1.15, 0, 0.8]} rotation-z={0.05}>
          <meshStandardMaterial vertexColors roughness={0.65} />
        </mesh>
      </group>

      <Html
        position={[port.dockPos.x, chipY, port.dockPos.z]}
        center
        distanceFactor={13}
        zIndexRange={[30, 10]}
      >
        <button
          ref={chip}
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
