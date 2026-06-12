import * as THREE from "three";
import type { PortDef } from "@/lib/ports";

/**
 * A geographically faithful (stylized) map of central Aveiro.
 * Coordinates are sketched from the real canal layout and scaled by S;
 * channel half-widths are absolute so canals stay ~2 boat-lengths wide.
 * North is -z, east is +x.
 */
const S = 1.7;
const V = (x: number, z: number) => new THREE.Vector3(x * S, 0, z * S);
/** position helper for JSX: raw map coords -> scaled [x, y, z] */
export const P = (x: number, z: number, y = 0): [number, number, number] => [x * S, y, z * S];
export const AVEIRO_SCALE = S;

interface Channel {
  name: string;
  pts: THREE.Vector3[];
  halfW: number;
}

const CHANNELS: Channel[] = [
  { name: "Canal das Pirâmides", pts: [V(-46, 8), V(-32, 8), V(-18, 6)], halfW: 5 },
  { name: "Canal Central (oeste)", pts: [V(-18, 6), V(-4, 1), V(4, -2)], halfW: 5.5 },
  { name: "Canal Central (este)", pts: [V(4, -2), V(14, -7), V(24, -11)], halfW: 5.5 },
  { name: "Canal do Cojo", pts: [V(24, -11), V(33, -13), V(40, -15)], halfW: 4.5 },
  { name: "Lago da Fonte Nova", pts: [V(40, -15), V(52, -17)], halfW: 9.5 },
  { name: "Canal de São Roque (este)", pts: [V(-18, 6), V(-17, -8), V(-12, -20)], halfW: 4.5 },
  {
    name: "Canal de São Roque (oeste)",
    pts: [V(-12, -20), V(-22, -20), V(-34, -23), V(-44, -22), V(-52, -16), V(-56, 2)],
    halfW: 4.5,
  },
  { name: "Canal dos Botirões", pts: [V(4, -2), V(-1, -11), V(-12, -20)], halfW: 4 },
  { name: "Ria (sul)", pts: [V(-46, 8), V(-58, 18), V(-64, 30)], halfW: 22 },
  { name: "Ria (São Roque)", pts: [V(-56, 2), V(-58, 18)], halfW: 18 },
  { name: "Ria (Barra)", pts: [V(-58, 18), V(-72, 14)], halfW: 15 },
];

// ---------------------------------------------------------------- graph

interface Edge extends Channel {
  cum: number[];
  length: number;
  aKey: string;
  bKey: string;
}

