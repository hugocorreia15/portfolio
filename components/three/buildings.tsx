"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELLS, type FacadeStyle, getFacadeAtlas } from "@/lib/facades";
import { getSurface } from "@/lib/textures";
import { driveMaterial } from "@/lib/nightMaterials";
import { addLampLighting } from "@/lib/lampLights";
import { mulberry32 } from "@/lib/ports";

/**
 * Instanced buildings. Every wall is tiled with facade cells (one bay wide,
 * one floor tall) by a shader that derives its UVs from the instance's scale,
 * so windows keep their real size on houses of any width; the instance colour
 * tints only the wall (mask G) and windows light up at random after dusk
 * (mask R). A whole street of one style is three draw calls.
 */

export const BAY = 1.15;
export const FLOOR = 1.3;

export type RoofKind = "hip" | "gable" | "gableFront" | "flat";

export interface BuildingItem {
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** width along the facade, in bays */
  bays: number;
  /** depth, in bays */
  depth: number;
  floors: number;
  /** wall tint */
  tint: string;
  /** add a chimney */
  chimney?: boolean;
}

const STYLE_ROOF: Record<FacadeStyle, RoofKind> = {
  ribeira: "hip",
  azulejo: "hip",
  artenova: "hip",
  armazem: "gable",
  palheiro: "gableFront",
  tijolo: "flat",
  moderno: "flat",
};

// ── shader patches ──────────────────────────────────────────────────────────

const INSTANCE_SCALE = /* glsl */ `
  vec3 iScale = vec3(1.0);
  #ifdef USE_INSTANCING
    iScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vSeed = float(gl_InstanceID);
  #else
    vSeed = 0.0;
  #endif
  vec3 sp = position * iScale;
`;

const HASH = /* glsl */ `
  float bHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
`;

/**
 * `box`: unit boxes scaled per instance, UVs derived from the instance scale.
 * `attr`: merged wall geometry (real footprints) carrying its own facade UVs,
 *         an `aSeed` attribute and vertex colours for the tint.
 */
type FacadeMode = "box" | "attr";

function facadeMaterial(style: FacadeStyle, mode: FacadeMode) {
  const { map, mask } = getFacadeAtlas(style);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.88,
    metalness: 0,
    vertexColors: mode === "attr",
  });
  const uniforms = {
    uMask: { value: mask },
    uNight: { value: 0 },
    uGlow: { value: new THREE.Color("#ffb85c").multiplyScalar(2.3) },
    uCell: { value: new THREE.Vector2(BAY, FLOOR) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    addLampLighting(shader);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec2 uCell;
        varying vec2 vFacadeUv;
        flat varying float vSeed;
        ${mode === "attr" ? "attribute float aSeed;" : ""}`
      )
      .replace(
        "#include <uv_vertex>",
        mode === "attr"
          ? `#include <uv_vertex>
        vFacadeUv = uv;
        vSeed = aSeed;`
          : `#include <uv_vertex>
        ${INSTANCE_SCALE}
        vec3 an = abs(normal);
        float u = an.z > 0.5
          ? (normal.z > 0.0 ? sp.x + 0.5 * iScale.x : 0.5 * iScale.x - sp.x)
          : (normal.x > 0.0 ? 0.5 * iScale.z - sp.z : sp.z + 0.5 * iScale.z);
        vFacadeUv = vec2(u / uCell.x, sp.y / uCell.y);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uMask;
        uniform float uNight;
        uniform vec3 uGlow;
        varying vec2 vFacadeUv;
        flat varying float vSeed;
        ${HASH}`
      )
      .replace(
        "#include <map_fragment>",
        `vec2 fuv = vFacadeUv;
        float bayIx = floor(fuv.x);
        float floorIx = floor(fuv.y);
        float seed = floor(vSeed + 0.5);
        float cellIx = floorIx < 0.5 ? (bHash(vec2(bayIx, seed)) < 0.42 ? 1.0 : 2.0) : 0.0;
        vec2 auv = vec2((fract(fuv.x) + cellIx) / ${CELLS.toFixed(1)}, fract(fuv.y));
        vec2 gx = dFdx(fuv) * vec2(${(1 / CELLS).toFixed(4)}, 1.0);
        vec2 gy = dFdy(fuv) * vec2(${(1 / CELLS).toFixed(4)}, 1.0);
        vec4 fTex = textureGrad(map, auv, gx, gy);
        vec4 fMask = textureGrad(uMask, auv, gx, gy);
        #ifdef USE_COLOR
          vec3 fTint = vColor.rgb;
        #else
          vec3 fTint = vec3(1.0);
        #endif
        diffuseColor.rgb *= mix(fTex.rgb, fTex.rgb * fTint, fMask.g);`
      )
      .replace("#include <color_fragment>", "")
      .replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor = mix(roughness, 0.14, fMask.r);"
      )
      .replace(
        "#include <emissivemap_fragment>",
        `float fLit = step(0.38, bHash(vec2(bayIx * 1.7 + floorIx * 13.1, seed + 0.37)));
        // most rooms glow warm; now and then a cooler, bluer one
        float fCool = step(0.84, bHash(vec2(floorIx * 5.3 + bayIx, seed + 9.1)));
        vec3 fGlow = mix(uGlow, vec3(1.25, 1.45, 1.8), fCool);
        totalEmissiveRadiance += fGlow * fMask.r * fLit * uNight;`
      );
  };
  mat.customProgramCacheKey = () => `facade-${mode}`;
  return driveMaterial(mat, (_m, night) => {
    uniforms.uNight.value = night;
  });
}

/** Roof tiles with UVs from the instance scale; tone varies per instance. */
function roofMaterial() {
  const surf = getSurface("roofTiles");
  const mat = new THREE.MeshStandardMaterial({ ...surf, roughness: 1 });
  mat.onBeforeCompile = (shader) => {
    addLampLighting(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nflat varying float vSeed;")
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        ${INSTANCE_SCALE}
        vec3 an = abs(normal);
        vec2 ruv = (an.x > an.z ? vec2(sp.z, sp.y * 1.6 + abs(sp.x)) : vec2(sp.x, sp.y * 1.6 + abs(sp.z))) * 0.42;
        #ifdef USE_MAP
          vMapUv = ruv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = ruv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = ruv;
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nflat varying float vSeed;\n${HASH}`)
      .replace(
        "#include <color_fragment>",
        "diffuseColor.rgb *= 0.82 + 0.3 * bHash(vec2(vSeed, 3.1));"
      );
  };
  mat.customProgramCacheKey = () => "roof-tiles";
  return mat;
}

