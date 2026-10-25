import * as THREE from "three";
import type { PortDef } from "@/lib/ports";
import network from "@/data/aveiro-network.json";

/**
 * The real Aveiro canal network (centrelines from scripts/fetch-aveiro-canals.mjs,
 * rescaled by scripts/bake-aveiro.py; data © OpenStreetMap contributors, ODbL).
 * World units are 0.3 u/m — real scale for the city — with the origin at the
 * Praça Humberto Delgado and north = -z. Costa Nova and the Barra, ~7 km west
 * in reality, sit on stylised spits at the edge of the ria.
 */

export const AVEIRO_REGION = network.region as [number, number, number, number];

interface BakedEdge {
  name?: string;
  pts: [number, number][];
}
interface BakedPoi {
  name: string;
  x: number;
  z: number;
}

const BAKED_EDGES = network.edges as BakedEdge[];
const POIS = network.pois as BakedPoi[];

const V3 = (x: number, z: number) => new THREE.Vector3(x, 0, z);

function poi(pattern: RegExp): THREE.Vector3 | null {
  const hits = POIS.filter((p) => pattern.test(p.name));
  if (!hits.length) return null;
  const x = hits.reduce((a, p) => a + p.x, 0) / hits.length;
  const z = hits.reduce((a, p) => a + p.z, 0) / hits.length;
  return V3(x, z);
}

// ---------------------------------------------------------------- channels

export interface Channel {
  name?: string;
  pts: THREE.Vector3[];
  halfW: number;
  /** city canals get quays and houses; ria water does not */
  city: boolean;
}

// navigable half-widths: the baked water is at least this wide (scripts/bake-aveiro.py)
const HALFW_BY_NAME: Array<[RegExp, number]> = [
  [/Principal|Cale da Vala/i, 9],
  [/Côjo|Pirâmides|São Roque|Moliceiros|Paraíso/i, 3.6],
];

function halfWFor(name?: string) {
  if (name) {
    for (const [re, w] of HALFW_BY_NAME) if (re.test(name)) return w;
  }
  return 3.6;
}

export const CHANNELS: Channel[] = [
  ...BAKED_EDGES.map((e) => {
    const halfW = halfWFor(e.name);
    return {
      name: e.name,
      pts: e.pts.map(([x, z]) => V3(x, z)),
      halfW,
      city: halfW <= 7,
    };
  }),
  // the lake and the open ria are not OSM waterway centrelines — added by hand
  {
    name: "Lago da Fonte Nova",
    pts: [V3(253.72, 35.05), V3(245, 57), V3(238, 76)],
    halfW: 4.5,
    city: false,
  },
  {
    name: "Ria — Costa Nova",
    pts: [V3(-335.72, -99.25), V3(-330, -30), V3(-338, 55)],
    halfW: 12,
    city: false,
  },
  {
    name: "Ria — Barra",
    pts: [V3(-335.72, -99.25), V3(-348, -150)],
    halfW: 10,
    city: false,
  },
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
  { id: "publications", label: "Publications", caisName: "Centro de Congressos", accent: "#0d9488" },
  { id: "projects", label: "Projects", caisName: "Costa Nova", accent: "#3b82f6" },
  { id: "skills", label: "Skills", caisName: "Marinha da Troncalhada", accent: "#10b981" },
  { id: "education", label: "Education", caisName: "Cais do Côjo", accent: "#8b5cf6" },
  { id: "contact", label: "Contact", caisName: "Farol da Barra", accent: "#ec4899" },
];

function anchoredPort(
  seed: (typeof SEEDS)[number],
  anchor: THREE.Vector3,
  opts: {
    sShift?: number;
    flipOut?: boolean;
    outTo?: THREE.Vector3;
    landmarkDist?: number;
    platformR?: number;
    /** moor this far off the centreline, alongside the quay */
    moor?: number;
  } = {}
): PortDef {
  const loc = locate(anchor);
  const edge = EDGES[loc.e];
  const s = THREE.MathUtils.clamp(loc.s + (opts.sShift ?? 0), 4, edge.length - 4);
  const point = pointAtEdge(edge, s, new THREE.Vector3());
  const outward = (opts.outTo ?? anchor).clone().sub(point).setY(0);
  if (outward.lengthSq() < 0.05) outward.set(0, 0, 1);
  outward.normalize();
  if (opts.flipOut) outward.negate();
  point.addScaledVector(outward, opts.moor ?? 1.6);
  const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
  return {
    ...seed,
    t: 0,
    point,
    tangent,
    outward,
    dockPos: point.clone().addScaledVector(outward, 3.2),
    landmarkPos: point.clone().addScaledVector(outward, opts.landmarkDist ?? 9),
    faceIn: Math.atan2(-outward.x, -outward.z),
    platformR: opts.platformR,
  };
}

