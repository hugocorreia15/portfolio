"use client";

import { type RefObject, Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BRIDGE_TS, CANAL, mulberry32 } from "@/lib/ports";
import { getSurface, getTexture } from "@/lib/textures";
import { OptionalGlb, useModelFile } from "@/components/three/PlacedModel";
import { DAY, useIsNight } from "@/lib/daynight";

// ── GLB foliage & lighting packs ────────────────────────────────────────────
const TREE_GLB = "/models/low_poly_forest_tree_pack.glb";
const LAMP_GLB = "/models/old_street_lamp_pack.glb";

// each pack bundles several items in one scene; isolate one by WORLD POSITION,
// which is robust to GLTFLoader sanitising node names (it strips the dots the
// lamp meshes carry). Lamp = the middle of the three-lamp row (x≈0); the forest
// holds two vertically-aligned trees (A at x≈-13.5, B at x≈-32) and we reuse A's
// crown alone as a bush.
type KeepFn = (name: string, center: THREE.Vector3) => boolean;
const KEEP_LAMP: KeepFn = (_n, c) => Math.abs(c.x) < 1.1;
const KEEP_TREE_A: KeepFn = (_n, c) => Math.abs(c.x + 13.5) < 5 && Math.abs(c.z + 48) < 5;
const KEEP_TREE_B: KeepFn = (_n, c) => Math.abs(c.x + 32) < 5 && Math.abs(c.z + 48) < 5;
const KEEP_BUSH: KeepFn = (n, c) => n.includes("Branches_02") && Math.abs(c.z + 48) < 5;

/** Clone a GLB scene, keep only the meshes the predicate accepts (by name and
 *  world-space centre), drop them to the floor and scale to `height` tall. */
function extractPart(scene: THREE.Object3D, keep: KeepFn, height: number) {
  const obj = scene.clone(true);
  obj.updateMatrixWorld(true);
  const drop: THREE.Object3D[] = [];
  const c = new THREE.Vector3();
  const b = new THREE.Box3();
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    b.setFromObject(mesh);
    b.getCenter(c);
    if (keep(o.name, c)) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    } else {
      drop.push(o);
    }
  });
  drop.forEach((o) => o.removeFromParent());
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y; // sit the base on the ground
  const wrapper = new THREE.Group();
  wrapper.add(obj);
  wrapper.scale.setScalar(height / Math.max(size.y, 0.001));
  return wrapper;
}

// extract each part once per loaded scene, then clone the small result per use
const partCache = new WeakMap<THREE.Object3D, Map<string, THREE.Group>>();
function getTemplate(scene: THREE.Object3D, key: string, keep: KeepFn, height: number) {
  let m = partCache.get(scene);
  if (!m) {
    m = new Map();
    partCache.set(scene, m);
  }
  let tpl = m.get(key);
  if (!tpl) {
    tpl = extractPart(scene, keep, height);
    m.set(key, tpl);
  }
  return tpl;
}

/** One isolated tree/bush from the forest GLB, scaled and spun for variety. */
function GlbForestItem({
  cacheKey,
  keep,
  height,
  rotY,
}: {
  cacheKey: string;
  keep: KeepFn;
  height: number;
  rotY: number;
}) {
  const { scene } = useGLTF(TREE_GLB);
  const obj = useMemo(
    () => getTemplate(scene, cacheKey, keep, 1).clone(true),
    [scene, cacheKey, keep]
  );
  return (
    <group rotation-y={rotY} scale={height}>
      <primitive object={obj} />
    </group>
  );
}

const PASTELS = ["#f4d35e", "#ee6c4d", "#3d8ea9", "#e8a87c", "#9bc4bc", "#f2939b", "#d9b26f"];

