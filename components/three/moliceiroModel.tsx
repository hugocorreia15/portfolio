"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getSurface } from "@/lib/textures";
import { driveMaterial, getLampHaloMaterial, getLanternGlassMaterial } from "@/lib/nightMaterials";
import { registerLamps } from "@/lib/lampLights";
import { DAY } from "@/lib/daynight";

/**
 * A moliceiro built from scratch: a lofted flat-bottomed hull with the tall
 * swan-neck bow and its scroll, the raised stern, painted panels fore and aft,
 * the lug sail, rudder and the boatman with his pole. ~3k triangles, shared
 * between all boats; each palette gets its own painted hull.
 *
 * Built along +x (bow) — wrap in rotation-y = -π/2 for the +z-forward boats.
 */

export const BOAT_LENGTH = 7.2;
const L = BOAT_LENGTH;
const SECTIONS = 64;

export interface BoatPalette {
  bands: string[]; // sheer stripes, top first
  panel: string; // panel background
  frame: string; // panel border
  motif: "sun" | "fish" | "heart";
  caption: string;
}

export const PALETTES: BoatPalette[] = [
  { bands: ["#f4efe2", "#d6452e", "#f2b705", "#2e8b57"], panel: "#f6e3a1", frame: "#c93a2e", motif: "sun", caption: "RIA DE AVEIRO" },
  { bands: ["#f4efe2", "#2f6fae", "#f2b705", "#d6452e"], panel: "#cfe6ef", frame: "#2f6fae", motif: "fish", caption: "MAR E SAL" },
  { bands: ["#f4efe2", "#2e8b57", "#d6452e", "#f2b705"], panel: "#f3d3c6", frame: "#2e8b57", motif: "heart", caption: "AMOR DA RIA" },
];

// ── hull lines ──────────────────────────────────────────────────────────────

const smooth = (x: number) => Math.max(0, Math.min(1, x));

function halfBeam(t: number) {
  let hw = 0.6 * Math.pow(Math.sin(Math.PI * t), 0.55);
  if (t > 0.78) hw *= 1 - 0.86 * Math.pow(smooth((t - 0.78) / 0.22), 1.2); // the bow narrows to a blade
  return Math.max(hw, 0.035);
}

function keel(t: number) {
  let y = -0.22 + 0.15 * Math.pow(Math.abs(2 * t - 1), 3);
  if (t > 0.8) y += 1.55 * Math.pow((t - 0.8) / 0.2, 2.2);
  if (t < 0.1) y += 0.35 * Math.pow((0.1 - t) / 0.1, 2);
  return y;
}

function sheer(t: number) {
  let y = 0.38;
  if (t > 0.62) y += 2.1 * Math.pow((t - 0.62) / 0.38, 2.4);
  if (t < 0.22) y += 0.75 * Math.pow((0.22 - t) / 0.22, 2);
  return y;
}

// cross-section from the keel up to the sheer: (fraction of beam, fraction of height)
const SECTION: Array<[number, number]> = [
  [0, 0],
  [0.55, 0],
  [0.8, 0.08],
  [0.95, 0.45],
  [1, 1],
];

