"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/lib/ports";
import { getSurface } from "@/lib/textures";
import { MODELS } from "@/lib/models";
import {
  getLampHaloMaterial,
  getLampHaloPointsMaterial,
  getLanternGlassMaterial,
  getLightPoolMaterial,
} from "@/lib/nightMaterials";
import { registerLamps } from "@/lib/lampLights";
import { hideFromMirror, NO_MIRROR_LAYER } from "@/lib/reflection";
import { tinted } from "@/lib/geometry";

/** A ref whose object (and everything under it) stays out of the water's reflection. */
function useNoMirror<T extends THREE.Object3D>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (ref.current) hideFromMirror(ref.current);
  }, []);
  return ref;
}

// ── GLB props ───────────────────────────────────────────────────────────────

/** A clone of a baked, unit-height prop GLB (see scripts/bake-models.mjs). */
function useProp(url: string, shadows = true, mirrored = true) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const obj = scene.clone(true);
    if (!mirrored) hideFromMirror(obj);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      // the lamp's glass heads share one night-driven glowing material
      const mat = mesh.material as THREE.Material;
      if (mat.name === "Material.002") mesh.material = getLanternGlassMaterial();
    });
    return obj;
  }, [scene, shadows, mirrored]);
}

function PropModel({
  url,
  height,
  rotY = 0,
  shadows = true,
  mirrored = true,
}: {
  url: string;
  height: number;
  rotY?: number;
  shadows?: boolean;
  mirrored?: boolean;
}) {
  const obj = useProp(url, shadows, mirrored);
  return <primitive object={obj} scale={height} rotation-y={rotY} />;
}

export interface PropPlacement {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  /** final height in world units */
  h: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Group placements into square cells so each cell can be frustum-culled. */
export function chunkItems<T extends { x: number; z: number }>(items: T[], cell: number) {
  const chunks = new Map<string, T[]>();
  for (const it of items) {
    const key = `${Math.floor(it.x / cell)}:${Math.floor(it.z / cell)}`;
    const list = chunks.get(key);
    if (list) list.push(it);
    else chunks.set(key, [it]);
  }
  return [...chunks.entries()];
}

/**
 * Many copies of one prop GLB as InstancedMeshes — one draw call per part and
 * per 64-unit cell, so whatever is off screen (or outside the shadow camera)
 * is culled instead of drawn.
 */
export function GlbInstances({
  url,
  items,
  shadows = true,
  cell = 64,
}: {
  url: string;
  items: PropPlacement[];
  shadows?: boolean;
  cell?: number;
}) {
  const chunks = useMemo(() => chunkItems(items, cell), [items, cell]);
  return (
    <>
      {chunks.map(([key, list]) => (
        <GlbInstanceChunk key={key} url={url} items={list} shadows={shadows} />
      ))}
    </>
  );
}

/** The meshes of a baked GLB as (geometry, material, matrix) for instancing. */
function useGlbParts(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const list: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }> = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.Material;
      list.push({
        geometry: mesh.geometry,
        material: material.name === "Material.002" ? getLanternGlassMaterial() : material,
        matrix: mesh.matrixWorld.clone(),
      });
    });
    return list;
  }, [scene]);
}