const nodeKey = (p: THREE.Vector3) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`;

const EDGES: Edge[] = CHANNELS.map((c) => {
  const cum = [0];
  for (let i = 1; i < c.pts.length; i++) {
    cum.push(cum[i - 1] + c.pts[i].distanceTo(c.pts[i - 1]));
  }
  return {
    ...c,
    cum,
    length: cum[cum.length - 1],
    aKey: nodeKey(c.pts[0]),
    bKey: nodeKey(c.pts[c.pts.length - 1]),
  };
});

const ADJ = new Map<string, number[]>();
EDGES.forEach((e, i) => {
  ADJ.set(e.aKey, [...(ADJ.get(e.aKey) ?? []), i]);
  ADJ.set(e.bKey, [...(ADJ.get(e.bKey) ?? []), i]);
});

function pointAtEdge(e: Edge, s: number, out: THREE.Vector3) {
  s = THREE.MathUtils.clamp(s, 0, e.length);
  let i = 0;
  while (i < e.cum.length - 2 && e.cum[i + 1] < s) i++;
  const segLen = e.cum[i + 1] - e.cum[i] || 1e-6;
  return out.copy(e.pts[i]).lerp(e.pts[i + 1], (s - e.cum[i]) / segLen);
}

/** Polyline points from arc position s0 to s1 along an edge (either direction). */
function slicePts(e: Edge, s0: number, s1: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [pointAtEdge(e, s0, new THREE.Vector3())];
  if (s1 >= s0) {
    for (let i = 0; i < e.pts.length; i++) {
      if (e.cum[i] > s0 + 0.3 && e.cum[i] < s1 - 0.3) pts.push(e.pts[i].clone());
    }
  } else {
    for (let i = e.pts.length - 1; i >= 0; i--) {
      if (e.cum[i] < s0 - 0.3 && e.cum[i] > s1 + 0.3) pts.push(e.pts[i].clone());
    }
  }
  pts.push(pointAtEdge(e, s1, new THREE.Vector3()));
  return pts;
}

function locate(pos: THREE.Vector3) {
  let bestE = 0;
  let bestS = 0;
  let bestD = Infinity;
  EDGES.forEach((e, ei) => {
    for (let i = 0; i < e.pts.length - 1; i++) {
      const a = e.pts[i];
      const b = e.pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1e-6;
      const t = THREE.MathUtils.clamp(
        ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / len2,
        0,
        1
      );
      const d = Math.hypot(pos.x - (a.x + abx * t), pos.z - (a.z + abz * t));
      if (d < bestD) {
        bestD = d;
        bestE = ei;
        bestS = e.cum[i] + Math.sqrt(len2) * t;
      }
    }
  });
  return { e: bestE, s: bestS, d: bestD };
}

// ---------------------------------------------------------------- ports

const SEEDS: Array<Pick<PortDef, "id" | "label" | "caisName" | "accent">> = [
  { id: "about", label: "About Me", caisName: "Praça do Peixe", accent: "#f59e0b" },
  { id: "experience", label: "Experience", caisName: "Cais do Rossio", accent: "#ef4444" },
  { id: "projects", label: "Projects", caisName: "Costa Nova", accent: "#3b82f6" },
  { id: "skills", label: "Skills", caisName: "Marinha da Troncalhada", accent: "#10b981" },
  { id: "education", label: "Education", caisName: "Cais da Fonte Nova", accent: "#8b5cf6" },
  { id: "contact", label: "Contact", caisName: "Farol da Barra", accent: "#ec4899" },
];

function netPort(
  seed: (typeof SEEDS)[number],
  rawX: number,
  rawZ: number,
  outX: number,
  outZ: number
): PortDef {
  const point = V(rawX, rawZ);
  const outward = new THREE.Vector3(outX, 0, outZ).normalize();
  const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
  return {
    ...seed,
    t: 0,
    point,
    tangent,
    outward,
    dockPos: point.clone().addScaledVector(outward, 4.2),
    landmarkPos: point.clone().addScaledVector(outward, 11.5),
    faceIn: Math.atan2(-outward.x, -outward.z),
  };
}

export const AVEIRO_PORTS: PortDef[] = [
  netPort(SEEDS[0], -6.5, -15.5, -0.21, 0.98), // Beira-Mar island, on the Botirões
  netPort(SEEDS[1], -11, 3.4, 0.34, 0.94), // Art Nouveau bank of Canal Central
  netPort(SEEDS[2], -64, 30, -0.45, 0.89), // out in the ria, toward the coastal spit
  netPort(SEEDS[3], -28, -21.5, -0.24, 0.97), // salinas south of São Roque
  netPort(SEEDS[4], 47, -16.2, 0.164, 0.986), // south shore of Fonte Nova lake
  netPort(SEEDS[5], -72, 14, -0.96, -0.27), // lagoon mouth, far west
];

const PORT_LOCS = AVEIRO_PORTS.map((p) => locate(p.point));

export const AVEIRO_START = {
  pos: V(18, -9),
  heading: Math.atan2(6.8 - 30.6, -3.4 + 15.3), // facing down Canal Central, away from the Praça
};

// ---------------------------------------------------------------- routing

export function buildAveiroRoute(
  from: THREE.Vector3,
  portIndex: number
): { curve: THREE.CatmullRomCurve3; length: number } | null {
  const A = locate(from);
  const B = PORT_LOCS[portIndex];
  let pts: THREE.Vector3[];

  if (A.e === B.e) {
    pts = [from.clone(), ...slicePts(EDGES[A.e], A.s, B.s)];
  } else {
    const eA = EDGES[A.e];
    const eB = EDGES[B.e];
    const dist = new Map<string, number>();
    const prev = new Map<string, { node: string; e: number } | null>();
    dist.set(eA.aKey, A.s);
    prev.set(eA.aKey, null);
    if ((dist.get(eA.bKey) ?? Infinity) > eA.length - A.s) {
      dist.set(eA.bKey, eA.length - A.s);
      prev.set(eA.bKey, null);
    }
    const done = new Set<string>();
    for (;;) {
      let u: string | null = null;
      let best = Infinity;
      dist.forEach((d, k) => {
        if (!done.has(k) && d < best) {
          best = d;
          u = k;
        }
      });
      if (u === null) break;
      done.add(u);
      for (const ei of ADJ.get(u) ?? []) {
        const e = EDGES[ei];
        const v = e.aKey === u ? e.bKey : e.aKey;
        const nd = best + e.length;
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          prev.set(v, { node: u, e: ei });
        }
      }
    }

    const viaA = (dist.get(eB.aKey) ?? Infinity) + B.s;
    const viaB = (dist.get(eB.bKey) ?? Infinity) + (eB.length - B.s);
    if (!isFinite(Math.min(viaA, viaB))) return null;
    const entry = viaA <= viaB ? eB.aKey : eB.bKey;

    // walk the predecessor chain back to the start edge
    const chain: { node: string; e: number }[] = [];
    let cur = entry;
    for (;;) {
      const p = prev.get(cur);
      if (!p) break;
      chain.push({ node: cur, e: p.e });
      cur = p.node;
    }

    pts = [from.clone(), ...slicePts(eA, A.s, cur === eA.aKey ? 0 : eA.length)];
    for (let i = chain.length - 1; i >= 0; i--) {
      const e = EDGES[chain[i].e];
      const arriveAtA = e.aKey === chain[i].node;
      pts.push(...slicePts(e, arriveAtA ? e.length : 0, arriveAtA ? 0 : e.length).slice(1));
    }
    pts.push(...slicePts(eB, entry === eB.aKey ? 0 : eB.length, B.s).slice(1));
  }

  const clean: THREE.Vector3[] = [];
  for (const p of pts) {
    if (!clean.length || clean[clean.length - 1].distanceTo(p) > 0.6) clean.push(p);
  }
  if (clean.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(clean, false, "centripetal", 0.5);
  const length = curve.getLength();
  return length < 2 ? null : { curve, length };
}

// ---------------------------------------------------------------- constraint

/** Marsh islets out in the ria — scenery and keep-out zones. */
export const MARSH_ISLETS: Array<{ x: number; z: number; r: number }> = [
  { x: -52 * S, z: 26 * S, r: 6 },
  { x: -62 * S, z: 10 * S, r: 5 },
  { x: -70 * S, z: 26 * S, r: 4.5 },
  { x: -56 * S, z: 36 * S, r: 5 },
];

const KEEPOUTS: Array<{ x: number; z: number; r: number }> = [
  // outer half of each pier
  ...AVEIRO_PORTS.map((p) => {
    const c = p.point.clone().addScaledVector(p.outward, 3.2);
    return { x: c.x, z: c.z, r: 0.9 };
  }),
  ...MARSH_ISLETS.map((m) => ({ ...m, r: m.r + 1.2 })),
];

const BANK_MARGIN = 1.6;

/** Keep the boat inside the canal network (and out of islets/piers). */
export function constrainAveiro(pos: THREE.Vector3): boolean {
  let bestDepth = -Infinity;
  let cx = 0;
  let cz = 0;
  let cd = 0;
  let cw = 0;
  for (const e of EDGES) {
    for (let i = 0; i < e.pts.length - 1; i++) {
      const a = e.pts[i];
      const b = e.pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1e-6;
      const t = THREE.MathUtils.clamp(
        ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / len2,
        0,
        1
      );
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const d = Math.hypot(pos.x - px, pos.z - pz);
      const depth = e.halfW - d;
      if (depth > bestDepth) {
        bestDepth = depth;
        cx = px;
        cz = pz;
        cd = d;
        cw = e.halfW;
      }
    }
  }

  let hit = false;
  if (bestDepth < BANK_MARGIN) {
    const d = cd || 0.001;
    const k = (cw - BANK_MARGIN) / d;
    pos.x = cx + (pos.x - cx) * k;
    pos.z = cz + (pos.z - cz) * k;
    hit = true;
  }
  for (const c of KEEPOUTS) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const min = c.r + 2.0;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.001;
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
      hit = true;
    }
  }
  return hit;
}

// ---------------------------------------------------------------- scenery data

export interface BridgeDef {
  pos: [number, number, number];
  rotY: number;
  r: number;
  span: number;
}

const bridge = (
  rawX: number,
  rawZ: number,
  dirX: number,
  dirZ: number,
  r: number,
  span: number
): BridgeDef => ({ pos: P(rawX, rawZ), rotY: Math.atan2(dirX, dirZ), r, span });

export const AVEIRO_BRIDGES: BridgeDef[] = [
  bridge(19, -9.4, 0.93, -0.37, 6.3, 12), // Ponte-Praça — the canal runs under the main square
  bridge(33, -13, 0.97, -0.24, 5.3, 4), // Ponte do Cojo
  bridge(-17, -20, -1, 0, 5.3, 2.6), // Ponte de Carcassonne
  bridge(1.5, -6.5, -0.49, -0.87, 4.8, 2.8), // Ponte dos Botirões
  bridge(-39, 8, 1, 0, 5.8, 4), // Ponte das Pirâmides
];

/** Ambience loop for the extra moliceiros, circling the open ria. */
export const AVEIRO_AMBIENT = new THREE.CatmullRomCurve3(
  [V(-50, 18), V(-58, 8), V(-66, 18), V(-58, 28)],
  true,
  "centripetal"
);
