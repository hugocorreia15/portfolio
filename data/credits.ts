export interface AssetCredit {
  name: string;
  author: string;
  authorUrl: string;
  modelUrl: string;
  license: string;
  licenseUrl: string;
  role: string;
}

/**
 * Attribution for every 3D model used in the scene. To add a new asset, append
 * an entry here — the /credits page renders it automatically.
 */
export const ASSET_CREDITS: AssetCredit[] = [
  {
    name: "Igreja das Barrocas — Aveiro",
    author: "ricardo.turmas",
    authorUrl: "https://sketchfab.com/ricardo.turmas",
    modelUrl:
      "https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4",
    license: "CC BY 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    role: "The church on the island",
  },
  {
    name: "Ponte de Carcavelos — Aveiro",
    author: "ricardo.turmas",
    authorUrl: "https://sketchfab.com/ricardo.turmas",
    modelUrl:
      "https://sketchfab.com/3d-models/ponte-de-carcavelos-aveiro-4a504e3b7df541f0a2f489aed2b7d63c",
    license: "CC BY 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    role: "The canal bridges",
  },
  {
    name: "Old Street Lamp Pack",
    author: "Bailey123704",
    authorUrl: "https://sketchfab.com/Bailey123704",
    modelUrl:
      "https://sketchfab.com/3d-models/old-street-lamp-pack-324ff0abd82d4f679f9e64065ad142a3",
    license: "CC BY 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    role: "Lampposts by the piers",
  },
  {
    name: "Low Poly Forest Tree Pack",
    author: "99.Miles",
    authorUrl: "https://sketchfab.com/99.Miles",
    modelUrl:
      "https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b",
    license: "CC BY 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    role: "Trees and bushes",
  },
];
