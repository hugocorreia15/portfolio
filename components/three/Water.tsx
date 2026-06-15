"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DAY } from "@/lib/daynight";
import { getWaterRipples } from "@/lib/textures";

const VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vH;

  // three layered waves; returns height, writes analytic gradient
  float waves(vec2 p, out vec2 grad) {
    float a1 = 0.42, f1 = 0.16, s1 = 0.8;
    float a2 = 0.26, f2 = 0.23, s2 = -0.6;
    float a3 = 0.18, f3 = 0.11, s3 = 0.45;
    float w1 = sin(p.x * f1 + uTime * s1);
    float w2 = sin(p.y * f2 + uTime * s2);
    float w3 = sin((p.x + p.y) * f3 + uTime * s3);
    grad = vec2(
      a1 * f1 * cos(p.x * f1 + uTime * s1) + a3 * f3 * cos((p.x + p.y) * f3 + uTime * s3),
      a2 * f2 * cos(p.y * f2 + uTime * s2) + a3 * f3 * cos((p.x + p.y) * f3 + uTime * s3)
    );
    return a1 * w1 + a2 * w2 + a3 * w3;
  }

  void main() {
    vec3 p = position;
    vec2 grad;
    float h = waves(p.xy, grad);
    p.z += h * 0.34;
    vH = h;
    // plane is rotated -90deg about X, so local (x, y) -> world (x, -z)
    vNormal = normalize(vec3(-grad.x * 0.34, 1.0, grad.y * 0.34));
    vec4 worldPos = modelMatrix * vec4(p, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform float uNight;
  uniform sampler2D uRipples;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vH;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // scrolling tileable ripple normal map, two scales blended
    vec3 r1 = texture2D(uRipples, vWorldPos.xz * 0.045 + uTime * vec2(0.014, 0.010)).xyz * 2.0 - 1.0;
    vec3 r2 = texture2D(uRipples, vWorldPos.xz * 0.016 - uTime * vec2(0.008, 0.012)).xyz * 2.0 - 1.0;
    vec3 N = normalize(vNormal + vec3(r1.x + r2.x * 0.7, 0.0, r1.y + r2.y * 0.7) * 0.5);

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    // dusk water body
    vec3 deep = vec3(0.05, 0.22, 0.30);
    vec3 shallow = vec3(0.16, 0.40, 0.47);

    // the sky reflection warms toward the setting sun
    float towardSun = max(
      dot(normalize(vec3(-V.x, 0.0, -V.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))),
      0.0
    );
    vec3 sky = mix(vec3(0.55, 0.66, 0.80), vec3(1.0, 0.70, 0.42), towardSun * towardSun * 0.85);

    // "patch" is a reserved word in GLSL ES 3.0 — don't rename this back
    float tonePatch = vnoise(vWorldPos.xz * 0.045 + 3.7);
    vec3 water = mix(deep, shallow, tonePatch * 0.8 + (vWorldPos.y) * 0.4);
    vec3 col = mix(water, sky, 0.12 + 0.52 * fresnel);

    float day = 1.0 - uNight;

    // wave crests catch the low light
    col += vec3(1.0, 0.85, 0.7) * smoothstep(0.45, 0.86, vH) * 0.10 * day;

    // sun glitter path: tight sparkle + broad warm sheen (daytime)
    vec3 R = reflect(-uSunDir, N);
    float rv = max(dot(R, V), 0.0);
    col += vec3(1.0, 0.72, 0.45) * pow(rv, 160.0) * 1.8 * day;
    col += vec3(1.0, 0.66, 0.38) * pow(rv, 18.0) * 0.24 * day;
    // soft sparkles
    vec2 rp = vWorldPos.xz * 0.55;
    float sparkle = smoothstep(0.985, 1.0, vnoise(rp * 3.1 + uTime * 0.5));
    col += vec3(1.0, 0.9, 0.75) * sparkle * 0.16 * day;

    // night: deepen + cool the water, faint moon glitter and sparkle
    vec3 nightWater = vec3(0.015, 0.04, 0.09) + sky * 0.05;
    col = mix(col, nightWater, uNight * 0.86);
    col += vec3(0.55, 0.66, 0.92) * pow(rv, 90.0) * uNight * 0.6;
    col += vec3(0.7, 0.8, 1.0) * sparkle * uNight * 0.1;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

export default function Water() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uSunDir: { value: DAY.sunDir.clone() },
      uNight: { value: 0 },
      uRipples: { value: getWaterRipples() },
    }),
    []
  );

  useFrame((state) => {
    if (material.current) {
      const u = material.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uSunDir.value.copy(DAY.sunDir);
      u.uNight.value = DAY.night;
    }
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
      <planeGeometry args={[520, 520, 128, 128]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        fog
      />
    </mesh>
  );
}
