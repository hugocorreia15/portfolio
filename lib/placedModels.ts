import { PORTS } from "@/lib/ports";
import type { MapId } from "@/lib/maps";

/**
 * Optional Sketchfab models placed in the world. Download each from its
 * `href` (Download 3D Model → glTF .glb) and save as
 * `public/models/<file>` — it appears automatically; missing files are
 * simply skipped. Keep the credits in README.md up to date (CC-BY).
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
  /** render a small grass islet under the model */
  islet?: boolean;
}

export const PLACED_MODELS: PlacedModelDef[] = [
  {
    file: "costa-nova-haystacks.glb",
    title: "Costa Nova Haystacks",
    author: "rawkusperhaps",
    href: "https://sketchfab.com/3d-models/costa-nova-haystacks-b89822f23b434dc0a2827e8624fd56c3",
    map: "aveiro",
    position: [-176, 0.45, 29],
    rotY: 0.4,
    size: 5,
  },
  {
    file: "costa-nova-haystacks.glb",
    title: "Costa Nova Haystacks",
    author: "rawkusperhaps",
    href: "https://sketchfab.com/3d-models/costa-nova-haystacks-b89822f23b434dc0a2827e8624fd56c3",
    map: "island",
    position: [
      PORTS[2].landmarkPos.x + 5.5,
      0.64,
      PORTS[2].landmarkPos.z + 3,
    ],
    rotY: -0.5,
    size: 4.5,
  },
  {
    file: "igreja-barrocas.glb",
    title: "Igreja das Barrocas — Aveiro",
    author: "ricardo.turmas",
    href: "https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4",
    map: "aveiro",
    position: [-14, 0.1, -38],
    rotY: 2.6,
    size: 8,
    islet: true,
  },
  {
    file: "ponte-carcavelos.glb",
    title: "Ponte de Carcavelos — Aveiro",
    author: "ricardo.turmas",
    href: "https://sketchfab.com/3d-models/ponte-de-carcavelos-aveiro-4a504e3b7df541f0a2f489aed2b7d63c",
    map: "aveiro",
    position: [-4, 0.1, -44],
    rotY: 0.6,
    size: 9,
    islet: true,
  },
  {
    file: "t17.glb",
    title: "T17 3D Regional",
    author: "ANPRI",
    href: "https://sketchfab.com/3d-models/t17-3d-regional-3c36a1bd11134c46b8a651cb6c1ec5f3",
    map: "aveiro",
    position: [108, 0.1, 30],
    rotY: -1.2,
    size: 6,
    islet: true,
  },
];

/** The Trofa church swaps in for the island chapel — handled in City.tsx. */
export const TROFA_CHURCH = {
  file: "igreja-trofa.glb",
  title: "Igreja da Trofa — Jacinta",
  author: "ricardo.turmas",
  href: "https://sketchfab.com/3d-models/igreja-da-trofa-jacinta-c9a65f6a206344cd8c51461ca7a260c1",
  size: 6,
};
