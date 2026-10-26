"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BEACON, DAY } from "@/lib/daynight";
import { getWaterRipples } from "@/lib/textures";
import { BEACON_WEDGE, LAMP_UNIFORMS, MAX_LAMPS } from "@/lib/lampLights";
import { hideFromMirror, MIRROR_FAR, type MirrorUniforms, mirrorUniforms, WaterMirror } from "@/lib/reflection";

const VERTEX = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
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
    vec3 transformed = position;
    vec2 grad;
    // waves in world space, so the plane can follow the camera without the
    // swell sliding along with it (local (x, y) maps to world (x, -z))
    vec4 w0 = modelMatrix * vec4(position, 1.0);
    float h = waves(vec2(w0.x, -w0.z), grad);
    transformed.z += h * 0.34;
    vH = h;
    // plane is rotated -90deg about X, so local (x, y) -> world (x, -z)
    vNormal = normalize(vec3(-grad.x * 0.34, 1.0, grad.y * 0.34));
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPos = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPos = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    // shadows are looked up on the wave surface itself, where the boats float
    // (so a hull's shadow starts at its waterline), without the light's normal
    // offset: the water casts nothing, and the offset made shadows sway
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      #pragma unroll_loop_start
      for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
        vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * worldPosition;
      }
      #pragma unroll_loop_end
    #endif
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <packing>
  #include <fog_pars_fragment>
  #include <bsdfs>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform float uSunUp;
  uniform float uNight;
  uniform sampler2D uRipples;
  uniform vec3 uBeaconWorld;
  uniform float uBeaconHeading;
  uniform float uBeaconLevel;
  uniform sampler2D uRefl;
  uniform mat4 uReflMatrix;
  uniform float uReflOn;
  uniform vec3 uLampPos[${MAX_LAMPS}];
  uniform float uLampPower[${MAX_LAMPS}];
  uniform int uLampCount;
  uniform vec3 uLampColor;
  uniform float uLampRange;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vNormal;
  varying float vH;
  ${BEACON_WEDGE}

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

  // the mirror pass is linear HDR: grade it like the rest of the frame
  vec3 toDisplay(vec3 c) {
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    return linearToOutputTexel(vec4(c, 1.0)).rgb;
  }

  void main() {
    // past the fog's far distance the water is pure fog colour: skip the work
    #ifdef USE_FOG
      if (vFogDepth > fogFar) {
        gl_FragColor = vec4(fogColor, 1.0);
        return;
      }
    #endif
    // scrolling tileable ripple normal map, two scales blended
    vec3 r1 = texture2D(uRipples, vWorldPos.xz * 0.045 + uTime * vec2(0.014, 0.010)).xyz * 2.0 - 1.0;
    vec3 r2 = texture2D(uRipples, vWorldPos.xz * 0.016 - uTime * vec2(0.008, 0.012)).xyz * 2.0 - 1.0;
    vec3 N = normalize(vNormal + vec3(r1.x + r2.x * 0.7, 0.0, r1.y + r2.y * 0.7) * 0.5);

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    // shadows of the boats, bridges and houses (sun only)
    float sunLit = 1.0;
    #ifdef USE_SHADOWMAP
      sunLit = mix(1.0, getShadowMask(), uSunUp);
    #endif

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
    col *= mix(0.55, 1.0, sunLit);

    float day = 1.0 - uNight;

    // wave crests catch the low light
    col += vec3(1.0, 0.85, 0.7) * smoothstep(0.45, 0.86, vH) * 0.10 * day * sunLit;

    // sun glitter path: tight sparkle + broad warm sheen (daytime)
    vec3 R = reflect(-uSunDir, N);
    float rv = max(dot(R, V), 0.0);
    col += vec3(1.0, 0.72, 0.45) * pow(rv, 160.0) * 1.8 * day * sunLit;
    col += vec3(1.0, 0.66, 0.38) * pow(rv, 18.0) * 0.24 * day * sunLit;
    // soft sparkles
    vec2 rp = vWorldPos.xz * 0.55;
    float sparkle = smoothstep(0.985, 1.0, vnoise(rp * 3.1 + uTime * 0.5));
    col += vec3(1.0, 0.9, 0.75) * sparkle * 0.16 * day * sunLit;

    // night: deepen + cool the water, faint moon glitter and sparkle
    vec3 nightWater = vec3(0.02, 0.055, 0.11) + sky * 0.06;
    col = mix(col, nightWater, uNight * 0.84);
    col += vec3(0.55, 0.66, 0.92) * pow(rv, 90.0) * uNight * 0.6;
    col += vec3(0.7, 0.8, 1.0) * sparkle * uNight * 0.1;

    // the boats (and the lamps' glows) mirrored, broken up by the ripples
    if (uReflOn > 0.5) {
      vec4 rc = uReflMatrix * vec4(vWorldPos.x, 0.0, vWorldPos.z, 1.0);
      // a gentle wobble from the ripples (stronger made the mirrored quay
      // edges jitter along every waterline)
      vec2 ruv = rc.xy / rc.w + (N.xz - vNormal.xz) * 0.012 + vNormal.xz * 0.02;
      // four taps soften the low-resolution mirror's edges
      vec2 px = 0.7 / vec2(textureSize(uRefl, 0));
      vec4 refl = 0.25 * (
        texture2D(uRefl, ruv + vec2(-px.x, -px.y)) + texture2D(uRefl, ruv + vec2(px.x, -px.y)) +
        texture2D(uRefl, ruv + vec2(-px.x, px.y)) + texture2D(uRefl, ruv + vec2(px.x, px.y))
      );
      // fade out well before the mirror's range ends, so nothing pops in or out
      float rk = (0.45 + 0.35 * fresnel) *
        (1.0 - smoothstep(${(MIRROR_FAR * 0.55).toFixed(1)}, ${(MIRROR_FAR * 0.9).toFixed(1)}, length(vViewPos)));
      col = col * (1.0 - refl.a * rk) + toDisplay(refl.rgb) * rk;
    }

    // lamplight on the water: a soft pool under each lamp and the glints of
    // its reflection on the ripples
    if (uLampCount > 0) {
      vec3 Nv = normalize((viewMatrix * vec4(N, 0.0)).xyz);
      vec3 Rv = reflect(normalize(vViewPos), Nv);
      vec3 lamp = vec3(0.0);
      for (int i = 0; i < ${MAX_LAMPS}; i++) {
        if (i >= uLampCount) break;
        vec3 lv = uLampPos[i] - vViewPos;
        float ld = length(lv);
        float glint = pow(max(dot(Rv, lv / ld), 0.0), 80.0) * 1.2 / (1.0 + ld * 0.08);
        float pool = pow(saturate(1.0 - ld / (uLampRange * 0.8)), 3.0) * 0.12;
        lamp += uLampPower[i] * (glint + pool);
      }
      col += uLampColor * min(lamp, 2.5) * 0.22;
    }

    // the lighthouse beam glancing across the water — a warm streak that sweeps
    // along the beam's heading and fades with distance, breaking up on ripples
    if (uBeaconLevel > 0.001) {
      vec2 toF = vWorldPos.xz - uBeaconWorld.xz;
      float bd = length(toF);
      vec2 dir = vec2(sin(uBeaconHeading), cos(uBeaconHeading));
      float streak = beaconWedge(dot(toF / max(bd, 0.001), dir), bd);
      float shimmer = 0.7 + 0.3 * (r1.x + r2.y);
      col += vec3(1.0, 0.93, 0.72) * streak * shimmer * uBeaconLevel * 1.6;
    }

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

// the water ends a little past the fog; a cheap fog-coloured skirt covers the rest
export const WATER_FOG = { near: 48, far: 175 };
const SIZE = 2 * (WATER_FOG.far + 25);
const SEGMENTS = 56;
const CELL = SIZE / SEGMENTS;

export default function Water() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const skirt = useRef<THREE.Mesh>(null);
  const mirror = useMemo(() => new WaterMirror(0.4, 0), []);
  useEffect(() => () => mirror.dispose(), [mirror]);
  // the water never mirrors itself
  useEffect(() => {
    for (const o of [mesh.current, skirt.current]) if (o) hideFromMirror(o);
  }, []);

  const uniforms = useMemo(
    () => ({
      ...THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog]),
      ...mirrorUniforms(),
      uLampPos: LAMP_UNIFORMS.uLampPos,
      uLampPower: LAMP_UNIFORMS.uLampPower,
      uLampCount: LAMP_UNIFORMS.uLampCount,
      uLampColor: LAMP_UNIFORMS.uLampColor,
      uLampRange: LAMP_UNIFORMS.uLampRange,
      uTime: { value: 0 },
      uSunDir: { value: DAY.sunDir.clone() },
      uSunUp: { value: 1 },
      uNight: { value: 0 },
      uRipples: { value: getWaterRipples() },
      uBeaconWorld: { value: new THREE.Vector3() },
      uBeaconHeading: { value: 0 },
      uBeaconLevel: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    // follow the camera in whole grid cells, so vertices never swim
    if (mesh.current) {
      mesh.current.position.x = Math.round(state.camera.position.x / CELL) * CELL;
      mesh.current.position.z = Math.round(state.camera.position.z / CELL) * CELL;
    }
    skirt.current?.position.set(state.camera.position.x, -0.06, state.camera.position.z);
    if (material.current) {
      const u = material.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uSunDir.value.copy(DAY.sunDir);
      u.uSunUp.value = DAY.sunUp;
      u.uNight.value = DAY.night;
      u.uBeaconWorld.value.copy(BEACON.pos);
      u.uBeaconHeading.value = BEACON.dir;
      u.uBeaconLevel.value = BEACON.on;
    }
  });

  return (
    <>
      {/* drawn after every opaque object (and the boats' hull lids): no water
          inside the boats, and early-z skips whatever the scenery covers */}
      <mesh ref={skirt} rotation-x={-Math.PI / 2} frustumCulled={false} renderOrder={2}>
        <ringGeometry args={[SIZE / 2 - 6, 235, 48, 1]} />
        <meshBasicMaterial color="#000000" fog />
      </mesh>
      <mesh
        ref={mesh}
        rotation-x={-Math.PI / 2}
        position-y={-0.02}
        frustumCulled={false}
        renderOrder={2}
        receiveShadow
        // R3F copies a ShaderMaterial's uniforms into its own objects, so
        // per-frame values go into the uniforms of the material actually drawn
        onBeforeRender={(gl, scene, camera, _geometry, mat) => {
          const u = (mat as THREE.ShaderMaterial).uniforms;
          mirror.render(gl, scene, camera, u as MirrorUniforms);
          u.uLampCount.value = LAMP_UNIFORMS.uLampCount.value;
        }}
      >
        <planeGeometry args={[SIZE, SIZE, SEGMENTS, SEGMENTS]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          fog
          lights
        />
      </mesh>
    </>
  );
}
