import * as THREE from "three";

/** Golden-hour sun, low over the ria to the west — shared by sky, lights and water. */
export const SUN_POS = new THREE.Vector3(-95, 16, 34);
export const SUN_DIR = SUN_POS.clone().normalize();
