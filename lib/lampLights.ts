import * as THREE from "three";

/**
 * Cheap street-lamp lighting. Real point lights cost every lit pixel a loop
 * iteration and recompile every shader when their number changes, so instead
 * all lamps register here; each frame the few nearest the view are moved into
 * view space and every lit material adds their (shadowless) light in a short
 * loop injected after three's own lighting. The count is 0 by day, so the loop
 * costs nothing then.
 */

export const MAX_LAMPS = 12;

const registry = new Set<THREE.Vector3[]>();

export const LAMP_UNIFORMS = {
  uLampPos: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
  uLampPower: { value: new Array<number>(MAX_LAMPS).fill(0) },
  uLampCount: { value: 0 },
  uLampColor: { value: new THREE.Color("#ffb45e") },
  uLampRange: { value: 10 },
};

/** Add lamp light sources (world positions of the lanterns); returns the remover. */
export function registerLamps(points: THREE.Vector3[]) {
  registry.add(points);
  return () => {
    registry.delete(points);
  };
}

const _focus = new THREE.Vector3();
const _dir = new THREE.Vector3();
const nearest: Array<{ p: THREE.Vector3; d: number; w: number }> = [];
let reselect = 0;

/** Called once per frame by the day-night controller. */
export function updateLampLights(camera: THREE.Camera, night: number, dt: number) {
  const u = LAMP_UNIFORMS;
  if (night < 0.02) {
    u.uLampCount.value = 0;
    return;
  }
  // re-pick the closest lamps a few times a second, around what the camera looks at
  reselect -= dt;
  if (reselect <= 0 || nearest.length === 0) {
    reselect = 0.25;
    camera.getWorldDirection(_dir);
    _focus.copy(camera.position).addScaledVector(_dir, 14);
    nearest.length = 0;
    for (const group of registry) {
      for (const p of group) nearest.push({ p, d: p.distanceToSquared(_focus), w: 1 });
    }
    nearest.sort((a, b) => a.d - b.d);
    nearest.length = Math.min(nearest.length, MAX_LAMPS);
  }
  const range = u.uLampRange.value;
  u.uLampCount.value = nearest.length;
  nearest.forEach((n, i) => {
    u.uLampPos.value[i].copy(n.p).applyMatrix4(camera.matrixWorldInverse);
    // fade the farthest picks so swapping lamps in and out doesn't pop
    const far = Math.sqrt(n.d) / (range * 4);
    u.uLampPower.value[i] = night * 2.4 * THREE.MathUtils.clamp(1.6 - far, 0, 1);
  });
}

const PARS = /* glsl */ `
uniform vec3 uLampPos[${MAX_LAMPS}];
uniform float uLampPower[${MAX_LAMPS}];
uniform int uLampCount;
uniform vec3 uLampColor;
uniform float uLampRange;
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
