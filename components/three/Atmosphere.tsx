"use client";

import { type ComponentRef, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { DAY, advanceDay } from "@/lib/daynight";
import { updateNightMaterials } from "@/lib/nightMaterials";
import { bindLampView, updateLampLights } from "@/lib/lampLights";
import { hideFromMirror, showNoMirrorLayer } from "@/lib/reflection";
import { mulberry32 } from "@/lib/ports";
import { getTexture } from "@/lib/textures";
import { CLOUD_GLSL, CLOUD_UNIFORMS, cloudUniforms } from "@/lib/clouds";

const _X = new THREE.Vector3(1, 0, 0);
const _sunPos = new THREE.Vector3();
const _focus = new THREE.Vector3();
const _look = new THREE.Vector3();
const _c = new THREE.Color();

// the sun's shadow frustum covers a square this wide around what the camera
// looks at, snapped to a grid so the shadows don't shimmer as it follows
const SHADOW_HALF = 48;
const SHADOW_MAP = 1024;
const SHADOW_SNAP = ((2 * SHADOW_HALF) / SHADOW_MAP) * 32;
/** The sky dome rides with the camera, so it fits inside a short far plane. */
export const SKY_RADIUS = 190;

const C_DAY_SKY = new THREE.Color("#bcdcf0");
const C_DUSK_SKY = new THREE.Color("#e8a25f");
const C_NIGHT_SKY = new THREE.Color("#091227");
const C_DAY_FOG = new THREE.Color("#cfe6f2");
const C_DUSK_FOG = new THREE.Color("#dfaa7c");
const C_NIGHT_FOG = new THREE.Color("#0a1430");
const C_SUN = new THREE.Color("#fff3da");
const C_SUN_DUSK = new THREE.Color("#ff8334");
const C_MOON = new THREE.Color("#9fb8e6");
// moonlit fill: islands stay readable at night, in a cool blue
const C_NIGHT_FILL = new THREE.Color("#5b74ad");
const C_DUSK_FILL = new THREE.Color("#f0b383");
const C_NIGHT_GROUND = new THREE.Color("#3a3546");
const C_DAY_GROUND = new THREE.Color("#5d5566");

/** Drives the sun, sky, lights, fog and exposure through a full day-night loop. */
export function DayNightController() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sky = useRef<ComponentRef<typeof Sky>>(null);
  const skyGroup = useRef<THREE.Group>(null);
  const sunDisc = useRef<THREE.Group>(null);
  const moonDisc = useRef<THREE.Group>(null);

  // lamps and the beacon go into view space with each render's own camera
  // (the main one, and the water's mirror camera)
  const scene = useThree((s) => s.scene);
  useEffect(() => bindLampView(scene), [scene]);
  // the water draws its own sky: no dome or discs in its reflection
  useEffect(() => {
    for (const o of [skyGroup.current, sunDisc.current, moonDisc.current]) if (o) hideFromMirror(o);
  }, []);
  // the main camera and the pointer still see what the mirror skips
  const camera = useThree((s) => s.camera);
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => showNoMirrorLayer(camera, raycaster), [camera, raycaster]);

  useFrame((state, dt) => {
    const { scene, gl, camera } = state;

    const elev = advanceDay(Math.min(dt, 0.05));
    const { night, sunUp: up, dusk } = DAY;
    updateNightMaterials(night, state.clock.elapsedTime);
    updateLampLights(camera, night, dt);
    const sunPos = _sunPos.copy(DAY.sunDir).multiplyScalar(420);

    // shadows are redrawn every frame (the boats move: a slower refresh makes
    // their shadows jump), but only from this frame's main render — the
    // water's mirror pass must not redraw them from its own camera. The
    // frustum is re-centred on the ground point the camera looks at.
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    if (sun.current) {
      camera.getWorldDirection(_look);
      const reach = _look.y < -0.05 ? Math.min(-camera.position.y / _look.y, 60) : 40;
      _focus.copy(camera.position).addScaledVector(_look, reach);
      _focus.set(
        Math.round(_focus.x / SHADOW_SNAP) * SHADOW_SNAP,
        0,
        Math.round(_focus.z / SHADOW_SNAP) * SHADOW_SNAP
      );
      sun.current.target.position.copy(_focus);
      sun.current.target.updateMatrixWorld();
    }

    sky.current?.position.copy(camera.position);
    const skyMat = sky.current?.material as THREE.ShaderMaterial | undefined;
    if (skyMat) {
      skyMat.uniforms.sunPosition.value.copy(sunPos);
      skyMat.uniforms.turbidity.value = THREE.MathUtils.lerp(2.4, 10, dusk);
      skyMat.uniforms.rayleigh.value = THREE.MathUtils.lerp(0.7, 3, dusk) * (1 - night) + 0.04;
      skyMat.uniforms.mieCoefficient.value = 0.005;
      skyMat.uniforms.mieDirectionalG.value = 0.86;
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(C_DAY_SKY).lerp(C_DUSK_SKY, dusk).lerp(C_NIGHT_SKY, night);
    }
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.copy(C_DAY_FOG).lerp(C_DUSK_FOG, dusk).lerp(C_NIGHT_FOG, night);
    }

    // the light keeps a steady level through sunrise and sunset: the sky's fill
    // takes over while the sun is too low to light much, then the moon's
    if (sun.current) {
      sun.current.position.copy(sun.current.target.position).add(sunPos);
      sun.current.intensity = 1.95 * THREE.MathUtils.smoothstep(elev, -0.02, 0.45);
      sun.current.color.copy(C_SUN).lerp(C_SUN_DUSK, dusk);
    }
    if (moon.current) {
      moon.current.position.set(-sunPos.x, Math.abs(sunPos.y) * 0.5 + 80, -sunPos.z);
      moon.current.intensity = night * 1.1;
    }
    if (hemi.current) {
      // sky fill: blue by day, warm at dusk, a dim cool moonlit fill at night
      // (the islands stay readable while the lamps and windows carry the scene)
      hemi.current.intensity = 0.42 + 0.08 * up + 0.18 * night;
      hemi.current.color.copy(C_DAY_SKY).lerp(C_DUSK_FILL, dusk).lerp(C_NIGHT_FILL, night);
      hemi.current.groundColor.copy(C_DAY_GROUND).lerp(C_NIGHT_GROUND, night);
    }
    if (ambient.current) {
      ambient.current.intensity = 0.1 + 0.14 * up + 0.04 * night;
      ambient.current.color.copy(C_MOON).lerp(_c.copy(C_SUN), up);
    }

    gl.toneMappingExposure = THREE.MathUtils.lerp(0.6, 1.05, up) + dusk * 0.12;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.2, 0.7, up) - 0.16 * night;

    // place the discs on a capped-elevation dome so they stay in the sky view
    // instead of climbing straight overhead at noon/midnight
    const azi = Math.atan2(DAY.sunDir.x, DAY.sunDir.z);
    const elevAngle = Math.asin(THREE.MathUtils.clamp(DAY.sunDir.y, -1, 1));
    if (sunDisc.current) {
      const e = Math.min(elevAngle, 0.26);
      const ch = Math.cos(e);
      sunDisc.current.position
        .set(Math.sin(azi) * ch, Math.sin(e), Math.cos(azi) * ch)
        .multiplyScalar(SKY_RADIUS)
        .add(camera.position);
      sunDisc.current.visible = elev > -0.1;
    }
    if (moonDisc.current) {
      const e = Math.min(Math.max(-elevAngle, 0.08), 0.26);
      const ch = Math.cos(e);
      const ma = azi + Math.PI;
      moonDisc.current.position
        .set(Math.sin(ma) * ch, Math.sin(e), Math.cos(ma) * ch)
        .multiplyScalar(SKY_RADIUS)
        .add(camera.position);
      moonDisc.current.visible = elev < 0.1;
    }
  });

  return (
    <>
      <group ref={skyGroup}>
        <Sky ref={sky} distance={250} />
      </group>
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-far={900}
        shadow-bias={-0.0005}
        shadow-normalBias={0.6}
      />
      <directionalLight ref={moon} color="#9fb8e6" />
      <hemisphereLight ref={hemi} />
      <ambientLight ref={ambient} />
      <group ref={sunDisc}>
        <mesh>
          <sphereGeometry args={[13, 28, 28]} />
          <meshBasicMaterial color="#fff4d0" fog={false} toneMapped={false} />
        </mesh>
        <sprite scale={[128, 128, 1]} renderOrder={-2}>
          <spriteMaterial
            map={getTexture("foam")}
            color="#ffd05e"
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            fog={false}
            toneMapped={false}
          />
        </sprite>
      </group>
      <group ref={moonDisc}>
        <mesh>
          <sphereGeometry args={[9.5, 28, 28]} />
          <meshBasicMaterial color="#eef3ff" fog={false} toneMapped={false} />
        </mesh>
        <sprite scale={[77, 77, 1]} renderOrder={-2}>
          <spriteMaterial
            map={getTexture("foam")}
            color="#aec6f4"
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            fog={false}
            toneMapped={false}
          />
        </sprite>
      </group>
    </>
  );
}

