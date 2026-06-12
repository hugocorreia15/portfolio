"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { AVEIRO_BRIDGES, AVEIRO_SCALE, MARSH_ISLETS, P } from "@/lib/aveiro";
import { ArchBridge, Clouds, House, Tree } from "@/components/three/City";
import { Facade, SaltPyramid, StripedHouse } from "@/components/three/Landmarks";

const S = AVEIRO_SCALE;

/** Flat city block extruded from a polygon of raw map [x, z] coords. */
function Quarter({
  points,
  color = "#ddd0ab",
  h = 0.7,
}: {
  points: [number, number][];
  color?: string;
  h?: number;
}) {
  const geom = useMemo(() => {
    // ensure CCW winding in shape space so the top cap faces up
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, z1] = points[i];
      const [x2, z2] = points[(i + 1) % points.length];
      area += x1 * -z2 - x2 * -z1;
    }
    const pts = area < 0 ? [...points].reverse() : points;
    const shape = new THREE.Shape();
    pts.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x * S, -z * S);
      else shape.lineTo(x * S, -z * S);
    });
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [points, h]);

  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

/** Long low salt warehouse, São Roque style. */
function Warehouse({
  position,
  rotY = 0,
}: {
  position: [number, number, number];
  rotY?: number;
}) {
  const roof = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.9, 0);
    shape.lineTo(1.9, 0);
    shape.lineTo(0, 1);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 6.4, bevelEnabled: false });
  }, []);
  return (
    <group position={position} rotation-y={rotY}>
      <mesh position-y={0.9} castShadow>
        <boxGeometry args={[3.4, 1.8, 6]} />
        <meshStandardMaterial color="#f4efe2" roughness={0.95} />
      </mesh>
      <mesh geometry={roof} position={[0, 1.8, -3.2]} castShadow>
        <meshStandardMaterial color="#5b4634" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.7, 3.02]}>
        <boxGeometry args={[1.3, 1.4, 0.07]} />
        <meshStandardMaterial color="#3c2e20" />
      </mesh>
    </group>
  );
}

/** Old ceramics factory — today's Centro de Congressos — with its brick chimney. */
function CongressCenter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={0.35}>
      <mesh position-y={1.5} castShadow>
        <boxGeometry args={[7, 3, 4]} />
        <meshStandardMaterial color="#9e3d2c" roughness={0.95} />
      </mesh>
      <mesh position-y={3.08}>
        <boxGeometry args={[7.2, 0.16, 4.2]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.85} />
      </mesh>
      <mesh position={[2, 1.1, 2.05]}>
        <boxGeometry args={[1.4, 1.8, 0.08]} />
        <meshStandardMaterial color="#27434f" roughness={0.35} />
      </mesh>
      <mesh position={[-4.6, 4.5, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.85, 9, 12]} />
        <meshStandardMaterial color="#8f3525" roughness={1} />
      </mesh>
      <mesh position={[-4.6, 9.1, 0]}>
        <cylinderGeometry args={[0.75, 0.6, 0.5, 12]} />
        <meshStandardMaterial color="#7c2d1f" roughness={1} />
      </mesh>
    </group>
  );
}

/** Shallow salt pan with a dike rim and a small salt heap. */
function SaltPan({
  position,
  w,
  d,
  heap = true,
}: {
  position: [number, number, number];
  w: number;
  d: number;
  heap?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position-y={0.11} receiveShadow>
        <boxGeometry args={[w, 0.22, d]} />
        <meshStandardMaterial color="#e8ddc2" roughness={1} />
      </mesh>
      <mesh position-y={0.24}>
        <boxGeometry args={[w - 0.8, 0.06, d - 0.8]} />
        <meshStandardMaterial color="#cfe2da" roughness={0.5} />
      </mesh>
      {heap && <SaltPyramid position={[w * 0.22, 0.7, d * 0.1]} r={0.85} h={1.25} />}
    </group>
  );
}

const BEIRA_MAR_HOUSES: Array<{ p: [number, number]; rot: number; c: string }> = [
  { p: [-15.5, -3], rot: 2.7, c: "#f4d35e" },
  { p: [-12, -1.8], rot: 2.9, c: "#ee6c4d" },
  { p: [-8.5, -3.2], rot: 3.3, c: "#3d8ea9" },
  { p: [-5.5, -6], rot: -2.4, c: "#e8a87c" },
  { p: [-12.5, -13], rot: -0.6, c: "#9bc4bc" },
  { p: [-9.5, -10.5], rot: -0.9, c: "#f2939b" },
  { p: [-15, -9], rot: 0.9, c: "#d9b26f" },
];

const PRACA_HOUSES: Array<{ p: [number, number]; rot: number; c: string }> = [
  { p: [9, -9.5], rot: 2.0, c: "#f3e3c3" },
  { p: [13, -11.5], rot: 2.0, c: "#eec4c4" },
  { p: [17, -13.5], rot: 2.0, c: "#bcd8c1" },
  { p: [12, -16], rot: -1.1, c: "#bcd2e8" },
  { p: [18, -19], rot: 0.4, c: "#f4d35e" },
  { p: [25, -19], rot: 1.8, c: "#e8a87c" },
];

