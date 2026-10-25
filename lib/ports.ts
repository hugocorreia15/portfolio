import * as THREE from "three";
import type { SectionId } from "@/data/profile";

/** Closed canal loop through the Ria — the moliceiro's route. */
export const CANAL = new THREE.CatmullRomCurve3(
  [
    [0, 30],
    [24, 22],
    [34, 4],
    [26, -16],
    [8, -26],
    [-14, -24],
    [-30, -10],
    [-32, 10],
    [-18, 26],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  "centripetal"
);

export interface PortDef {
  id: SectionId;
  label: string;
  caisName: string;
  t: number;
  accent: string;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  outward: THREE.Vector3;
  dockPos: THREE.Vector3;
  landmarkPos: THREE.Vector3;
  /** rotation.y so a landmark's front (+z) faces the canal */
  faceIn: number;
  /** landmark island/plaza radius (defaults to 7) */
  platformR?: number;
}

const PORT_SEEDS: Array<Pick<PortDef, "id" | "label" | "caisName" | "accent">> = [
  { id: "about", label: "About Me", caisName: "Cais da Ria", accent: "#f59e0b" },
  { id: "experience", label: "Experience", caisName: "Cais do Rossio", accent: "#ef4444" },
  { id: "publications", label: "Publications", caisName: "Cais da Fábrica", accent: "#0d9488" },
  { id: "projects", label: "Projects", caisName: "Cais da Costa Nova", accent: "#3b82f6" },
  { id: "skills", label: "Skills", caisName: "Cais das Salinas", accent: "#10b981" },
  { id: "education", label: "Education", caisName: "Cais da Universidade", accent: "#8b5cf6" },
  { id: "contact", label: "Contact", caisName: "Cais do Farol", accent: "#ec4899" },
];

/** Ports sit evenly around the loop; bridges and islets go in the gaps between them. */
const STEP = 1 / PORT_SEEDS.length;

export const PORTS: PortDef[] = PORT_SEEDS.map((seed, i) => {
  const t = i * STEP;
  const point = CANAL.getPointAt(t);
  const tangent = CANAL.getTangentAt(t).normalize();
  const outward = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  // the loop is roughly centred on the origin, so "outward" points away from it
  if (outward.dot(point) < 0) outward.negate();
  const dockPos = point.clone().addScaledVector(outward, 4.2);
  const landmarkPos = point.clone().addScaledVector(outward, 11.5);
  const faceIn = Math.atan2(-outward.x, -outward.z);
  return { ...seed, t, point, tangent, outward, dockPos, landmarkPos, faceIn };
});

/** Curve parameters where bridges arch over the canal, midway between two ports. */
export const BRIDGE_TS = [0.5, 3.5, 5.5].map((k) => k * STEP);

/** Curve parameters of the small islets off the outer bank (also in the gaps). */
export const ISLET_TS = [1.5, 4.5, 6.5].map((k) => k * STEP);

export const wrap1 = (t: number) => ((t % 1) + 1) % 1;

/** Signed shortest distance between two curve parameters on the closed loop. */
export function shortestDelta(from: number, to: number) {
  let d = wrap1(to) - wrap1(from);
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

/** Deterministic PRNG so scenery never changes between renders. */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
