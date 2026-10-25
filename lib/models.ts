import { useGLTF } from "@react-three/drei";

/**
 * Runtime GLBs baked by scripts/bake-models.mjs from assets-src/models
 * (credits in data/credits.ts). Props are centred, grounded and unit-height.
 */
export const MODELS = {
  bridge: "/models/ponte-carcavelos.glb",
  church: "/models/igreja-barrocas.glb",
  treeA: "/models/tree-a.glb",
  treeB: "/models/tree-b.glb",
  bush: "/models/bush.glb",
  lamp: "/models/street-lamp.glb",
} as const;

/** Start every download as soon as the scene module loads. */
export function preloadModels() {
  Object.values(MODELS).forEach((url) => useGLTF.preload(url));
}
