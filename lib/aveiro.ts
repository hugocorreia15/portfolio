import * as THREE from "three";
import type { PortDef } from "@/lib/ports";
import canalData from "@/data/aveiro-canals.json";

/**
 * The real Aveiro canal network, baked from OpenStreetMap by
 * scripts/fetch-aveiro-canals.mjs (data © OpenStreetMap contributors, ODbL).
 * Coordinates are world units (0.12 u/m), origin at the Praça Humberto
 * Delgado, north = -z. Channel half-widths are gameplay-sized, not to scale.
 */

interface BakedEdge {
  name?: string;
  pts: [number, number][];
}
interface BakedPoi {
  name: string;
  x: number;
  z: number;
}

const BAKED_EDGES = canalData.edges as BakedEdge[];
const POIS = canalData.pois as BakedPoi[];

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

const HALFW_BY_NAME: Array<[RegExp, number]> = [
  [/Côjo/i, 5.5],
  [/Pirâmides/i, 6],
  [/São Roque/i, 4.8],
  [/Principal/i, 14],
  [/Moliceiros|Paraíso|Esteiro/i, 4.5],
  [/Cale da Vala/i, 5],
];

function halfWFor(name?: string) {
  if (name) {
    for (const [re, w] of HALFW_BY_NAME) if (re.test(name)) return w;
  }
  return 4.8;
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
    pts: [V3(101.49, 14.02), V3(97, 28), V3(93, 38)],
    halfW: 8,
    city: false,
  },
  {
    name: "Ria — canal de Ovar",
    pts: [V3(-134.29, -39.7), V3(-160, -15)],
    halfW: 20,
    city: false,
  },
  {
    name: "Ria — Costa Nova",
    pts: [V3(-160, -15), V3(-165, 25)],
    halfW: 14,
    city: false,
  },
  {
    name: "Ria — Barra",
    pts: [V3(-160, -15), V3(-185, -25)],
    halfW: 12,
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
  { id: "projects", label: "Projects", caisName: "Costa Nova", accent: "#3b82f6" },
  { id: "skills", label: "Skills", caisName: "Marinha da Troncalhada", accent: "#10b981" },
  { id: "education", label: "Education", caisName: "Cais da Fonte Nova", accent: "#8b5cf6" },
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
  const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
  return {
    ...seed,
    t: 0,
    point,
    tangent,
    outward,
    dockPos: point.clone().addScaledVector(outward, 4.2),
    landmarkPos: point.clone().addScaledVector(outward, opts.landmarkDist ?? 11.5),
    faceIn: Math.atan2(-outward.x, -outward.z),
    platformR: opts.platformR,
  };
}

const A_PEIXE = poi(/Praça do Peixe/) ?? V3(-15.6, -22.4);
const A_ARTENOVA = poi(/Museu Arte Nova/) ?? V3(-18.3, -16);
const A_TRONCALHADA = poi(/Troncalhada/) ?? V3(-93.1, -46.6);
const A_LAGO = poi(/Lago da Fonte Nova/) ?? V3(93.3, 23.3);
const A_CAIS_FN = poi(/Cais da Fonte Nova/) ?? V3(101.3, 44.5);
const A_CONGRESSO = poi(/Câmara Municipal.*Congressos/) ?? V3(103.8, 36.2);
const A_HUMBERTO = poi(/Humberto Delgado/) ?? V3(1.6, -9.9);

export const AVEIRO_PORTS: PortDef[] = [
  anchoredPort(SEEDS[0], A_PEIXE, { platformR: 5.5, landmarkDist: 10 }),
  // the Art Nouveau row faces the canal — landmark on the open south bank
  anchoredPort(SEEDS[1], A_ARTENOVA, { flipOut: true, platformR: 5.5, landmarkDist: 10 }),
  anchoredPort(SEEDS[2], V3(-165, 25), { outTo: V3(-172, 38) }),
  anchoredPort(SEEDS[3], A_TRONCALHADA, { landmarkDist: 12 }),
  anchoredPort(SEEDS[4], A_LAGO, { outTo: A_CAIS_FN, platformR: 6, landmarkDist: 14 }),
  anchoredPort(SEEDS[5], V3(-185, -25), { outTo: V3(-196, -30) }),
];

const startLoc = locate(A_HUMBERTO);
const startS = Math.max(startLoc.s - 14, 6);
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

export const MARSH_ISLETS: Array<{ x: number; z: number; r: number }> = [
  { x: -120, z: -12, r: 5 },
  { x: -143, z: 8, r: 6 },
  { x: -152, z: -50, r: 5 },
  { x: -112, z: -40, r: 4 },
];

const KEEPOUTS: Array<{ x: number; z: number; r: number }> = [
  ...AVEIRO_PORTS.map((p) => {
    const c = p.point.clone().addScaledVector(p.outward, 3.2);
    return { x: c.x, z: c.z, r: 0.9 };
  }),
  ...MARSH_ISLETS.map((m) => ({ ...m, r: m.r + 1.2 })),
];

const BANK_MARGIN = 1.6;

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
    [/Humberto Delgado/, 14],
    [/Ponte da Dobadoura/, 3.5],
    [/Ponte de São João/, 3],
    [/Ponte do Canal das Pirâmides/, 4],
  ] as Array<[RegExp, number]>
)
  .map(([re, span]) => {
    const a = poi(re);
    if (!a) return null;
    const loc = locate(a);
    if (loc.d > 12) return null;
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

export const CONGRESS_POS: [number, number, number] = [A_CONGRESSO.x, 0.7, A_CONGRESSO.z];
export const SALINAS_CENTER: [number, number] = [A_TRONCALHADA.x, A_TRONCALHADA.z];

export const AVEIRO_AMBIENT = new THREE.CatmullRomCurve3(
  [V3(-122, -30), V3(-140, -48), V3(-158, -30), V3(-140, -12)],
  true,
  "centripetal"
);