export function House({
  position,
  rotY = 0,
  w = 1.6,
  h = 1.6,
  color = "#f4d35e",
  roof = "#e6cdbd",
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  color?: string;
  roof?: string;
}) {
  return (
    <group position={position} rotation-y={rotY}>
      <mesh position-y={h / 2} castShadow>
        <boxGeometry args={[w, h, w * 0.85]} />
        <meshStandardMaterial color={color} {...getSurface("plaster", 1.5, 1)} />
      </mesh>
      <mesh position-y={h + h * 0.3} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[w * 0.8, h * 0.62, 4]} />
        <meshStandardMaterial color={roof} {...getSurface("roofTiles", 1.8, 1.2)} />
      </mesh>
      <mesh position={[0, h * 0.27, w * 0.44]}>
        <boxGeometry args={[w * 0.22, h * 0.5, 0.06]} />
        <meshStandardMaterial color="#cbb9a4" {...getSurface("wood", 0.35, 0.7)} />
      </mesh>
    </group>
  );
}

/** A low-poly forest tree from the GLB pack; procedural foliage is the fallback
 *  until the model loads (or if it isn't downloaded). */
export function Tree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const hasGlb = useModelFile(TREE_GLB);
  const { rotY, typeB } = useMemo(() => {
    const r = mulberry32(Math.round(position[0] * 53.1 + position[2] * 17.7 + 11));
    return { rotY: r() * Math.PI * 2, typeB: r() > 0.5 };
  }, [position]);
  if (!hasGlb) return <ProceduralTree position={position} s={s} />;
  return (
    <group position={position}>
      <Suspense fallback={<ProceduralTree position={[0, 0, 0]} s={s} />}>
        <GlbForestItem
          cacheKey={typeB ? "treeB" : "treeA"}
          keep={typeB ? KEEP_TREE_B : KEEP_TREE_A}
          height={2.8 * s}
          rotY={rotY}
        />
      </Suspense>
    </group>
  );
}

/** Procedural broadleaf (clustered) or occasional pine — the fallback foliage. */
function ProceduralTree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const { trunkH, lean, blobs } = useMemo(() => {
    const rnd = mulberry32(Math.round(position[0] * 53.1 + position[2] * 17.7 + 11));
    const lean = (rnd() - 0.5) * 0.1;
    const pine = rnd() > 0.72;
    const greens = pine
      ? ["#3c6b39", "#477f42", "#355f37"]
      : ["#5a9c4e", "#69b05c", "#4d8a43", "#7cc06a", "#5fa553"];
    const n = pine ? 3 : 3 + Math.floor(rnd() * 2);
    const blobs = Array.from({ length: n }, (_, i) => {
      const t = i / Math.max(1, n - 1);
      return {
        pine,
        x: (rnd() - 0.5) * (pine ? 0.16 : 0.56),
        y: 1.0 + t * (pine ? 1.4 : 1.0) + rnd() * 0.12,
        z: (rnd() - 0.5) * (pine ? 0.16 : 0.56),
        r: pine ? 0.66 - t * 0.4 : 0.33 + rnd() * 0.3,
        c: greens[Math.floor(rnd() * greens.length)],
      };
    });
    return { trunkH: 0.85 + rnd() * 0.4, lean, blobs };
  }, [position]);

  return (
    <group position={position} scale={s} rotation-z={lean}>
      <mesh position-y={trunkH / 2} castShadow>
        <cylinderGeometry args={[0.08, 0.18, trunkH, 7]} />
        <meshStandardMaterial color="#8a6a47" {...getSurface("wood", 0.5, 1.4)} />
      </mesh>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} castShadow>
          {b.pine ? (
            <coneGeometry args={[b.r, b.r * 1.6, 8]} />
          ) : (
            <icosahedronGeometry args={[b.r, 0]} />
          )}
          <meshStandardMaterial
            color={b.c}
            roughness={1}
            flatShading
            map={getTexture("foliage", 1, 1)}
          />
        </mesh>
      ))}
    </group>
  );
}

const FLOWER_COLORS = ["#e5556b", "#f2a73d", "#f2d84a", "#e8e3d6", "#d6608f", "#6fae5a"];