export default function AveiroCity() {
  return (
    <>
      {/* ----- city quarters (quay platforms) ----- */}
      {/* Beira-Mar island, ringed by Central, Botirões and São Roque */}
      <Quarter
        points={[
          [-14.5, 1.8],
          [-1.3, -3.4],
          [-10.8, -14.6],
          [-15.5, -8],
        ]}
        color="#e3d4ac"
      />
      {/* Rossio / south bank of Canal Central */}
      <Quarter
        points={[
          [-17, 10],
          [-3, 5],
          [3, 2.5],
          [6, 9],
          [-8, 16],
          [-19, 15],
        ]}
      />
      {/* Praça quarter, north of Canal Central */}
      <Quarter
        points={[
          [6, -6],
          [23, -13.5],
          [30, -13],
          [30, -26],
          [4, -22],
        ]}
      />
      {/* Cojo north bank, with the old factory */}
      <Quarter
        points={[
          [26, -16],
          [40, -19.5],
          [44, -24],
          [36, -30],
          [24, -26],
        ]}
        color="#d8c9a2"
      />
      {/* Cojo south bank */}
      <Quarter
        points={[
          [25, -6.5],
          [41, -10.5],
          [50, -9],
          [50, 1],
          [26, 1],
        ]}
      />
      {/* Alboi, between Pirâmides and São Roque */}
      <Quarter
        points={[
          [-30, 4],
          [-22, 2],
          [-21, -6],
          [-29, -3],
        ]}
        color="#e3d4ac"
      />
      {/* São Roque north bank — the salt warehouses */}
      <Quarter
        points={[
          [-13, -24.5],
          [-44, -26.5],
          [-46, -32],
          [-13, -30],
        ]}
        color="#d8c9a2"
      />

      {/* ----- buildings ----- */}
      {BEIRA_MAR_HOUSES.map((h, i) => (
        <House key={i} position={P(h.p[0], h.p[1], 0.7)} rotY={h.rot} color={h.c} />
      ))}
      {PRACA_HOUSES.map((h, i) => (
        <House
          key={i}
          position={P(h.p[0], h.p[1], 0.7)}
          rotY={h.rot}
          color={h.c}
          h={1.9}
        />
      ))}
      {/* extra Art Nouveau frontage on the Rossio quay */}
      <group position={P(-5, 6.6, 0.7)} rotation-y={2.8}>
        <Facade position={[-1.8, 0, 0]} w={1.7} h={3.5} color="#f3e3c3" />
        <Facade position={[0, 0, 0]} w={1.6} h={4.1} color="#bcd2e8" />
        <Facade position={[1.8, 0, 0]} w={1.7} h={3.3} color="#eec4c4" />
      </group>
      <CongressCenter position={P(36, -25, 0.7)} />
      {[0, 1, 2, 3].map((i) => (
        <Warehouse
          key={i}
          position={P(-18 - i * 6.5, -27.8, 0.7)}
          rotY={Math.PI / 2 + 0.07}
        />
      ))}

      {/* trees on the squares */}
      <Tree position={P(-12, 13, 0.7)} s={1.1} />
      <Tree position={P(-16, 12, 0.7)} s={0.9} />
      <Tree position={P(8, -20, 0.7)} s={1.0} />
      <Tree position={P(28, -23, 0.7)} s={0.9} />
      <Tree position={P(-25, 0, 0.7)} s={0.9} />

      {/* ----- salinas south of São Roque ----- */}
      <SaltPan position={P(-34, -14)} w={11} d={7} />
      <SaltPan position={P(-42, -10)} w={9} d={6} />
      <SaltPan position={P(-30, -7)} w={8} d={5.5} heap={false} />
      <SaltPan position={P(-40, -17.5)} w={7} d={4.5} />

      {/* ----- the open ria ----- */}
      {MARSH_ISLETS.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position-y={0.16} receiveShadow>
            <cylinderGeometry args={[m.r, m.r + 0.8, 0.32, 20]} />
            <meshStandardMaterial color="#9fae74" roughness={1} />
          </mesh>
          {i % 2 === 0 && <Tree position={[m.r * 0.3, 0.32, 0]} s={0.7} />}
        </group>
      ))}
      {/* dunes and a couple more palheiros near Costa Nova */}
      <mesh position={P(-68, 36, 0.2)} rotation-y={0.5} receiveShadow>
        <boxGeometry args={[16, 0.5, 6]} />
        <meshStandardMaterial color="#ecdfbe" roughness={1} />
      </mesh>
      <StripedHouse position={P(-66, 34.5, 0.45)} color="#d6452e" stripes={5} />
      <StripedHouse position={P(-70.5, 37, 0.45)} color="#2e8b57" stripes={5} />

      {/* ----- bridges ----- */}
      {AVEIRO_BRIDGES.map((b, i) => (
        <ArchBridge key={i} position={b.pos} rotY={b.rotY} r={b.r} span={b.span} />
      ))}

      <Clouds />
    </>
  );
}
