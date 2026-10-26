"use client";

import { Suspense, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import city from "@/data/aveiro-city.json";
import {
  AVEIRO_BRIDGES,
  AVEIRO_PORTS,
  AVEIRO_REGION,
  MARSH_ISLETS,
} from "@/lib/aveiro";
import { mulberry32 } from "@/lib/ports";
import { getSurface, getTexture } from "@/lib/textures";
import type { FacadeStyle } from "@/lib/facades";
import { MODELS } from "@/lib/models";
import { BridgeModel, Clouds } from "@/components/three/City";
import { GlbInstances, LampInstances, type PropPlacement } from "@/components/three/props";
import {
  Buildings,
  getFootprintFacadeMaterial,
  getFootprintSpillMaterial,
  pushSpill,
  pickTint,
  RoofInstances,
  type RoofItem,
  WALL_TINTS,
} from "@/components/three/buildings";
import { Gulls } from "@/components/three/wildlife";

/**
 * The real centre of Aveiro, baked from OpenStreetMap by scripts/bake-aveiro.py:
 * land with the true outline of the canals, quay walls, the street map painted
 * on the ground and every building footprint with its storeys.
 */

const LAND_Y = 0.64; // quay top — landmark platforms sit flush with it
const QUAY_FOOT = -0.9;
const FLOOR_H = 0.9; // a 3 m storey at 0.3 u/m
const BAY_W = 1.05;
const [X0, Z0, X1, Z1] = AVEIRO_REGION;

type Pt = [number, number];
interface Footprint {
  p: Pt[];
  f: number;
  s: FacadeStyle;
  r?: [number, number, number, number, number];
}
const LAND = city.land as Array<{ outer: Pt[]; holes: Pt[][] }>;
const FOOTPRINTS = city.buildings as Footprint[];

/** Keep the landmark plazas (and the piers in front of them) clear of city blocks. */
const CLEARINGS = AVEIRO_PORTS.flatMap((p) => [
  { x: p.landmarkPos.x, z: p.landmarkPos.z, r: (p.platformR ?? 7) + 1.6 },
  { x: p.dockPos.x, z: p.dockPos.z, r: 3 },
]);
const isClear = (x: number, z: number) =>
  CLEARINGS.every((c) => Math.hypot(x - c.x, z - c.z) > c.r);

// ── ground & quays ──────────────────────────────────────────────────────────

function Ground() {
  const map = useTexture("/textures/aveiro-ground.webp", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });
  const geometry = useMemo(() => {
    const toV = ([x, z]: Pt) => new THREE.Vector2(x, -z);
    const shapes = LAND.map((poly) => {
      const shape = new THREE.Shape(poly.outer.map(toV));
      shape.holes = poly.holes.map((h) => new THREE.Path(h.map(toV)));
      return shape;
    });
    const g = new THREE.ShapeGeometry(shapes);
    g.rotateX(-Math.PI / 2); // shape (x, -z) → world (x, 0, z)
    g.translate(0, LAND_Y, 0);
    const pos = g.getAttribute("position");
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - X0) / (X1 - X0);
      uv[i * 2 + 1] = 1 - (pos.getZ(i) - Z0) / (Z1 - Z0);
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  }, []);
  const material = useMemo(() => {
    // fine stone relief tiled over the painted street map
    const { normalMap } = getSurface("calcada", (X1 - X0) / 2.6, (Z1 - Z0) / 2.6);
    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.92,
    });
  }, [map]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

const onBorder = ([x, z]: Pt) =>
  Math.abs(x - X0) < 0.6 || Math.abs(x - X1) < 0.6 || Math.abs(z - Z0) < 0.6 || Math.abs(z - Z1) < 0.6;