/** Outer skin (inner = true: the inside, slightly inboard, winding flipped). */
function hullGeometry(inner: boolean) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ring = SECTION.length * 2; // both sides, keel point duplicated per side
  for (let i = 0; i < SECTIONS; i++) {
    const t = i / (SECTIONS - 1);
    const x = (t - 0.5) * L;
    const hw = halfBeam(t) * (inner ? 0.93 : 1);
    const b = keel(t) + (inner ? 0.05 : 0);
    const top = sheer(t);
    for (const side of [-1, 1]) {
      const pts = side < 0 ? [...SECTION].reverse() : SECTION;
      for (const [fb, fh] of pts) {
        const y = b + (top - b) * fh;
        pos.push(x, y, side * hw * fb);
        // each side gets its own half of the texture, laid out so the paintings
        // read left-to-right from outside the boat
        const u = side > 0 ? t * 0.5 : 0.5 + (1 - t) * 0.5;
        uv.push(u, fh);
      }
    }
  }
  for (let i = 0; i < SECTIONS - 1; i++) {
    for (let k = 0; k < ring - 1; k++) {
      if (k === SECTION.length - 1) continue; // the seam between the two sides
      const a = i * ring + k;
      const b = a + ring;
      if (inner) idx.push(a, a + 1, b, a + 1, b + 1, b);
      else idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * An invisible lid over the open hull, following the gunwales. It writes depth
 * only and is drawn after the boat but before the water (renderOrder), so the
 * water plane — which runs on under the boat — never shows inside the hull.
 */
function deckMaskGeometry() {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < SECTIONS; i++) {
    const t = i / (SECTIONS - 1);
    const x = (t - 0.5) * L;
    const hw = halfBeam(t) + 0.02;
    const y = sheer(t);
    pos.push(x, y, -hw, x, y, hw);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** The lug sail: a bellied quad between the foot, the peak and the head. */
function sailGeometry() {
  const xm = 0.1 * L;
  const A = new THREE.Vector3(xm + 0.25, 0.75, 0); // tack
  const B = new THREE.Vector3(xm - 2.9, 0.62, 0); // clew
  const C = new THREE.Vector3(xm - 2.5, 3.85, 0); // peak
  const D = new THREE.Vector3(xm + 0.05, 4.3, 0); // throat
  const n = 10;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = j / n;
      p.lerpVectors(A, B, u);
      q.lerpVectors(D, C, u);
      p.lerp(q, v);
      p.z = 0.28 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v); // wind in the belly
      pos.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let shared: {
  outer: THREE.BufferGeometry;
  inner: THREE.BufferGeometry;
  sail: THREE.BufferGeometry;
  mask: THREE.BufferGeometry;
  maskMat: THREE.MeshBasicMaterial;
  sailMat: THREE.MeshStandardMaterial;
  innerMat: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
} | null = null;

function getShared() {
  if (shared) return shared;
  const sailCanvas = document.createElement("canvas");
  sailCanvas.width = sailCanvas.height = 256;
  const ctx = sailCanvas.getContext("2d")!;
  ctx.fillStyle = "#efe5cb";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 1; i < 7; i++) {
    ctx.fillStyle = "rgba(120, 95, 60, 0.18)";
    ctx.fillRect((i * 256) / 7 - 1, 0, 2, 256);
  }
  ctx.fillStyle = "rgba(120, 95, 60, 0.25)";
  ctx.fillRect(0, 0, 256, 6);
  ctx.fillRect(0, 250, 256, 6);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(90,70,40,${(Math.random() * 0.05).toFixed(3)})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const sailMap = new THREE.CanvasTexture(sailCanvas);
  sailMap.colorSpace = THREE.SRGBColorSpace;
  shared = {
    outer: hullGeometry(false),
    inner: hullGeometry(true),
    sail: sailGeometry(),
    mask: deckMaskGeometry(),
    maskMat: new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }),
    // the canvas glows a little by day, so its shaded side never reads as grey
    sailMat: driveMaterial(
      new THREE.MeshStandardMaterial({
        map: sailMap,
        emissiveMap: sailMap,
        emissive: "#ffffff",
        roughness: 0.92,
        side: THREE.DoubleSide,
      }),
      (m, night) => {
        m.emissiveIntensity = 0.32 * (1 - night);
      }
    ),
    innerMat: new THREE.MeshStandardMaterial({ color: "#8a6a47", ...getSurface("wood", 6, 1) }),
    woodMat: new THREE.MeshStandardMaterial({ color: "#7d5c3a", roughness: 0.8 }),
  };
  return shared;
}

// ── painted hull ────────────────────────────────────────────────────────────

const TW = 2048;
const TH = 512;

function paintPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: BoatPalette,
  big: boolean
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.clip();
  // sky and the ria
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, pal.panel);
  g.addColorStop(0.62, "#fffaf0");
  g.addColorStop(0.62, "#5b9cc4");
  g.addColorStop(1, "#2f6f9a");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // waves
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const wy = y + h * (0.7 + k * 0.08);
    for (let i = 0; i <= 12; i++) {
      const wx = x + (w * i) / 12;
      ctx.lineTo(wx, wy + Math.sin(i * 1.4 + k) * 4);
    }
    ctx.stroke();
  }
  const cx = x + w * 0.5;
  const cy = y + h * 0.36;
  const r = Math.min(w, h) * (big ? 0.2 : 0.18);
  if (pal.motif === "sun") {
    ctx.fillStyle = "#f2b705";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e07b10";
    ctx.lineWidth = 4;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
      ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
      ctx.stroke();
    }
  } else if (pal.motif === "fish") {
    ctx.fillStyle = "#d6452e";
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.4, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.3, cy);
    ctx.lineTo(cx - r * 2.1, cy - r * 0.7);
    ctx.lineTo(cx - r * 2.1, cy + r * 0.7);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx + r * 0.8, cy - r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#d6452e";
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.1);
    ctx.bezierCurveTo(cx - r * 1.8, cy - r * 0.2, cx - r * 0.7, cy - r * 1.5, cx, cy - r * 0.5);
    ctx.bezierCurveTo(cx + r * 0.7, cy - r * 1.5, cx + r * 1.8, cy - r * 0.2, cx, cy + r * 1.1);
    ctx.fill();
  }
  // flowers in the corners, as on the real panels
  for (const [fx, fy] of [
    [x + w * 0.12, y + h * 0.12],
    [x + w * 0.88, y + h * 0.12],
  ]) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.fillStyle = pal.frame;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2b705";
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // frame
  ctx.strokeStyle = pal.frame;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  for (let k = 0; k < 14; k++) {
    ctx.beginPath();
    ctx.arc(x + (w * (k + 0.5)) / 14, y + 1, 2, 0, Math.PI * 2);
    ctx.arc(x + (w * (k + 0.5)) / 14, y + h - 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // caption plate
  if (big) {
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(x + 8, y + h + 10, w - 16, 34);
    ctx.fillStyle = "#1d1b1c";
    ctx.font = "bold 24px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pal.caption, x + w / 2, y + h + 28, w - 24);
  }
}

const hullCache = new Map<BoatPalette, THREE.MeshStandardMaterial>();

function hullMaterial(pal: BoatPalette) {
  let mat = hullCache.get(pal);
  if (mat) return mat;
  const canvas = document.createElement("canvas");
  canvas.width = TW;
  canvas.height = TH;
  const ctx = canvas.getContext("2d")!;
  // tarred black hull with planking seams
  ctx.fillStyle = "#17191b";
  ctx.fillRect(0, 0, TW, TH);
  for (let k = 1; k < 8; k++) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, (TH * k) / 8, TW, 2);
  }
  // sheer stripes along the gunwale (v = 1 is the top of the canvas)
  pal.bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * 13, TW, i === 0 ? 8 : 12);
  });
  // panels: bow (t 0.70–0.93) and stern (t 0.04–0.17), on both halves
  const half = TW / 2;
  const px = (t: number, side: number) => (side > 0 ? t * half : half + (1 - t) * half);
  for (const side of [1, -1]) {
    const bx0 = Math.min(px(0.7, side), px(0.93, side));
    const bx1 = Math.max(px(0.7, side), px(0.93, side));
    paintPanel(ctx, bx0, TH * 0.16, bx1 - bx0, TH * 0.44, pal, true);
    const sx0 = Math.min(px(0.04, side), px(0.17, side));
    const sx1 = Math.max(px(0.04, side), px(0.17, side));
    paintPanel(ctx, sx0, TH * 0.18, sx1 - sx0, TH * 0.4, pal, false);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  mat = new THREE.MeshStandardMaterial({ map, roughness: 0.55, emissiveMap: map, emissive: "#ffffff" });
  // a touch of self-light keeps the paintwork vivid by day, gone at night
  driveMaterial(mat, (m, night) => {
    m.emissiveIntensity = 0.16 * (1 - night);
  });
  hullCache.set(pal, mat);
  return mat;
}

// ── lanterns ────────────────────────────────────────────────────────────────

// a small iron lantern (centred on its glass), hung at the bow and the stern
const LANTERN = (() => {
  const iron = mergeGeometries([
    new THREE.BoxGeometry(0.17, 0.025, 0.17).translate(0, -0.1, 0),
    new THREE.ConeGeometry(0.12, 0.09, 4).rotateY(Math.PI / 4).translate(0, 0.135, 0),
    new THREE.TorusGeometry(0.035, 0.008, 4, 10).translate(0, 0.2, 0),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => new THREE.BoxGeometry(0.014, 0.18, 0.014).translate(sx * 0.068, 0, sz * 0.068))
    ),
  ]);
  const glass = new THREE.BoxGeometry(0.12, 0.17, 0.12);
  return { iron, glass };
})();
const LANTERN_IRON = new THREE.MeshStandardMaterial({ color: "#1f2226", roughness: 0.5, metalness: 0.5 });

