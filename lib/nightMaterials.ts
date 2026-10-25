import * as THREE from "three";
import { getTexture } from "@/lib/textures";

/**
 * Materials shared by many meshes whose look follows the day-night cycle
 * (lamp glass, light pools on the ground, lit windows). They are created once
 * and updated together by the DayNightController, so a hundred lamps cost one
 * uniform write per frame instead of a hundred useFrame callbacks.
 */
type Driver = (night: number, time: number) => void;
const drivers: Driver[] = [];

export function updateNightMaterials(night: number, time: number) {
  for (const d of drivers) d(night, time);
}

/** Register any material to be updated with the cycle (returns it). */
export function driveMaterial<T extends THREE.Material>(
  mat: T,
  drive: (m: T, night: number, time: number) => void
) {
  drivers.push((n, t) => drive(mat, n, t));
  return mat;
}

function driven<T extends THREE.Material>(make: () => T, drive: (m: T, night: number, time: number) => void) {
  let mat: T | null = null;
  return () => {
    if (!mat) {
      const m = make();
      drivers.push((n, t) => drive(m, n, t));
      mat = m;
    }
    return mat;
  };
}

/** Warm additive disc a street lamp throws on the pavement at night. */
export const getLightPoolMaterial = driven(
  () =>
    new THREE.MeshBasicMaterial({
      map: getTexture("foam"),
      color: "#ffbf55",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    }),
  (m, n) => {
    m.opacity = n * 0.34;
    m.visible = n > 0.01;
  }
);

/** Soft halo around a lantern. */
export const getLampHaloMaterial = driven(
  () =>
    new THREE.SpriteMaterial({
      map: getTexture("foam"),
      color: "#ffce2f",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  (m, n) => {
    m.opacity = n * 0.95;
    m.visible = n > 0.01;
  }
);

/** Points-cloud version of the halo, for instanced lamps (one draw call). */
export const getLampHaloPointsMaterial = driven(
  () =>
    new THREE.PointsMaterial({
      map: getTexture("foam"),
      color: "#ffce2f",
      size: 3.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  (m, n) => {
    m.opacity = n * 0.9;
    m.visible = n > 0.01;
  }
);

/** Glowing lantern glass (the GLB lamp's glass heads, procedural lanterns). */
export const getLanternGlassMaterial = driven(
  () =>
    new THREE.MeshStandardMaterial({
      color: "#fff1c4",
      emissive: "#ffcf6b",
      emissiveIntensity: 0,
      roughness: 0.3,
      toneMapped: false,
    }),
  (m, n) => {
    m.emissiveIntensity = n * 2.8;
  }
);

/** Window glass on hand-built landmarks: dark by day, warmly lit at night. */
export const getWindowGlassMaterial = driven(
  () =>
    new THREE.MeshStandardMaterial({
      color: "#2c3f4b",
      roughness: 0.15,
      metalness: 0.1,
      emissive: "#ffb85c",
      emissiveIntensity: 0,
    }),
  (m, n) => {
    m.emissiveIntensity = n * 1.5;
  }
);