function GlbInstanceChunk({
  url,
  items,
  shadows = true,
}: {
  url: string;
  items: PropPlacement[];
  shadows?: boolean;
}) {
  const parts = useGlbParts(url);
  const refs = useRef<Array<THREE.InstancedMesh | null>>([]);
  useLayoutEffect(() => {
    parts.forEach((part, k) => {
      const inst = refs.current[k];
      if (!inst) return;
      items.forEach((it, i) => {
        _q.setFromAxisAngle(_up, it.rotY ?? 0);
        _m.compose(_p.set(it.x, it.y, it.z), _q, _s.setScalar(it.h)).multiply(part.matrix);
        inst.setMatrixAt(i, _m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
    });
  }, [parts, items]);
  return (
    <>
      {parts.map((part, k) => (
        <instancedMesh
          key={`${k}-${items.length}`}
          ref={(el) => {
            refs.current[k] = el;
          }}
          args={[part.geometry, part.material, items.length]}
          castShadow={shadows}
          receiveShadow
        />
      ))}
    </>
  );
}

// ── trees & bushes ──────────────────────────────────────────────────────────

/*
 * Trees and bushes placed one by one (landmarks, islands) are drawn by one
 * shared set of instanced meshes: each <Tree>/<Bush> only registers its
 * world matrix, and <PlacedProps /> (mounted once in the scene) draws them
 * all. Two dozen GLB clones become a handful of draw calls, in the main,
 * shadow and reflection passes alike.
 */
type PlacedProp = { url: string; matrix: THREE.Matrix4; shadows: boolean };
const placedProps = new Set<PlacedProp>();
const placedListeners = new Set<() => void>();
let placedVersion = 0;

function addPlacedProp(prop: PlacedProp) {
  placedProps.add(prop);
  placedVersion++;
  placedListeners.forEach((l) => l());
  return () => {
    placedProps.delete(prop);
    placedVersion++;
    placedListeners.forEach((l) => l());
  };
}
function subscribePlaced(listener: () => void) {
  placedListeners.add(listener);
  return () => {
    placedListeners.delete(listener);
  };
}

/** Register a unit-height GLB prop at this group's world transform. */
function usePlacedProp(url: string, height: number, rotY: number, shadows: boolean) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    _q.setFromAxisAngle(_up, rotY);
    const matrix = g.matrixWorld.clone().multiply(_m.compose(_p.set(0, 0, 0), _q, _s.setScalar(height)));
    return addPlacedProp({ url, matrix, shadows });
  }, [url, height, rotY, shadows]);
  return ref;
}

/** A tree from the forest pack (sometimes a big+small pair). */
export function Tree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const { rotY, pair } = useMemo(() => {
    const r = mulberry32(Math.round(position[0] * 53.1 + position[2] * 17.7 + 11));
    return { rotY: r() * Math.PI * 2, pair: r() > 0.62 };
  }, [position]);
  const ref = usePlacedProp(pair ? MODELS.treeB : MODELS.treeA, (pair ? 3.1 : 2.8) * s, rotY, true);
  return <group ref={ref} position={position} />;
}

/** A leafy bush (the forest pack's crown sat low). */
export function Bush({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const rotY = useMemo(
    () => mulberry32(Math.round(position[0] * 41 + position[2] * 23 + 9))() * Math.PI * 2,
    [position]
  );
  const ref = usePlacedProp(MODELS.bush, 0.9 * s, rotY, false);
  return <group ref={ref} position={position} />;
}

/** Draws every registered tree and bush (mount once, inside a Suspense). */
export function PlacedProps() {
  const version = useSyncExternalStore(subscribePlaced, () => placedVersion, () => 0);
  const groups = useMemo(() => {
    const byKey = new Map<string, { url: string; shadows: boolean; matrices: THREE.Matrix4[] }>();
    for (const p of placedProps) {
      const key = `${p.url}|${p.shadows}`;
      let g = byKey.get(key);
      if (!g) {
        g = { url: p.url, shadows: p.shadows, matrices: [] };
        byKey.set(key, g);
      }
      g.matrices.push(p.matrix);
    }
    return [...byKey.entries()];
    // the registry is external: `version` is what changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return (
    <>
      {groups.map(([key, g]) => (
        <MatrixInstances key={key} url={g.url} matrices={g.matrices} shadows={g.shadows} />
      ))}
    </>
  );
}

function MatrixInstances({ url, matrices, shadows }: { url: string; matrices: THREE.Matrix4[]; shadows: boolean }) {
  const parts = useGlbParts(url);
  const refs = useRef<Array<THREE.InstancedMesh | null>>([]);
  useLayoutEffect(() => {
    parts.forEach((part, k) => {
      const inst = refs.current[k];
      if (!inst) return;
      matrices.forEach((m, i) => inst.setMatrixAt(i, _m.multiplyMatrices(m, part.matrix)));
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
    });
  }, [parts, matrices]);
  return (
    <>
      {parts.map((part, k) => (
        <instancedMesh
          key={`${k}-${matrices.length}`}
          ref={(el) => {
            refs.current[k] = el;
          }}
          args={[part.geometry, part.material, matrices.length]}
          castShadow={shadows}
          receiveShadow
        />
      ))}
    </>
  );
}

// ── street furniture ────────────────────────────────────────────────────────

const FLOWER_COLORS = ["#e5556b", "#f2a73d", "#f2d84a", "#e8e3d6", "#d6608f", "#6fae5a"];

/** Wooden quay bench. */
export function Bench({
  position,
  rotY = 0,
  s = 1,
}: {
  position: [number, number, number];
  rotY?: number;
  s?: number;
}) {
  const root = useNoMirror<THREE.Group>();
  return (
    <group ref={root} position={position} rotation-y={rotY} scale={s}>
      <mesh position-y={0.32}>
        <boxGeometry args={[1.3, 0.08, 0.4]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 1.5, 0.5)} />
      </mesh>
      <mesh position={[0, 0.56, -0.16]} rotation-x={-0.18}>
        <boxGeometry args={[1.3, 0.36, 0.06]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 1.5, 0.5)} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.38]} />
          <meshStandardMaterial color="#3b332a" roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** A wine/salt barrel. */