/** Ornate iron lamppost with a warm glowing lantern. */
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
  // the lantern only burns at night — by day the glass is plain with no glow or
  // cast light, so the lampposts stay dark while the sun is up
  const lantern = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.SpriteMaterial>(null);
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const n = DAY.night;
    if (lantern.current) lantern.current.emissiveIntensity = n * 3.4;
    if (glow.current) glow.current.opacity = n * 0.95;
    if (lamp.current) lamp.current.intensity = n * 42 * power;
  });

  const hasGlb = useModelFile(LAMP_GLB);
  const night = useIsNight();
  const glowScale = 3 * Math.sqrt(power);

  return (
    <group position={position} scale={s}>
      {hasGlb ? (
        <Suspense fallback={<ProceduralLampBody lanternRef={lantern} />}>
          <GlbLamp />
        </Suspense>
      ) : (
        <ProceduralLampBody lanternRef={lantern} />
      )}
      {/* the light coming out: yellow halo + a point light that pools on the ground */}
      <sprite position-y={2.75} scale={[glowScale, glowScale, 1]}>
        <spriteMaterial
          ref={glow}
          map={getTexture("foam")}
          color="#ffce2f"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </sprite>
      {light && night && (
        <pointLight
          ref={lamp}
          position-y={2.8}
          color="#ffd166"
          intensity={0}
          distance={22 * power}
          decay={1.15}
        />
      )}
    </group>
  );
}

function GlbLamp() {
  const { scene } = useGLTF(LAMP_GLB);
  const obj = useMemo(() => getTemplate(scene, "lampMid", KEEP_LAMP, 3.1).clone(true), [scene]);
  // the lamp's glass heads are the "Material.002" mesh (dots stripped by the
  // loader → "Material002"); give this instance its own emissive copy so the
  // heads themselves glow at night.
  const glass = useRef<THREE.MeshStandardMaterial | null>(null);
  useEffect(() => {
    obj.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh || !mesh.name.includes("Material002")) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.emissive = new THREE.Color("#ffcf6b");
      mat.emissiveIntensity = 0;
      mat.toneMapped = false;
      mesh.material = mat;
      glass.current = mat;
    });
  }, [obj]);
  useFrame(() => {
    if (glass.current) glass.current.emissiveIntensity = DAY.night * 2.8;
  });
  return <primitive object={obj} />;
}

/** Procedural iron lamppost body — the fallback when the lamp GLB isn't loaded. */
function ProceduralLampBody({
  lanternRef,
}: {
  lanternRef: RefObject<THREE.MeshStandardMaterial | null>;
}) {
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
        <meshStandardMaterial
          ref={lanternRef}
          color="#ffe24f"
          emissive="#ffcc2a"
          emissiveIntensity={0}
          toneMapped={false}
        />
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
  return (
    <group position={position} rotation-y={rotY} scale={s}>
      <mesh position-y={0.32} castShadow>
        <boxGeometry args={[1.3, 0.08, 0.4]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 1.5, 0.5)} />
      </mesh>
      <mesh position={[0, 0.56, -0.16]} rotation-x={-0.18} castShadow>
        <boxGeometry args={[1.3, 0.36, 0.06]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 1.5, 0.5)} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]} castShadow>
          <boxGeometry args={[0.08, 0.32, 0.38]} />
          <meshStandardMaterial color="#3b332a" roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** A wine/salt barrel. */