/** Plain lime plaster taking the instance tint (gable ends, chimneys). */
function plainMaterial() {
  return new THREE.MeshStandardMaterial({ ...getSurface("plaster", 0.6, 0.6), roughness: 0.95 });
}

function slabMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#e9e3d6", roughness: 0.9 });
}

const materials = new Map<string, THREE.Material>();

/** Shared facade material for merged real-footprint walls. */
export function getFootprintFacadeMaterial(style: FacadeStyle) {
  return cached(`facade-attr-${style}`, () => facadeMaterial(style, "attr"));
}
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = materials.get(key);
  if (!m) {
    m = make();
    materials.set(key, m);
  }
  return m as T;
}

// ── unit geometries (footprint ±0.5, base at y = 0) ─────────────────────────

const BODY = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const SLAB = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const CHIMNEY = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

function roofGeometry(kind: Exclude<RoofKind, "flat">) {
  const v = (x: number, y: number, z: number) => [x, y, z];
  const slopes: number[][] = [];
  const ends: number[][] = [];
  const quad = (out: number[][], a: number[], b: number[], c: number[], d: number[]) =>
    out.push(a, b, c, a, c, d);
  const A = v(-0.5, 0, 0.5);
  const B = v(0.5, 0, 0.5);
  const C = v(0.5, 0, -0.5);
  const D = v(-0.5, 0, -0.5);
  if (kind === "hip") {
    const R1 = v(-0.22, 1, 0);
    const R2 = v(0.22, 1, 0);
    quad(slopes, A, B, R2, R1);
    quad(slopes, C, D, R1, R2);
    slopes.push(D, A, R1, B, C, R2);
  } else if (kind === "gable") {
    // ridge along x: long slopes face ±z, gable triangles at the ends
    const R1 = v(-0.5, 1, 0);
    const R2 = v(0.5, 1, 0);
    quad(slopes, A, B, R2, R1);
    quad(slopes, C, D, R1, R2);
    ends.push(D, A, R1, B, C, R2);
  } else {
    // ridge along z: the gable faces the street (+z), Costa Nova style
    const R1 = v(0, 1, 0.5);
    const R2 = v(0, 1, -0.5);
    quad(slopes, B, C, R2, R1);
    quad(slopes, D, A, R1, R2);
    ends.push(A, B, R1, C, D, R2);
  }
  // soffit, so the roof reads solid from below
  quad(ends, A, D, C, B);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...slopes, ...ends].flat(), 3));
  g.addGroup(0, slopes.length, 0);
  g.addGroup(slopes.length, ends.length, 1);
  g.computeVertexNormals();
  return g;
}

const ROOFS = {
  hip: roofGeometry("hip"),
  gable: roofGeometry("gable"),
  gableFront: roofGeometry("gableFront"),
};

// ── component ───────────────────────────────────────────────────────────────

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _o = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

type Placement = { pos: THREE.Vector3; rotY: number; scale: THREE.Vector3; color: string };