export function Barrel({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const root = useNoMirror<THREE.Group>();
  return (
    <group ref={root} position={position} scale={s}>
      <mesh position-y={0.33}>
        <cylinderGeometry args={[0.26, 0.3, 0.66, 12]} />
        <meshStandardMaterial color="#7a5230" {...getSurface("wood", 1, 0.6)} />
      </mesh>
      {[0.12, 0.54].map((y) => (
        <mesh key={y} position-y={y}>
          <torusGeometry args={[0.285, 0.025, 6, 16]} />
          <meshStandardMaterial color="#2c2620" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** A stack of crates. */
export function Crates({
  position,
  rotY = 0,
  s = 1,
}: {
  position: [number, number, number];
  rotY?: number;
  s?: number;
}) {
  const root = useNoMirror<THREE.Group>();
  return (
    <group ref={root} position={position} rotation-y={rotY} scale={s}>
      <mesh position-y={0.3}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 0.8, 0.8)} />
      </mesh>
      <mesh position={[0.18, 0.85, 0.1]} rotation-y={0.4}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#a8855a" {...getSurface("wood", 0.8, 0.8)} />
      </mesh>
    </group>
  );
}

/** A flower planter box. */
export function Planter({
  position,
  rotY = 0,
  s = 1,
}: {
  position: [number, number, number];
  rotY?: number;
  s?: number;
}) {
  // the flower heads, merged into one vertex-coloured mesh
  const flowers = useMemo(() => {
    const rnd = mulberry32(Math.round(position[0] * 31 + position[2] * 19 + 5));
    return mergeGeometries(
      Array.from({ length: 8 }, () => {
        const x = (rnd() - 0.5) * 0.8;
        const z = (rnd() - 0.5) * 0.28;
        const color = FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)];
        const h = 0.1 + rnd() * 0.12;
        return tinted(new THREE.SphereGeometry(0.07, 6, 5).translate(x, 0.42 + h / 2, z), color);
      })
    );
  }, [position]);
  const root = useNoMirror<THREE.Group>();
  return (
    <group ref={root} position={position} rotation-y={rotY} scale={s}>
      <mesh position-y={0.16}>
        <boxGeometry args={[1, 0.32, 0.4]} />
        <meshStandardMaterial color="#8a6a47" {...getSurface("wood", 1.2, 0.5)} />
      </mesh>
      <mesh position-y={0.34}>
        <boxGeometry args={[0.9, 0.08, 0.32]} />
        <meshStandardMaterial color="#4f7e44" roughness={1} />
      </mesh>
      <mesh geometry={flowers}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
    </group>
  );
}

// ── street lamps ────────────────────────────────────────────────────────────

/** Warm disc of lamplight on the ground (fake light: no shader recompiles). */
export function LightPool({ radius = 3.2, y = 0.03 }: { radius?: number; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} material={getLightPoolMaterial()} layers={NO_MIRROR_LAYER}>
      <circleGeometry args={[radius, 28]} />
    </mesh>
  );
}

/** Ornate iron lamppost; its lantern, halo and light pool glow at night. */
export function Lamppost({
  position,
  s = 1,
  light = true,
  power = 1,
}: {
  position: [number, number, number];
  s?: number;
  light?: boolean;
  power?: number;
}) {
  const glowScale = 3 * Math.sqrt(power);
  // the lantern lights its surroundings at night (see lib/lampLights)
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!light || !root.current) return;
    root.current.updateWorldMatrix(true, false);
    return registerLamps([root.current.localToWorld(new THREE.Vector3(0, 2.7, 0))]);
  }, [light]);
  return (
    <group ref={root} position={position} scale={s}>
      <Suspense fallback={<ProceduralLampBody />}>
        <PropModel url={MODELS.lamp} height={3.1} shadows={false} mirrored={false} />
      </Suspense>
      <sprite position-y={2.75} scale={[glowScale, glowScale, 1]} material={getLampHaloMaterial()} />
      {light && <LightPool radius={3.4 * Math.sqrt(power)} />}
    </group>
  );
}

