import * as THREE from "three";

/**
 * The cloud deck: a layer of drifting cumulus at a fixed height, drawn by the
 * sky dome (components/three/Atmosphere.tsx) and reflected by the water, both
 * from the same tileable noise (scripts/gen-clouds.py) and the same function,
 * so the reflection lines up with the sky.
 */

let noise: THREE.Texture | null = null;
function getCloudNoise() {
  if (!noise) {
    noise = new THREE.TextureLoader().load("/textures/clouds.webp");
    noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
    noise.colorSpace = THREE.NoColorSpace;
  }
  return noise;
}

/** Shared by every cloud-drawing material (updated by the day-night controller). */
export const CLOUD_UNIFORMS = {
  uCloudNoise: { value: null as THREE.Texture | null },
  uCloudTime: { value: 0 },
  // lower = more sky covered
  uCloudCover: { value: 0.5 },
};

export function cloudUniforms() {
  CLOUD_UNIFORMS.uCloudNoise.value ??= getCloudNoise();
  return CLOUD_UNIFORMS;
}

const HEIGHT = 85;

export const CLOUD_GLSL = /* glsl */ `
uniform sampler2D uCloudNoise;
uniform float uCloudTime;
uniform float uCloudCover;

// where a ray from \`origin\` meets the cloud deck, in noise space
vec2 cloudUv(vec3 origin, vec3 dir) {
  float t = (${HEIGHT.toFixed(1)} - origin.y) / max(dir.y, 0.004);
  return (origin.xz + dir.xz * t) * 0.0021 + uCloudTime * vec2(0.0032, 0.0011);
}

// 0 clear sky .. 1 thick cloud: banks (R) shaped into puffs (B), frayed by wisps
// (G). \`dirY\` is the ray's elevation: toward the horizon the deck is far, its
// noise blurs to grey, so the threshold drops and the banks close up
float cloudDensity(vec2 p, float dirY) {
  vec3 a = texture2D(uCloudNoise, p).rgb;
  float wisp = texture2D(uCloudNoise, p * 3.1 + 0.37).g;
  float n = a.r * 0.58 + a.b * 0.42 - (1.0 - wisp) * 0.17;
  float cover = uCloudCover - smoothstep(0.16, 0.015, dirY) * 0.13;
  return smoothstep(cover, cover + 0.2, n);
}
`;
