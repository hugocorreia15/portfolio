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
}

const PORT_SEEDS: Array<
  Pick<PortDef, "id" | "label" | "caisName" | "t" | "accent">
> = [
  { id: "about", label: "About Me", caisName: "Cais da Ria", t: 0.0, accent: "#f59e0b" },
  { id: "experience", label: "Experience", caisName: "Cais do Rossio", t: 0.17, accent: "#ef4444" },
  { id: "projects", label: "Projects", caisName: "Cais da Costa Nova", t: 0.34, accent: "#3b82f6" },
  { id: "skills", label: "Skills", caisName: "Cais das Salinas", t: 0.5, accent: "#10b981" },
  { id: "education", label: "Education", caisName: "Cais da Universidade", t: 0.67, accent: "#8b5cf6" },
  { id: "contact", label: "Contact", caisName: "Cais do Farol", t: 0.84, accent: "#ec4899" },
];

export const PORTS: PortDef[] = PORT_SEEDS.map((seed) => {
  const point = CANAL.getPointAt(seed.t);
  const tangent = CANAL.getTangentAt(seed.t).normalize();
  const outward = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  // the loop is roughly centred on the origin, so "outward" points away from it
  if (outward.dot(point) < 0) outward.negate();
  const dockPos = point.clone().addScaledVector(outward, 4.2);
  const landmarkPos = point.clone().addScaledVector(outward, 11.5);
  const faceIn = Math.atan2(-outward.x, -outward.z);
  return { ...seed, point, tangent, outward, dockPos, landmarkPos, faceIn };
});

/** Curve parameters where decorative bridges arch over the canal (kept clear of ports). */
export const BRIDGE_TS = [0.085, 0.425, 0.755];

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
