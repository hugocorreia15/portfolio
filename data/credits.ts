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
    name: "Moliceiro",
    author: "ricardo.turmas",
    authorUrl: "https://sketchfab.com/ricardo.turmas",
    modelUrl: "https://skfb.ly/ouOAW",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by-nc-sa/4.0/",
    role: "The moliceiro boats",
  },
  {
    name: "Igreja das Barrocas — Aveiro",
    author: "ricardo.turmas",
    authorUrl: "https://sketchfab.com/ricardo.turmas",
    modelUrl:
      "https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by-nc-sa/4.0/",
    role: "Town-island church",
  },
  {
    name: "Ponte de Carcavelos — Aveiro",
    author: "ricardo.turmas",
    authorUrl: "https://sketchfab.com/ricardo.turmas",
    modelUrl:
      "https://sketchfab.com/3d-models/ponte-de-carcavelos-aveiro-4a504e3b7df541f0a2f489aed2b7d63c",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by-nc-sa/4.0/",
    role: "The canal bridges",
  },
];
