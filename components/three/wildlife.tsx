"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DAY } from "@/lib/daynight";
import { driveMaterial } from "@/lib/nightMaterials";
import { mulberry32 } from "@/lib/ports";
import { NO_MIRROR_LAYER } from "@/lib/reflection";

// ── flamingos ───────────────────────────────────────────────────────────────

const PINK = "#f19bb0";

/** A greater flamingo wading in the salt pans — the Ria is full of them. */
function Flamingo({ seed }: { seed: number }) {
  const neck = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const { neckGeo, phase, feeding } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.22, 0.06),
      new THREE.Vector3(0, 0.4, -0.04),
      new THREE.Vector3(0, 0.55, 0.06),
    ]);
    const r = mulberry32(seed);
    return {
      neckGeo: new THREE.TubeGeometry(curve, 12, 0.035, 6),
      phase: r() * Math.PI * 2,
      feeding: r() > 0.5,
    };
  }, [seed]);

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    if (neck.current) {
      // feeders dip their heads into the brine; the others look about
      neck.current.rotation.x = feeding ? 1.1 + Math.sin(t * 0.7) * 0.35 : Math.sin(t * 0.4) * 0.15;
      neck.current.rotation.y = feeding ? 0 : Math.sin(t * 0.3) * 0.5;
    }
    if (body.current) body.current.position.y = 0.62 + Math.sin(t * 1.3) * 0.01;
  });

  return (
    <group scale={1.1}>
      {/* legs: one tucked up now and then */}
      <mesh position={[0.04, 0.31, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 4]} />
        <meshStandardMaterial color="#e48ea2" roughness={0.8} />
      </mesh>
      <mesh position={[-0.04, feeding ? 0.31 : 0.45, 0]}>
        <cylinderGeometry args={[0.012, 0.012, feeding ? 0.62 : 0.34, 4]} />
        <meshStandardMaterial color="#e48ea2" roughness={0.8} />
      </mesh>
      <group ref={body} position-y={0.62}>
        <mesh scale={[0.13, 0.11, 0.24]} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={PINK} roughness={0.9} />
        </mesh>
        {/* black flight feathers along the folded wing */}
        <mesh position={[0, 0.02, -0.17]} scale={[0.1, 0.05, 0.1]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#2a2326" roughness={0.9} />
        </mesh>
        <group ref={neck} position={[0, 0.06, 0.18]}>
          <mesh geometry={neckGeo}>
            <meshStandardMaterial color={PINK} roughness={0.9} />
          </mesh>
          <group position={[0, 0.57, 0.08]}>
            <mesh>
              <sphereGeometry args={[0.055, 10, 8]} />
              <meshStandardMaterial color={PINK} roughness={0.9} />
            </mesh>
            {/* bent beak, pale with a black tip */}
            <mesh position={[0, -0.03, 0.07]} rotation-x={2.0}>
              <coneGeometry args={[0.025, 0.11, 6]} />
              <meshStandardMaterial color="#f3e6e0" roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.075, 0.1]} rotation-x={2.4}>
              <coneGeometry args={[0.016, 0.05, 6]} />
              <meshStandardMaterial color="#1d1b1c" roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export function Flamingos({
  spots,
}: {
  spots: Array<{ position: [number, number, number]; rotY: number }>;
}) {
  return (
    <>
      {spots.map((s, i) => (
        <group key={i} position={s.position} rotation-y={s.rotY}>
          <Flamingo seed={i * 31 + 7} />
        </group>
      ))}
    </>
  );
}

// ── gulls ───────────────────────────────────────────────────────────────────

/** Two triangles hinged at the body; the flap is done in the vertex shader. */
function gullGeometry() {
  const g = new THREE.BufferGeometry();
  // x = span (wing tips at ±1), z = chord; y bent by the shader
  const p = [
    // left wing
    0, 0, 0.18, -1, 0, -0.05, 0, 0, -0.22,
    // right wing
    0, 0, 0.18, 0, 0, -0.22, 1, 0, -0.05,
    // body
    0, -0.04, 0.32, -0.06, 0, -0.3, 0.06, 0, -0.3,
  ];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

const GULL_GEO = gullGeometry();

let gullMat: THREE.MeshLambertMaterial | null = null;

/** Shared gull material; the wing beat runs off the clock uniform. */
function getGullMaterial() {
  if (gullMat) return gullMat;
  const mat = new THREE.MeshLambertMaterial({ color: "#f4f2ec", side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = vec3(position);
        float id = float(gl_InstanceID);
        float flap = sin(uTime * (5.0 + mod(id, 3.0)) + id * 1.7);
        transformed.y += abs(position.x) * flap * 0.55;`
      );
  };
  gullMat = driveMaterial(mat, (_m, _night, time) => {
    uniforms.uTime.value = time;
  });
  return gullMat;
}

/** A few gulls wheeling over the water, each on its own lazy circle. */
export function Gulls({ center, count = 9, radius = 40 }: { center: [number, number]; count?: number; radius?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const birds = useMemo(() => {
    const r = mulberry32(4411);
    return Array.from({ length: count }, () => ({
      cx: center[0] + (r() - 0.5) * radius,
      cz: center[1] + (r() - 0.5) * radius,
      orbit: 6 + r() * 14,
      h: 9 + r() * 9,
      speed: (0.12 + r() * 0.1) * (r() > 0.5 ? 1 : -1),
      phase: r() * Math.PI * 2,
    }));
  }, [center, count, radius]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(0.55, 0.55, 0.55), []);

  useLayoutEffect(() => {
    ref.current?.computeBoundingSphere();
  }, []);

  useFrame((state) => {
    const inst = ref.current;
    if (!inst) return;
    const t = state.clock.elapsedTime;
    // gulls go roost at night
    inst.visible = DAY.night < 0.6;
    birds.forEach((b, i) => {
      const a = b.phase + t * b.speed;
      p.set(b.cx + Math.cos(a) * b.orbit, b.h + Math.sin(t * 0.3 + i) * 1.2, b.cz + Math.sin(a) * b.orbit);
      // heading along the circle, banking into the turn
      const heading = Math.atan2(-Math.sin(a) * Math.sign(b.speed), Math.cos(a) * Math.sign(b.speed));
      e.set(0, heading, -0.35 * Math.sign(b.speed), "YXZ");
      q.setFromEuler(e);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[GULL_GEO, getGullMaterial(), birds.length]}
      frustumCulled={false}
      layers={NO_MIRROR_LAYER}
    />
  );
}