const A_PEIXE = poi(/Praça do Peixe/) ?? V3(-39, -56);
const A_ARTENOVA = poi(/Museu Arte Nova/) ?? V3(-45.8, -39.9);
const A_TRONCALHADA = poi(/Troncalhada/) ?? V3(-232.7, -116.4);
const A_CONGRESSO = poi(/Câmara Municipal.*Congressos/) ?? V3(259.4, 90.5);
const A_HUMBERTO = poi(/Humberto Delgado/) ?? V3(3.9, -24.6);

export const AVEIRO_PORTS: PortDef[] = [
  anchoredPort(SEEDS[0], A_PEIXE, { platformR: 5.5, landmarkDist: 8.6 }),
  anchoredPort(SEEDS[1], A_ARTENOVA, { platformR: 5.5, landmarkDist: 8.6 }),
  // the old ceramics factory, today's congress centre, by the Fonte Nova lake
  anchoredPort(SEEDS[2], A_CONGRESSO, { platformR: 7, landmarkDist: 11, moor: 2.6 }),
  anchoredPort(SEEDS[3], V3(-338, 55), { outTo: V3(-380, 62), landmarkDist: 24, moor: 6 }),
  anchoredPort(SEEDS[4], A_TRONCALHADA, { landmarkDist: 9.5 }),
  // south bank of the Côjo, on the side of the university campus
  anchoredPort(SEEDS[5], V3(125, -24), { outTo: V3(128, -60), platformR: 6, landmarkDist: 9 }),
  anchoredPort(SEEDS[6], V3(-348, -150), { outTo: V3(-390, -158), landmarkDist: 22, moor: 5 }),
];

const startLoc = locate(A_HUMBERTO);
const startS = Math.max(startLoc.s - 20, 6);
const startPos = pointAtEdge(EDGES[startLoc.e], startS, new THREE.Vector3());
const startAhead = pointAtEdge(EDGES[startLoc.e], startS + 2, new THREE.Vector3());
export const AVEIRO_START = {
  pos: startPos,
  heading: Math.atan2(startAhead.x - startPos.x, startAhead.z - startPos.z),
};

// ---------------------------------------------------------------- routing

const PORT_LOCS = AVEIRO_PORTS.map((p) => locate(p.point));

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
      pts.push(
        ...slicePts(e, arriveAtA ? e.length : 0, arriveAtA ? 0 : e.length).slice(1)
      );
    }
    pts.push(...slicePts(eB, entry === eB.aKey ? 0 : eB.length, B.s).slice(1));
  }

  pts.push(AVEIRO_PORTS[portIndex].point.clone());
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

/** Salt-marsh islets dotting the stylised open ria. */
export const MARSH_ISLETS: Array<{ x: number; z: number; r: number }> = [
  { x: -372, z: -40, r: 9 },
  { x: -305, z: 92, r: 7 },
  { x: -392, z: -230, r: 11 },
  { x: -300, z: -40, r: 5 },
];

const KEEPOUTS: Array<{ x: number; z: number; r: number }> = [
  ...AVEIRO_PORTS.map((p) => {
    const c = p.point.clone().addScaledVector(p.outward, 3.2);
    return { x: c.x, z: c.z, r: 0.9 };
  }),
  ...MARSH_ISLETS.map((m) => ({ ...m, r: m.r + 1.2 })),
];

const BANK_MARGIN = 1.1;
const HULL_R = 1.3; // the boat sails at 0.62 scale on this map

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
    const min = c.r + HULL_R;
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

// ---------------------------------------------------------------- scenery

export interface BridgeDef {
  pos: [number, number, number];
  rotY: number;
  r: number;
  span: number;
}

/** Real bridges from OSM POIs, snapped onto the canal centrelines. */
export const AVEIRO_BRIDGES: BridgeDef[] = (
  [
    [/Humberto Delgado/, 16],
    [/Ponte da Dobadoura/, 5],
    [/Ponte de São João/, 4.5],
    [/Ponte dos Botirões/, 4.5],
    [/Ponte do Canal das Pirâmides/, 5],
  ] as Array<[RegExp, number]>
)
  .map(([re, span]) => {
    const a = poi(re);
    if (!a) return null;
    const loc = locate(a);
    if (loc.d > 10) return null;
    const e = EDGES[loc.e];
    const s = THREE.MathUtils.clamp(loc.s, 9, e.length - 9);
    const p = pointAtEdge(e, s, new THREE.Vector3());
    const ahead = pointAtEdge(e, Math.min(s + 1.5, e.length), new THREE.Vector3());
    return {
      pos: [p.x, 0, p.z] as [number, number, number],
      rotY: Math.atan2(ahead.x - p.x, ahead.z - p.z),
      r: e.halfW + 0.9,
      span,
    };
  })
  .filter((b): b is BridgeDef => b !== null);


export const AVEIRO_AMBIENT = new THREE.CatmullRomCurve3(
  [V3(-322, -70), V3(-352, -125), V3(-388, -95), V3(-358, -30)],
  true,
  "centripetal"
);