/** A light procedural street lamp (unit height, ~100 triangles) for long quays,
 *  where the detailed GLB would cost 2k triangles a lamp. */
const QUAY_LAMP = (() => {
  const iron = mergeGeometries([
    new THREE.CylinderGeometry(0.06, 0.08, 0.06, 8).translate(0, 0.03, 0),
    new THREE.CylinderGeometry(0.018, 0.028, 0.84, 6).translate(0, 0.48, 0),
    new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8).translate(0, 0.86, 0),
    new THREE.ConeGeometry(0.075, 0.07, 4).rotateY(Math.PI / 4).translate(0, 0.995, 0),
  ]);
  const glass = new THREE.BoxGeometry(0.09, 0.11, 0.09).translate(0, 0.92, 0);
  return { iron, glass };
})();
const QUAY_IRON = new THREE.MeshStandardMaterial({ color: "#23262b", roughness: 0.55, metalness: 0.4 });

function InstancedPart({
  geometry,
  material,
  items,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: PropPlacement[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    items.forEach((it, i) => {
      _q.setFromAxisAngle(_up, it.rotY ?? 0);
      _m.compose(_p.set(it.x, it.y, it.z), _q, _s.setScalar(it.h));
      inst.setMatrixAt(i, _m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} />;
}

/** A row of street lamps along a quay: instanced bodies, halos and light pools. */
export function LampInstances({ items }: { items: PropPlacement[] }) {
  useEffect(
    () => registerLamps(items.map((it) => new THREE.Vector3(it.x, it.y + it.h * 0.92, it.z))),
    [items]
  );
  const halos = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(items.flatMap((it) => [it.x, it.y + it.h * 0.92, it.z]), 3)
    );
    return g;
  }, [items]);
  const pools = useMemo(
    () => items.map((it) => ({ x: it.x, y: it.y + 0.03, z: it.z, h: 1 })),
    [items]
  );
  const chunks = useMemo(() => chunkItems(items, 96), [items]);
  return (
    <>
      {chunks.map(([key, list]) => (
        <group key={key}>
          <InstancedPart geometry={QUAY_LAMP.iron} material={QUAY_IRON} items={list} />
          <InstancedPart geometry={QUAY_LAMP.glass} material={getLanternGlassMaterial()} items={list} />
        </group>
      ))}
      <points geometry={halos} material={getLampHaloPointsMaterial()} frustumCulled={false} />
      <PoolInstances items={pools} />
    </>
  );
}

const POOL_GEO = new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2);

function PoolInstances({ items }: { items: PropPlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    items.forEach((it, i) => {
      _m.makeTranslation(it.x, it.y, it.z);
      inst.setMatrixAt(i, _m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      layers={NO_MIRROR_LAYER}
      args={[POOL_GEO, getLightPoolMaterial(), items.length]}
    />
  );
}

/** Procedural iron lamppost body — the fallback while the lamp GLB streams in. */
function ProceduralLampBody() {
  return (
    <>
      <mesh position-y={0.1} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 0.2, 8]} />
        <meshStandardMaterial color="#21242b" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position-y={1.2} castShadow>
        <cylinderGeometry args={[0.055, 0.09, 2.2, 8]} />
        <meshStandardMaterial color="#26303a" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* glowing yellow lantern — the glass itself reads as light, not a black box */}
      <mesh position-y={2.4}>
        <boxGeometry args={[0.3, 0.44, 0.3]} />
        <primitive object={getLanternGlassMaterial()} attach="material" />
      </mesh>
      {/* slim dark frame at the corners so it still reads as a lantern */}
      {[
        [-0.14, -0.14],
        [0.14, -0.14],
        [-0.14, 0.14],
        [0.14, 0.14],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.4, z]}>
          <boxGeometry args={[0.035, 0.47, 0.035]} />
          <meshStandardMaterial color="#23262e" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh position-y={2.72} castShadow>
        <coneGeometry args={[0.26, 0.22, 4]} />
        <meshStandardMaterial color="#23262e" roughness={0.5} />
      </mesh>
    </>
  );
}

