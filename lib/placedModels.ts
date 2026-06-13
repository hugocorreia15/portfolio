import type { MapId } from "@/lib/maps";

/**
 * Real Sketchfab models the user downloaded into `public/models/`.
 * Each renders only if its file is present (missing ones are skipped), so the
 * scene never breaks. Keep README.md credits up to date (CC-BY).
 */
export interface PlacedModelDef {
  file: string;
  title: string;
  author: string;
  href: string;
  map: MapId;
  position: [number, number, number];
  rotY: number;
  /** target footprint (longest horizontal side, world units) */
  size: number;
  /** lift (+) or sink (-) relative to the waterline, after auto-grounding */
  yOffset?: number;
  /** render a small grass islet under the model */
  islet?: boolean;
}

export const PLACED_MODELS: PlacedModelDef[] = [
  {
    file: "igreja-barrocas.glb",
    title: "Igreja das Barrocas — Aveiro",
    author: "ricardo.turmas",
    href: "https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4",
    map: "aveiro",
    position: [-16, 0.1, -40],
    rotY: 2.5,
    size: 9,
    islet: true,
  },
  // The church is the town-island centrepiece (placed in City.tsx) and every
  // bridge on both maps is now the real Ponte de Carcavelos (see City.BridgeModel),
  // so no standalone bridge entry is needed here.
];

/** The Trofa church can swap in for the island chapel — handled in City.tsx. */
export const TROFA_CHURCH = {
  file: "igreja-trofa.glb",
  title: "Igreja da Trofa — Jacinta",
  author: "ricardo.turmas",
  href: "https://sketchfab.com/3d-models/igreja-da-trofa-jacinta-c9a65f6a206344cd8c51461ca7a260c1",
  size: 6,
};