function useInstances(list: Placement[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    list.forEach((it, i) => {
      _q.setFromAxisAngle(_up, it.rotY);
      _m.compose(it.pos, _q, it.scale);
      inst.setMatrixAt(i, _m);
      inst.setColorAt(i, _c.set(it.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [list]);
  return ref;
}

export function Buildings({
  style,
  items,
  shadows = true,
}: {
  style: FacadeStyle;
  items: BuildingItem[];
  shadows?: boolean;
}) {
  const roofKind = STYLE_ROOF[style];
  const { bodies, roofs, chimneys } = useMemo(() => {
    const bodies: Placement[] = [];
    const roofs: Placement[] = [];
    const chimneys: Placement[] = [];
    const rnd = mulberry32(items.length * 97 + style.length);
    for (const it of items) {
      const w = it.bays * BAY;
      const d = it.depth * BAY;
      const h = it.floors * FLOOR;
      _q.setFromAxisAngle(_up, it.rotY);
      bodies.push({ pos: new THREE.Vector3(it.x, it.y, it.z), rotY: it.rotY, scale: new THREE.Vector3(w, h, d), color: it.tint });
      const eave = roofKind === "flat" ? 0.12 : 0.36;
      const roofH = roofKind === "flat" ? 0.18 : Math.min(w, d) * (roofKind === "gableFront" ? 0.5 : 0.36);
      roofs.push({
        pos: new THREE.Vector3(it.x, it.y + h, it.z),
        rotY: it.rotY,
        scale: new THREE.Vector3(w + eave, roofH, d + eave),
        color: it.tint,
      });
      if (it.chimney) {
        _o.set((rnd() - 0.5) * w * 0.5, h + roofH * 0.35, (rnd() - 0.5) * d * 0.3).applyQuaternion(_q);
        chimneys.push({
          pos: new THREE.Vector3(it.x + _o.x, it.y + _o.y, it.z + _o.z),
          rotY: it.rotY,
          scale: new THREE.Vector3(0.32, roofH * 0.9, 0.32),
          color: "#f1ece2",
        });
      }
    }
    return { bodies, roofs, chimneys };
  }, [items, roofKind, style]);

  const bodyRef = useInstances(bodies);
  const roofRef = useInstances(roofs);
  const chimneyRef = useInstances(chimneys);

  const facade = cached(`facade-${style}`, () => facadeMaterial(style, "box"));
  const roofMats = useMemo(
    () =>
      roofKind === "flat"
        ? cached("slab", slabMaterial)
        : [cached("roof", roofMaterial), cached("plain", plainMaterial)],
    [roofKind]
  );
  const roofGeo = roofKind === "flat" ? SLAB : ROOFS[roofKind];

  if (!items.length) return null;
  return (
    <group>
      <instancedMesh
        key={`b${bodies.length}`}
        ref={bodyRef}
        args={[BODY, facade, bodies.length]}
        castShadow={shadows}
        receiveShadow
      />
      <instancedMesh
        key={`r${roofs.length}`}
        ref={roofRef}
        args={[roofGeo, roofMats, roofs.length]}
        castShadow={shadows}
        receiveShadow
      />
      {chimneys.length > 0 && (
        <instancedMesh
          key={`c${chimneys.length}`}
          ref={chimneyRef}
          args={[CHIMNEY, cached("plain", plainMaterial), chimneys.length]}
          castShadow={shadows}
        />
      )}
    </group>
  );
}

export interface RoofItem {
  x: number;
  y: number;
  z: number;
  rotY: number;
  w: number;
  d: number;
  h: number;
  /** tints the gable ends */
  tint: string;
}

/** Roofs alone, for footprint buildings whose walls are merged geometry. */
export function RoofInstances({
  kind,
  items,
  shadows = true,
}: {
  kind: Exclude<RoofKind, "flat">;
  items: RoofItem[];
  shadows?: boolean;
}) {
  const list = useMemo(
    () =>
      items.map((it) => ({
        pos: new THREE.Vector3(it.x, it.y, it.z),
        rotY: it.rotY,
        scale: new THREE.Vector3(it.w, it.h, it.d),
        color: it.tint,
      })),
    [items]
  );
  const ref = useInstances(list);
  const mats = useMemo(() => [cached("roof", roofMaterial), cached("plain", plainMaterial)], []);
  if (!items.length) return null;
  return (
    <instancedMesh
      key={list.length}
      ref={ref}
      args={[ROOFS[kind], mats, list.length]}
      castShadow={shadows}
      receiveShadow
    />
  );
}

export const WALL_TINTS = {
  pastel: ["#f6dc7a", "#f3a283", "#9cc9d6", "#f2c6a0", "#b9dccf", "#f5b9bf", "#e9cf94", "#f4ead5"],
  azulejo: ["#2f62b3", "#2a8a6f", "#c7932b", "#3c7bc4", "#8a3f9e"],
  artenova: ["#f0e2c4", "#cfe3d0", "#f1cdcd", "#cfdcef", "#efe0b0"],
  palheiro: ["#c8402c", "#2e6fb0", "#2e8b57", "#d9a21b", "#7b3f99"],
  lime: ["#ffffff", "#f8f4ea", "#f3efe4"],
  moderno: ["#f4f1ea", "#ece7dc", "#e2ddd2", "#f1e6d2"],
};

/** Deterministic tint pick. */
export function pickTint(list: readonly string[], seed: number) {
  return list[Math.floor(mulberry32(seed)() * list.length)];
}
