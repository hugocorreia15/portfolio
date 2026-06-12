"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

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
  varying vec3 vWorldPos;
  varying vec3 vNormal;

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
    // fine ripple detail perturbs the analytic wave normal
    vec2 rp = vWorldPos.xz * 0.55;
    float n1 = vnoise(rp + uTime * 0.35);
    float n2 = vnoise(rp * 2.3 - uTime * 0.27);
    vec3 N = normalize(vNormal + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.35);

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 deep = vec3(0.06, 0.30, 0.38);
    vec3 shallow = vec3(0.22, 0.55, 0.60);
    vec3 sky = vec3(0.78, 0.90, 0.94);

    // "patch" is a reserved word in GLSL ES 3.0 — don't rename this back
    float tonePatch = vnoise(vWorldPos.xz * 0.045 + 3.7);
    vec3 water = mix(deep, shallow, tonePatch * 0.8 + (vWorldPos.y) * 0.4);
    vec3 col = mix(water, sky, 0.10 + 0.5 * fresnel);

    // sun glitter
    vec3 R = reflect(-uSunDir, N);
    float spec = pow(max(dot(R, V), 0.0), 160.0);
    col += vec3(1.0, 0.96, 0.85) * spec * 1.4;
    // soft sparkles
    float sparkle = smoothstep(0.985, 1.0, vnoise(rp * 3.1 + uTime * 0.5));
    col += vec3(0.9) * sparkle * 0.18;

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
      uSunDir: { value: new THREE.Vector3(45, 60, 18).normalize() },
    }),
    []
  );

  useFrame((state) => {
    if (material.current) {
      material.current.uniforms.uTime.value = state.clock.elapsedTime;
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
