import * as THREE from "three";
import { BEACON } from "@/lib/daynight";

/**
 * Cheap street-lamp lighting. Real point lights cost every lit pixel a loop
 * iteration and recompile every shader when their number changes, so instead
 * all lamps register here; each frame the few nearest the view are moved into
 * view space and every lit material adds their (shadowless) light in a short
 * loop injected after three's own lighting. The count is 0 by day, so the loop
 * costs nothing then.
 *
 * The lighthouse beam rides along: its sweep lights a wedge of every surface
 * from the foot of the tower outwards (ground, quays, boats, walls).
 */

export const MAX_LAMPS = 12;

type LampGroup = { points: THREE.Vector3[]; priority: boolean; power: number };
const registry = new Set<LampGroup>();

export const LAMP_UNIFORMS = {
  uLampPos: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
  uLampPower: { value: new Array<number>(MAX_LAMPS).fill(0) },
  uLampCount: { value: 0 },
  uLampColor: { value: new THREE.Color("#ffb45e") },
  uLampRange: { value: 10 },
  // the lighthouse beacon, in view space
  uBeaconPos: { value: new THREE.Vector3() },
  uBeaconUp: { value: new THREE.Vector3(0, 1, 0) },
  uBeaconDir: { value: new THREE.Vector3(1, 0, 0) },
  uBeaconOn: { value: 0 },
};

/**
 * Add lamp light sources (world positions of the lanterns; moving lamps just
 * update their vectors); returns the remover. `priority` lamps are always
 * among the lit ones (the player's boat).
 */
export function registerLamps(
  points: THREE.Vector3[],
  { priority = false, power = 1 }: { priority?: boolean; power?: number } = {}
) {
  const group = { points, priority, power };
  registry.add(group);
  return () => {
    registry.delete(group);
  };
}

const _focus = new THREE.Vector3();
const _dir = new THREE.Vector3();
const nearest: Array<{ p: THREE.Vector3; d: number; power: number }> = [];
let reselect = 0;
let lampNight = 0;

/** Called once per frame by the day-night controller. */
export function updateLampLights(camera: THREE.Camera, night: number, dt: number) {
  lampNight = night;
  if (night < 0.02) {
    LAMP_UNIFORMS.uLampCount.value = 0;
    nearest.length = 0;
    return;
  }
  // re-pick the closest lamps a few times a second, around what the camera looks at
  reselect -= dt;
  if (reselect <= 0 || nearest.length === 0) {
    reselect = 0.25;
    camera.getWorldDirection(_dir);
    _focus.copy(camera.position).addScaledVector(_dir, 14);
    nearest.length = 0;
    for (const g of registry) {
      for (const p of g.points) {
        nearest.push({ p, d: g.priority ? -1 : p.distanceToSquared(_focus), power: g.power });
      }
    }
    nearest.sort((a, b) => a.d - b.d);
    nearest.length = Math.min(nearest.length, MAX_LAMPS);
  }
}

/**
 * Move the picked lamps and the beacon into `camera`'s view space. Runs from
 * scene.onBeforeRender, so it uses this frame's final camera — and again for
 * the water's reflection camera.
 */
export function applyLampView(camera: THREE.Camera) {
  const u = LAMP_UNIFORMS;
  const view = camera.matrixWorldInverse;
  u.uLampCount.value = nearest.length;
  const range = u.uLampRange.value;
  nearest.forEach((n, i) => {
    u.uLampPos.value[i].copy(n.p).applyMatrix4(view);
    // fade the farthest picks so swapping lamps in and out doesn't pop
    const far = n.d < 0 ? 0 : Math.sqrt(n.d) / (range * 4);
    u.uLampPower.value[i] = lampNight * 2.4 * n.power * THREE.MathUtils.clamp(1.6 - far, 0, 1);
  });

  u.uBeaconOn.value = BEACON.on;
  if (BEACON.on > 0.001) {
    u.uBeaconPos.value.copy(BEACON.pos).applyMatrix4(view);
    u.uBeaconUp.value.set(0, 1, 0).transformDirection(view);
    u.uBeaconDir.value.set(Math.sin(BEACON.dir), 0, Math.cos(BEACON.dir)).transformDirection(view);
  }
}

/** Place the lamps before every render of `scene`; returns the unbinder. */
export function bindLampView(scene: THREE.Scene) {
  scene.onBeforeRender = (_gl, _scene, camera) => applyLampView(camera);
  return () => {
    scene.onBeforeRender = () => {};
  };
}

/**
 * The lit wedge of the beacon: `al` is the cosine between the beam heading and
 * the horizontal direction to the point, `bd` its horizontal distance from the
 * tower. Shared by the lit materials and the water so both line up.
 */
export const BEACON_WEDGE = /* glsl */ `
float beaconWedge(float al, float bd) {
  return smoothstep(0.988, 0.9985, al) * smoothstep(1.0, 3.5, bd) * exp(-bd * 0.02);
}
`;

const PARS = /* glsl */ `
uniform vec3 uLampPos[${MAX_LAMPS}];
uniform float uLampPower[${MAX_LAMPS}];
uniform int uLampCount;
uniform vec3 uLampColor;
uniform float uLampRange;
uniform vec3 uBeaconPos;
uniform vec3 uBeaconUp;
uniform vec3 uBeaconDir;
uniform float uBeaconOn;
${BEACON_WEDGE}
`;

const LOOP = /* glsl */ `
#include <lights_fragment_end>
{
  #ifdef STANDARD
    vec3 lampAlbedo = material.diffuseContribution;
  #else
    vec3 lampAlbedo = material.diffuseColor;
  #endif
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampCount) break;
    vec3 lv = uLampPos[i] - geometryPosition;
    float ld = length(lv);
    float fall = pow(saturate(1.0 - ld / uLampRange), 2.0);
    float ndl = saturate(dot(geometryNormal, lv / max(ld, 1e-3)) * 0.8 + 0.2);
    reflectedLight.directDiffuse += BRDF_Lambert(lampAlbedo) * uLampColor * (uLampPower[i] * fall * ndl);
  }
  if (uBeaconOn > 0.001) {
    vec3 bv = geometryPosition - uBeaconPos;
    float bh = dot(bv, uBeaconUp);
    vec3 bxz = bv - bh * uBeaconUp;
    float bd = length(bxz);
    // below the lantern only: the light falls from the beam onto what it sweeps
    float bw = beaconWedge(dot(bxz, uBeaconDir) / max(bd, 1e-3), bd) * smoothstep(1.0, -0.5, bh);
    float bndl = saturate(dot(geometryNormal, -bv / max(length(bv), 1e-3)) * 0.6 + 0.4);
    reflectedLight.directDiffuse += BRDF_Lambert(lampAlbedo) * vec3(1.0, 0.93, 0.76) * (uBeaconOn * bw * bndl * 7.0);
  }
}
`;

type ShaderLike = { uniforms: Record<string, THREE.IUniform>; fragmentShader: string };

/** Inject the lamp loop into a lit shader (no-op for unlit ones). */
export function addLampLighting(shader: ShaderLike) {
  if (!shader.fragmentShader.includes("#include <lights_fragment_end>")) return;
  Object.assign(shader.uniforms, LAMP_UNIFORMS);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${PARS}`)
    .replace("#include <lights_fragment_end>", LOOP);
}

let installed = false;

/** Every built-in lit material without its own onBeforeCompile gets the lamps. */
export function installLampLighting() {
  if (installed) return;
  installed = true;
  THREE.Material.prototype.onBeforeCompile = function (shader) {
    addLampLighting(shader);
  };
}
