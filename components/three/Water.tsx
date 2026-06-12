"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  varying float vWave;
  varying vec3 vWorldPos;

  void main() {
    vec3 p = position;
    float w =
      sin(p.x * 0.16 + uTime * 0.8) * 0.55 +
      sin(p.y * 0.21 - uTime * 0.6) * 0.30 +
      sin((p.x + p.y) * 0.11 + uTime * 0.45) * 0.25;
    p.z += w * 0.16;
    vWave = w;
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
  varying float vWave;
  varying vec3 vWorldPos;

  void main() {
    vec3 deep = vec3(0.07, 0.35, 0.43);
    vec3 shallow = vec3(0.30, 0.65, 0.70);
    vec3 col = mix(deep, shallow, smoothstep(-1.1, 1.1, vWave));
    float glint = sin(vWorldPos.x * 1.3 + uTime * 1.1) * sin(vWorldPos.z * 1.05 - uTime * 0.8);
    col += vec3(1.0, 1.0, 0.95) * smoothstep(0.965, 1.0, glint) * 0.16;
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
      <planeGeometry args={[420, 420, 96, 96]} />
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