export function Barrel({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.33} castShadow>
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
  return (
    <group position={position} rotation-y={rotY} scale={s}>
      <mesh position-y={0.3} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#9c7a4f" {...getSurface("wood", 0.8, 0.8)} />
      </mesh>
      <mesh position={[0.18, 0.85, 0.1]} rotation-y={0.4} castShadow>
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
  const flowers = useMemo(() => {
    const rnd = mulberry32(Math.round(position[0] * 31 + position[2] * 19 + 5));
    return Array.from({ length: 8 }, () => ({
      x: (rnd() - 0.5) * 0.8,
      z: (rnd() - 0.5) * 0.28,
      c: FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)],
      h: 0.1 + rnd() * 0.12,
    }));
  }, [position]);
  return (
    <group position={position} rotation-y={rotY} scale={s}>
      <mesh position-y={0.16} castShadow>
        <boxGeometry args={[1, 0.32, 0.4]} />
        <meshStandardMaterial color="#8a6a47" {...getSurface("wood", 1.2, 0.5)} />
      </mesh>
      <mesh position-y={0.34}>
        <boxGeometry args={[0.9, 0.08, 0.32]} />
        <meshStandardMaterial color="#4f7e44" roughness={1} />
      </mesh>
      {flowers.map((f, i) => (
        <mesh key={i} position={[f.x, 0.42 + f.h / 2, f.z]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <meshStandardMaterial color={f.c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** A leafy bush — the forest GLB's crown sat low; procedural blobs are fallback. */
export function Bush({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const hasGlb = useModelFile(TREE_GLB);
  const rotY = useMemo(
    () => mulberry32(Math.round(position[0] * 41 + position[2] * 23 + 9))() * Math.PI * 2,
    [position]
  );
  if (!hasGlb) return <ProceduralBush position={position} s={s} />;
  return (
    <group position={position}>
      <Suspense fallback={<ProceduralBush position={[0, 0, 0]} s={s} />}>
        <GlbForestItem cacheKey="bush" keep={KEEP_BUSH} height={0.9 * s} rotY={rotY} />
      </Suspense>
    </group>
  );
}

/** Low procedural foliage bush — the fallback. */
function ProceduralBush({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const blobs = useMemo(() => {
    const rnd = mulberry32(Math.round(position[0] * 41 + position[2] * 23 + 9));
    const greens = ["#4f8a45", "#5d9c50", "#69ad5b"];
    return Array.from({ length: 2 }, () => ({
      x: (rnd() - 0.5) * 0.5,
      y: 0.2 + rnd() * 0.16,
      z: (rnd() - 0.5) * 0.5,
      r: 0.26 + rnd() * 0.16,
      c: greens[Math.floor(rnd() * greens.length)],
    }));
  }, [position]);
  return (
    <group position={position} scale={s}>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} castShadow>
          <icosahedronGeometry args={[b.r, 0]} />
          <meshStandardMaterial
            color={b.c}
            roughness={1}
            flatShading
            map={getTexture("foliage", 1, 1)}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ArchBridge({
  position,
  rotY,
  r = 3.6,
  span = 3.4,
}: {
  position: [number, number, number];
  rotY: number;
  r?: number;
  span?: number;
}) {
  return (
    <group position={position} rotation-y={rotY}>
      {/* arch shell — the boat sails through the opening */}
      <mesh rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[r, r, span, 28, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial
          color="#e9e2d2"
          side={THREE.DoubleSide}
          {...getSurface("plaster", 4, 1)}
        />
      </mesh>
      {/* railings along both edges of the deck */}
      {[-(span / 2 - 0.1), span / 2 - 0.1].map((z) => (
        <mesh key={z} position-z={z}>
          <torusGeometry args={[r + 0.06, 0.07, 8, 28, Math.PI]} />
          <meshStandardMaterial color="#c8bfa8" roughness={0.8} />
        </mesh>
      ))}
      {/* abutments resting on the banks (drafted deep so waves never expose them) */}
      {[-(r + 0.3), r + 0.3].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[1.7, 2.2, span + 0.2]} />
          <meshStandardMaterial color="#ddd5c2" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

const BRIDGE_GLB = "/models/ponte-carcavelos.glb";

/** Real Ponte de Carcavelos spanning the canal; procedural arch is the fallback. */
export function BridgeModel({
  position,
  rotY,
  r = 3.6,
  span = 3.4,
}: {
  position: [number, number, number];
  rotY: number;
  r?: number;
  span?: number;
}) {
  const size = THREE.MathUtils.clamp(r * 2.9, 10, 16);
  return (
    <OptionalGlb
      url={BRIDGE_GLB}
      position={position}
      rotY={rotY}
      size={size}
      yOffset={-0.5}
    >
      <ArchBridge position={position} rotY={rotY} r={r} span={span} />
    </OptionalGlb>
  );
}

function Bridge({ t }: { t: number }) {
  const { pos, rotY } = useMemo(() => {
    const p = CANAL.getPointAt(t);
    const tan = CANAL.getTangentAt(t);
    return { pos: [p.x, 0, p.z] as [number, number, number], rotY: Math.atan2(tan.x, tan.z) };
  }, [t]);
  return <BridgeModel position={pos} rotY={rotY} />;
}

function Chapel() {
  return (
    <group>
      <mesh position-y={1.1} castShadow>
        <boxGeometry args={[2.6, 2.2, 2.1]} />
        <meshStandardMaterial color="#f7f1e3" {...getSurface("plaster", 2, 1.6)} />
      </mesh>
      <mesh position-y={2.75} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.7, 1.1, 4]} />
        <meshStandardMaterial color="#deb9a4" {...getSurface("roofTiles", 2, 1)} />
      </mesh>
      <mesh position={[1.85, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.55, 3.6, 10]} />
        <meshStandardMaterial color="#f7f1e3" roughness={0.85} />
      </mesh>
      <mesh position={[1.85, 3.85, 0]} castShadow>
        <sphereGeometry args={[0.62, 14, 12]} />
        <meshStandardMaterial color="#1e4f8f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 1.08]}>
        <boxGeometry args={[0.6, 1.3, 0.07]} />
        <meshStandardMaterial color="#4a3320" />
      </mesh>
    </group>
  );
}

function MainIsland() {
  const houses = useMemo(() => {
    const rnd = mulberry32(7);
    return Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * Math.PI * 2 + rnd() * 0.25;
      const r = 10.4 + rnd() * 1.4;
      return {
        position: [Math.cos(a) * r, 0.7, Math.sin(a) * r] as [number, number, number],
        rotY: -a + Math.PI / 2 + Math.PI, // face outward, toward the water
        w: 1.4 + rnd() * 0.7,
        h: 1.4 + rnd() * 1.1,
        color: PASTELS[Math.floor(rnd() * PASTELS.length)],
      };
    });
  }, []);

  const trees = useMemo(() => {
    const rnd = mulberry32(21);
    return Array.from({ length: 8 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 4 + rnd() * 5;
      return {
        position: [Math.cos(a) * r, 0.7, Math.sin(a) * r] as [number, number, number],
        s: 0.85 + rnd() * 0.8,
      };
    });
  }, []);

  const bushes = useMemo(() => {
    const rnd = mulberry32(57);
    return Array.from({ length: 5 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 4.5 + rnd() * 6.5;
      return {
        position: [Math.cos(a) * r, 0.74, Math.sin(a) * r] as [number, number, number],
        s: 0.8 + rnd() * 0.6,
      };
    });
  }, []);

  return (
    <group position={[-1, 0, 1]}>
      <mesh position-y={0.35} receiveShadow>
        <cylinderGeometry args={[14.5, 15.2, 0.7, 48]} />
        <meshStandardMaterial color="#e2cf9f" roughness={1} map={getTexture("sand", 6, 6)} />
      </mesh>
      <mesh position-y={0.74} receiveShadow>
        <cylinderGeometry args={[13.6, 13.6, 0.1, 48]} />
        <meshStandardMaterial color="#e3d8c0" {...getSurface("calcada", 8, 8)} />
      </mesh>
      {/* the real Igreja das Barrocas is the town centrepiece (chapel = fallback) */}
      <OptionalGlb
        url="/models/igreja-barrocas.glb"
        position={[0, 0.74, 0]}
        rotY={0.3}
        size={7}
      >
        <group position-y={0.74}>
          <Chapel />
        </group>
      </OptionalGlb>
      {houses.map((h, i) => (
        <House key={i} {...h} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {bushes.map((b, i) => (
        <Bush key={i} position={b.position} s={b.s} />
      ))}
      {/* lampposts ringing the church plaza — brighter, wider pools on the island */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        return (
          <Lamppost key={i} position={[Math.cos(a) * 5.2, 0.74, Math.sin(a) * 5.2]} power={1.7} />
        );
      })}
      {/* benches facing the church */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 1.1;
        return (
          <Bench
            key={i}
            position={[Math.cos(a) * 4.3, 0.74, Math.sin(a) * 4.3]}
            rotY={-a + Math.PI / 2}
          />
        );
      })}
      <Planter position={[2.7, 0.74, 1.3]} rotY={0.5} />
      <Planter position={[-2.5, 0.74, -1.7]} rotY={-0.8} />
      {/* working clutter at the quayside */}
      <Barrel position={[8.6, 0.74, 4.2]} />
      <Barrel position={[9.1, 0.74, 4.7]} s={0.9} />
      <Crates position={[-7.6, 0.74, 6.1]} rotY={0.6} />
      <Crates position={[6.4, 0.74, -7.2]} rotY={-0.5} s={0.85} />
    </group>
  );
}

function Islets() {
  const islets = useMemo(() => {
    const rnd = mulberry32(99);
    return [0.255, 0.59, 0.925].map((t) => {
      const p = CANAL.getPointAt(t);
      const tan = CANAL.getTangentAt(t);
      const out = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      if (out.dot(p) < 0) out.negate();
      const c = p.clone().addScaledVector(out, 14.5);
      return {
        position: [c.x, 0, c.z] as [number, number, number],
        rotY: rnd() * Math.PI * 2,
        color: PASTELS[Math.floor(rnd() * PASTELS.length)],
        treeS: 0.9 + rnd() * 0.6,
      };
    });
  }, []);

  return (
    <>
      {islets.map((islet, i) => (
        <group key={i} position={islet.position}>
          <mesh position-y={0.3} receiveShadow>
            <cylinderGeometry args={[4.2, 4.8, 0.6, 24]} />
            <meshStandardMaterial color="#e2cf9f" roughness={1} />
          </mesh>
          <House position={[-1, 0.6, 0.4]} rotY={islet.rotY} color={islet.color} />
          <Tree position={[1.6, 0.6, -0.9]} s={islet.treeS} />
          <mesh position={[1.1, 0.62, 1.6]} rotation-y={islet.rotY}>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#9d958a" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Clouds() {
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    group.current?.children.forEach((cloud, i) => {
      cloud.position.x += dt * (0.35 + i * 0.08);
      if (cloud.position.x > 130) cloud.position.x = -130;
    });
  });

  const clouds: Array<[number, number, number]> = [
    [-40, 20, -35],
    [30, 25, -60],
    [-75, 18, 18],
    [55, 23, 38],
  ];

  return (
    <group ref={group}>
      {clouds.map((pos, i) => (
        <group key={i} position={pos} scale={[1 + i * 0.2, 0.55, 1]}>
          <mesh>
            <sphereGeometry args={[2.6, 10, 8]} />
            <meshStandardMaterial color="#ffdfc0" transparent opacity={0.9} />
          </mesh>
          <mesh position={[2.4, -0.3, 0.4]}>
            <sphereGeometry args={[1.8, 10, 8]} />
            <meshStandardMaterial color="#ffd2ac" transparent opacity={0.9} />
          </mesh>
          <mesh position={[-2.3, -0.4, -0.3]}>
            <sphereGeometry args={[1.6, 10, 8]} />
            <meshStandardMaterial color="#ffdfc0" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function City() {
  return (
    <>
      <MainIsland />
      <Islets />
      {BRIDGE_TS.map((t) => (
        <Bridge key={t} t={t} />
      ))}
      <Clouds />
    </>
  );
}