/** A dome of stars that fades in at night. */
export function NightStars() {
  const mat = useRef<THREE.PointsMaterial>(null);
  const geom = useMemo(() => {
    const rnd = mulberry32(8842);
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      v.set(rnd() - 0.5, rnd() * 0.92 + 0.02, rnd() - 0.5)
        .normalize()
        .multiplyScalar(SKY_RADIUS + 5);
      pos.set([v.x, v.y, v.z], i * 3);
      c.setHSL(0.55 + (rnd() - 0.5) * 0.1, 0.3, 0.7 + rnd() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  const points = useRef<THREE.Points>(null);
  useEffect(() => {
    if (points.current) hideFromMirror(points.current);
  }, []);
  useFrame((state) => {
    points.current?.position.copy(state.camera.position);
    if (mat.current) {
      const tw = 0.82 + 0.18 * Math.sin(state.clock.elapsedTime * 2.5);
      mat.current.opacity = DAY.night * tw;
    }
  });

  return (
    <points ref={points} geometry={geom} frustumCulled={false} renderOrder={-2}>
      <pointsMaterial
        ref={mat}
        size={1.9}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </points>
  );
}

interface Streak {
  active: boolean;
  t: number;
  life: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
}

/** Occasional shooting stars streaking across the night sky. */
export function ShootingStars() {
  const group = useRef<THREE.Group>(null);
  const timer = useRef(3);
  const streaks = useRef<Streak[]>(
    Array.from({ length: 4 }, () => ({
      active: false,
      t: 0,
      life: 1,
      p: new THREE.Vector3(),
      v: new THREE.Vector3(),
    }))
  );

  useEffect(() => {
    if (group.current) hideFromMirror(group.current);
  }, []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(state.camera.position);
    timer.current -= dt;
    if (DAY.night > 0.5 && timer.current <= 0) {
      timer.current = 2 + Math.random() * 5;
      const s = streaks.current.find((x) => !x.active);
      if (s) {
        s.active = true;
        s.t = 0;
        s.life = 0.6 + Math.random() * 0.6;
        const az = Math.random() * Math.PI * 2;
        s.p.set(Math.cos(az) * 150, 85 + Math.random() * 50, Math.sin(az) * 150);
        s.v
          .set(Math.random() - 0.5, -0.45 - Math.random() * 0.4, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(200 + Math.random() * 140);
      }
    }
    streaks.current.forEach((s, i) => {
      const mesh = g.children[i] as THREE.Mesh;
      if (!s.active) {
        mesh.visible = false;
        return;
      }
      s.t += dt;
      if (s.t > s.life) {
        s.active = false;
        mesh.visible = false;
        return;
      }
      s.p.addScaledVector(s.v, dt);
      mesh.visible = true;
      mesh.position.copy(s.p);
      mesh.quaternion.setFromUnitVectors(_X, _look.copy(s.v).normalize());
      const k = 1 - s.t / s.life;
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * DAY.night;
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} visible={false} renderOrder={-2}>
          <planeGeometry args={[10, 0.22]} />
          <meshBasicMaterial
            color="#fff8e6"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── the cloud deck ──────────────────────────────────────────────────────────

const CLOUD_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uDusk;
  uniform float uNight;
  varying vec3 vDir;
  ${CLOUD_GLSL}
  void main() {
    vec3 d = normalize(vDir);
    if (d.y < 0.004) discard;
    vec2 p = cloudUv(cameraPosition, d);
    float dens = cloudDensity(p, d.y);
    if (dens < 0.004) discard;
    // thicker cloud toward the light shades the far side; thin edges facing
    // it catch a bright rim
    float behind = cloudDensity(p + normalize(uLightDir.xz + vec2(1e-4)) * 0.02, d.y);
    float shade = clamp(1.0 - behind * 0.6 + (dens - behind) * 0.5, 0.0, 1.0);
    float rim = pow(max(dot(d, uLightDir), 0.0), 6.0) * (1.0 - dens) * 1.4;
    vec3 lit = mix(mix(vec3(1.55, 1.52, 1.48), vec3(1.65, 0.98, 0.64), uDusk), vec3(0.24, 0.28, 0.4), uNight);
    vec3 dark = mix(mix(vec3(0.6, 0.66, 0.78), vec3(0.42, 0.33, 0.44), uDusk), vec3(0.05, 0.065, 0.11), uNight);
    vec3 col = mix(dark, lit, shade) + lit * rim;
    // the deck reaches the horizon (where the camera mostly sees the sky),
    // melting into the haze right at it
    float alpha = dens * smoothstep(0.004, 0.06, d.y) * mix(0.96, 0.82, uNight);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SKY_CLOUD = {
  uLightDir: { value: new THREE.Vector3(0, 1, 0) },
  uDusk: { value: 0 },
  uNight: { value: 0 },
};
const _moonDir = new THREE.Vector3();

/** Drifting cumulus over the whole map: one dome that rides with the camera. */
export function SkyClouds() {
  const dome = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...cloudUniforms(), ...SKY_CLOUD },
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    []
  );
  useEffect(() => {
    if (dome.current) hideFromMirror(dome.current);
  }, []);
  useFrame((state) => {
    dome.current?.position.copy(state.camera.position);
    CLOUD_UNIFORMS.uCloudTime.value = state.clock.elapsedTime;
    // lit by the sun by day, by the moon (opposite it) at night
    _moonDir.set(-DAY.sunDir.x, Math.abs(DAY.sunDir.y) * 0.5 + 0.4, -DAY.sunDir.z).normalize();
    SKY_CLOUD.uLightDir.value.copy(DAY.sunDir).lerp(_moonDir, DAY.night).normalize();
    SKY_CLOUD.uDusk.value = DAY.dusk;
    SKY_CLOUD.uNight.value = DAY.night;
  });
  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      {/* the upper half of a sphere, inside the far plane */}
      <sphereGeometry args={[170, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  );
}