/** Dressed-stone walls down into the water along every outline. */
function QuayWalls() {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const uv: number[] = [];
    for (const poly of LAND) {
      for (const ring of [poly.outer, ...poly.holes]) {
        let u = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 1e-3 || (onBorder(a) && onBorder(b))) continue;
          const u1 = u + len / 1.8;
          // two triangles, both sides lit (outline orientation varies)
          pos.push(a[0], LAND_Y, a[1], b[0], LAND_Y, b[1], b[0], QUAY_FOOT, b[1]);
          pos.push(a[0], LAND_Y, a[1], b[0], QUAY_FOOT, b[1], a[0], QUAY_FOOT, a[1]);
          uv.push(u, 1, u1, 1, u1, 0, u, 1, u1, 0, u, 0);
          u = u1;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(() => {
    const map = getTexture("ashlar", 1, 1).clone();
    map.repeat.set(1, 1);
    return new THREE.MeshStandardMaterial({
      color: "#cdc4b1",
      map,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
  }, []);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ── buildings ───────────────────────────────────────────────────────────────

const STYLE_TINTS: Record<FacadeStyle, readonly string[]> = {
  ribeira: WALL_TINTS.pastel,
  azulejo: WALL_TINTS.azulejo,
  artenova: WALL_TINTS.artenova,
  armazem: WALL_TINTS.lime,
  palheiro: WALL_TINTS.palheiro,
  tijolo: WALL_TINTS.lime,
  moderno: WALL_TINTS.moderno,
};

/** Blocks are merged per facade style and per cell, so off-screen cells are culled. */
const CELL = 120;
/** Window light reaches less far out in the narrow city streets. */
const SPILL_AVEIRO = 1.7;

interface CityChunk {
  key: string;
  walls: Array<{ style: FacadeStyle; geometry: THREE.BufferGeometry }>;
  spill: THREE.BufferGeometry;
  tiles: THREE.BufferGeometry;
  flat: THREE.BufferGeometry;
  roofs: RoofItem[];
}

function buildCity(): CityChunk[] {
  type Acc = { pos: number[]; nor: number[]; uv: number[]; col: number[]; seed: number[] };
  type Spill = { pos: number[]; spill: number[]; info: number[] };
  type Raw = { walls: Map<FacadeStyle, Acc>; spill: Spill; tiles: number[]; flat: number[]; roofs: RoofItem[] };
  const chunks = new Map<string, Raw>();
  const c = new THREE.Color();

  FOOTPRINTS.forEach((b, bi) => {
    const pts = b.p;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    if (!isClear(cx, cz) || !pts.every((p) => isClear(p[0], p[1]))) return;

    const key = `${Math.floor(cx / CELL)}:${Math.floor(cz / CELL)}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = { walls: new Map(), spill: { pos: [], spill: [], info: [] }, tiles: [], flat: [], roofs: [] };
      chunks.set(key, chunk);
    }
    const { walls, roofs } = chunk;
    const style = b.s;
    const h = b.f * FLOOR_H;
    const top = LAND_Y + h;
    const tint = pickTint(STYLE_TINTS[style], bi * 7 + 3);
    c.set(tint);
    let acc = walls.get(style);
    if (!acc) {
      acc = { pos: [], nor: [], uv: [], col: [], seed: [] };
      walls.set(style, acc);
    }

    // walls: whole bays per wall so windows never get cut at the corners;
    // footprints are counter-clockwise in (x, z), so (dz, -dx) points out
    let u = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = dz / len;
      const nz = -dx / len;
      const u1 = u + Math.max(1, Math.round(len / BAY_W));
      const base = LAND_Y - 0.1;
      // (A0, B1, B0) and (A0, A1, B1) face outward
      acc.pos.push(ax, base, az, bx, top, bz, bx, base, bz, ax, base, az, ax, top, az, bx, top, bz);
      acc.uv.push(u, 0, u1, b.f, u1, 0, u, 0, u, b.f, u1, b.f);
      for (let k = 0; k < 6; k++) {
        acc.nor.push(nx, 0, nz);
        acc.col.push(c.r, c.g, c.b);
        acc.seed.push(bi);
      }
      // the pool of window light on the pavement in front of this wall
      pushSpill(chunk.spill, [ax, az], [bx, bz], [nx, nz], LAND_Y + 0.04, u, u1, bi, b.f, SPILL_AVEIRO);
      u = u1;
    }

    // a cap closes every top (under the hipped roofs too)
    const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const flat = style === "moderno" || style === "tijolo" || !b.r;
    const out = flat && style !== "armazem" ? chunk.flat : chunk.tiles;
    for (const tri of tris) {
      for (const i of tri) out.push(pts[i][0], top + 0.02, pts[i][1]);
    }

    if (b.r && !flat) {
      const [rx, rz, rw, rd, ang] = b.r;
      roofs.push({
        x: rx,
        y: top,
        z: rz,
        rotY: -ang,
        w: rw + 0.3,
        d: rd + 0.3,
        h: Math.min(rw, rd) * 0.36 + 0.15,
        tint,
      });
    }
  });

  const geoFrom = (a: Acc) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(a.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(a.col, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(a.seed, 1));
    g.computeBoundingSphere();
    return g;
  };
  const capGeo = (arr: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  const spillGeo = (a: Spill) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
    g.setAttribute("aSpill", new THREE.Float32BufferAttribute(a.spill, 2));
    g.setAttribute("aInfo", new THREE.Float32BufferAttribute(a.info, 2));
    g.computeBoundingSphere();
    return g;
  };
  return [...chunks.entries()].map(([key, ch]) => ({
    key,
    walls: [...ch.walls.entries()].map(([style, a]) => ({ style, geometry: geoFrom(a) })),
    spill: spillGeo(ch.spill),
    tiles: capGeo(ch.tiles),
    flat: capGeo(ch.flat),
    roofs: ch.roofs,
  }));
}

const capTiles = new THREE.MeshStandardMaterial({
  color: "#a65a43",
  roughness: 0.95,
  side: THREE.DoubleSide,
});
const capFlat = new THREE.MeshStandardMaterial({
  color: "#c9c3b7",
  roughness: 0.95,
  side: THREE.DoubleSide,
});

function CityBlocks() {
  const chunks = useMemo(() => buildCity(), []);
  return (
    <>
      {chunks.map((ch) => (
        <group key={ch.key}>
          {ch.walls.map(({ style, geometry }) => (
            <mesh
              key={style}
              geometry={geometry}
              material={getFootprintFacadeMaterial(style)}
              castShadow
              receiveShadow
            />
          ))}
          <mesh geometry={ch.spill} material={getFootprintSpillMaterial()} />
          <mesh geometry={ch.tiles} material={capTiles} receiveShadow />
          <mesh geometry={ch.flat} material={capFlat} receiveShadow />
          <RoofInstances kind="hip" items={ch.roofs} />
        </group>
      ))}
    </>
  );
}

// ── street furniture & greenery ─────────────────────────────────────────────

function Greenery() {
  const { lamps, trees } = useMemo(() => {
    const rnd = mulberry32(31);
    const lamps: PropPlacement[] = (city.lamps as Pt[])
      .filter(([x, z]) => isClear(x, z))
      .map(([x, z]) => ({ x, y: LAND_Y, z, h: 2.3 }));
    // the single low-poly tree (800 vertices) — the pair model is 5x heavier
    const trees: PropPlacement[] = (city.trees as Pt[])
      .filter(([x, z]) => isClear(x, z))
      .map(([x, z]) => ({ x, y: LAND_Y, z, rotY: rnd() * Math.PI * 2, h: 2.4 + rnd() * 1.2 }));
    return { lamps, trees };
  }, []);
  return (
    <>
      <LampInstances items={lamps} />
      <Suspense fallback={null}>
        <GlbInstances url={MODELS.treeA} items={trees} shadows={false} cell={96} />
      </Suspense>
    </>
  );
}

/** Extra palheiros strung along the Costa Nova spit. */
function CostaNova() {
  const items = useMemo(() => {
    const tints = WALL_TINTS.palheiro;
    return [40, 50, 72, 82, 92, 102]
      .map((z, i) => ({
        x: -398 + (i % 2) * 4,
        y: LAND_Y,
        z,
        rotY: Math.PI / 2,
        bays: 2,
        depth: 2,
        floors: 2,
        tint: tints[i % tints.length],
      }))
      .filter((it) => isClear(it.x, it.z));
  }, []);
  return <Buildings style="palheiro" items={items} />;
}

function MarshIslets() {
  return (
    <>
      {MARSH_ISLETS.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position-y={0.18} receiveShadow>
            <cylinderGeometry args={[m.r, m.r + 1.2, 0.36, 24]} />
            <meshStandardMaterial color="#8fa067" roughness={1} />
          </mesh>
          {/* reed beds */}
          <mesh position-y={0.55} scale={[m.r * 0.7, 0.5, m.r * 0.55]}>
            <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#9a9b5c" roughness={1} map={getTexture("foliage", 2, 2)} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function AveiroCity() {
  const cx = (X0 + X1) / 2;
  const cz = (Z0 + Z1) / 2;
  return (
    <>
      <Suspense fallback={null}>
        <Ground />
      </Suspense>
      <QuayWalls />
      <CityBlocks />
      <Greenery />
      <CostaNova />
      <MarshIslets />
      {AVEIRO_BRIDGES.map((b, i) => (
        <BridgeModel key={i} position={b.pos} rotY={b.rotY} r={b.r} span={b.span} />
      ))}
      <Clouds center={[cx, cz]} range={260} />
      <Gulls center={[-120, -60]} radius={160} count={12} />
    </>
  );
}