function Lantern() {
  return (
    <>
      <mesh geometry={LANTERN.glass} material={getLanternGlassMaterial()} />
      <mesh geometry={LANTERN.iron} material={LANTERN_IRON} />
      <sprite scale={[1.2, 1.2, 1]} material={getLampHaloMaterial()} />
    </>
  );
}

// ── the boat ────────────────────────────────────────────────────────────────

/** Bow lantern hangs off the swan neck, the stern one sits on the stern post. */
const BOW_LANTERN: [number, number, number] = [0.5 * L + 0.24, 1.94, 0];
const STERN_LANTERN: [number, number, number] = [-0.5 * L + 0.15, 1.4, 0];

export function MoliceiroModel({
  palette = 0,
  crew = true,
  lampPriority = false,
}: {
  palette?: number;
  crew?: boolean;
  /** keep this boat's lanterns among the lit lamps (the player's boat) */
  lampPriority?: boolean;
}) {
  const pal = PALETTES[palette % PALETTES.length];
  const parts = useMemo(() => getShared(), []);
  const hull = useMemo(() => hullMaterial(pal), [pal]);
  const tipX = 0.5 * L;
  const tipY = sheer(1);
  const mastX = 0.1 * L;

  // the two lanterns are moving lamps: they light the hull and the water
  const bow = useRef<THREE.Group>(null);
  const stern = useRef<THREE.Group>(null);
  const lamps = useRef([new THREE.Vector3(), new THREE.Vector3()]);
  useEffect(
    () => registerLamps(lamps.current, { priority: lampPriority, power: 0.85 }),
    [lampPriority]
  );
  // the rudder follows the turn (its tiller swings the other way), the boatman
  // turns and leans into it and works his pole while the boat moves — all read
  // from how the boat group (the parent) moves, so every boat gets it
  const root = useRef<THREE.Group>(null);
  const rudder = useRef<THREE.Group>(null);
  const boatman = useRef<THREE.Group>(null);
  const pole = useRef<THREE.Mesh>(null);
  const motion = useRef({ yaw: 0, x: 0, z: 0, steer: 0, speed: 0, phase: 0, seeded: false });

  useFrame((_, dt) => {
    if (DAY.night >= 0.02) {
      bow.current?.getWorldPosition(lamps.current[0]);
      stern.current?.getWorldPosition(lamps.current[1]);
    }
    const boat = root.current?.parent;
    if (!boat || dt <= 0) return;
    const m = motion.current;
    const step = Math.min(dt, 0.1);
    const { x, z } = boat.position;
    if (!m.seeded) {
      Object.assign(m, { yaw: boat.rotation.y, x, z, seeded: true });
    }
    const dYaw = Math.atan2(Math.sin(boat.rotation.y - m.yaw), Math.cos(boat.rotation.y - m.yaw));
    const v = Math.hypot(x - m.x, z - m.z) / step / Math.max(boat.scale.x, 0.1);
    Object.assign(m, { yaw: boat.rotation.y, x, z });
    // turning to starboard lowers the heading; the blade then swings to starboard
    const steer = THREE.MathUtils.clamp((-dYaw / step) * 0.9, -0.55, 0.55);
    m.steer = THREE.MathUtils.damp(m.steer, steer, 5, step);
    if (v < 40) m.speed = THREE.MathUtils.damp(m.speed, v, 3, step); // ignore teleports
    const pull = THREE.MathUtils.clamp(m.speed / 4, 0, 1);
    m.phase += step * (1.1 + pull * 1.5);
    if (rudder.current) rudder.current.rotation.y = m.steer;
    if (boatman.current) {
      boatman.current.rotation.y = m.steer * 0.7;
      boatman.current.rotation.x = -m.steer * 0.12;
      boatman.current.rotation.z = Math.sin(m.phase) * 0.06 * pull; // leaning into each stroke
    }
    if (pole.current) {
      pole.current.rotation.z = -0.5 + Math.sin(m.phase) * 0.3 * pull;
      pole.current.rotation.x = 0.25 - m.steer * 0.6;
    }
  });

  return (
    <group ref={root} rotation-y={-Math.PI / 2}>
      {/* lanterns: an arm off the swan neck, a short post on the stern */}
      <group ref={bow} position={BOW_LANTERN}>
        <Lantern />
      </group>
      <mesh position={[0.5 * L + 0.12, 2.16, 0]} rotation-z={Math.PI / 2} material={parts.woodMat}>
        <cylinderGeometry args={[0.018, 0.018, 0.3, 5]} />
      </mesh>
      <mesh position={[BOW_LANTERN[0], 2.1, 0]} material={LANTERN_IRON}>
        <cylinderGeometry args={[0.006, 0.006, 0.1, 4]} />
      </mesh>
      <group ref={stern} position={STERN_LANTERN}>
        <Lantern />
      </group>
      <mesh position={[STERN_LANTERN[0], 1.13, 0]} material={parts.woodMat}>
        <cylinderGeometry args={[0.03, 0.035, 0.36, 6]} />
      </mesh>
      <mesh geometry={parts.outer} material={hull} castShadow />
      <mesh geometry={parts.inner} material={parts.innerMat} receiveShadow />
      <mesh geometry={parts.mask} material={parts.maskMat} renderOrder={1} />
      {/* the scroll (ponteira) curling back off the swan-neck bow */}
      <mesh position={[tipX - 0.12, tipY + 0.12, 0]} rotation-z={Math.PI * 0.15}>
        <torusGeometry args={[0.2, 0.05, 8, 18, Math.PI * 1.45]} />
        <meshStandardMaterial color={pal.bands[1]} roughness={0.6} />
      </mesh>
      {/* thwarts */}
      {[-1.6, -0.3, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.18, 0]} material={parts.woodMat}>
          <boxGeometry args={[0.22, 0.06, 1.0]} />
        </mesh>
      ))}
      {/* mast, yard and the sail */}
      <mesh position={[mastX, 2.1, 0]} rotation-z={-0.05} material={parts.woodMat} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 4.6, 8]} />
      </mesh>
      <mesh
        position={[mastX - 1.22, 4.08, 0.02]}
        rotation-z={Math.atan2(4.3 - 3.85, 2.55) + Math.PI / 2}
        material={parts.woodMat}
      >
        <cylinderGeometry args={[0.03, 0.03, 2.75, 6]} />
      </mesh>
      <mesh geometry={parts.sail} material={parts.sailMat} castShadow />
      {/* rudder and tiller, turning about the stern post */}
      <group ref={rudder} position={[-0.5 * L - 0.05, 0, 0]}>
        <mesh position={[-0.25, 0.2, 0]} rotation-z={0.12}>
          <boxGeometry args={[0.6, 1.2, 0.06]} />
          <meshStandardMaterial color="#1f2224" roughness={0.6} />
        </mesh>
        <mesh position={[0.35, 0.86, 0]} rotation-z={-1.25} material={parts.woodMat}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
        </mesh>
      </group>
      {crew && (
        <group ref={boatman} position={[-2.25, -0.12, 0.05]}>
          <mesh position-y={0.42} castShadow>
            <cylinderGeometry args={[0.13, 0.17, 0.72, 8]} />
            <meshStandardMaterial color="#2b2b35" roughness={0.9} />
          </mesh>
  // the two lanterns are moving lamps: they light the hull and the water
  const bow = useRef<THREE.Group>(null);
  const stern = useRef<THREE.Group>(null);
  const lamps = useRef([new THREE.Vector3(), new THREE.Vector3()]);
  useEffect(
    () => registerLamps(lamps.current, { priority: lampPriority, power: 0.85 }),
    [lampPriority]
  );
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    if (DAY.night < 0.02) return;
    bow.current?.getWorldPosition(lamps.current[0]);
    stern.current?.getWorldPosition(lamps.current[1]);
  });

            <sphereGeometry args={[0.13, 10, 8]} />
            <meshStandardMaterial color="#e8b88f" roughness={0.8} />
          </mesh>
          <mesh position-y={1.02}>
            <cylinderGeometry args={[0.17, 0.17, 0.04, 10]} />
            <meshStandardMaterial color="#1c1c22" roughness={0.9} />
          </mesh>
          {/* the vara he punts with */}
          <mesh ref={pole} position={[0.4, 0.55, 0.35]} rotation-z={-0.5} rotation-x={0.25} material={parts.woodMat}>
            <cylinderGeometry args={[0.022, 0.022, 3, 6]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
