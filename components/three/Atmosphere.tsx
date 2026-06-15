"use client";

import { type ComponentRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { DAY, advanceDay } from "@/lib/daynight";
import { mulberry32 } from "@/lib/ports";
import { getTexture } from "@/lib/textures";

const _X = new THREE.Vector3(1, 0, 0);

const C_DAY_SKY = new THREE.Color("#bcdcf0");
const C_DUSK_SKY = new THREE.Color("#e8a25f");
const C_NIGHT_SKY = new THREE.Color("#091227");
const C_DAY_FOG = new THREE.Color("#cfe6f2");
const C_DUSK_FOG = new THREE.Color("#dfaa7c");
const C_NIGHT_FOG = new THREE.Color("#0a1430");
const C_SUN = new THREE.Color("#fff3da");
const C_SUN_DUSK = new THREE.Color("#ff8334");
const C_MOON = new THREE.Color("#9fb8e6");

/** Drives the sun, sky, lights, fog and exposure through a full day-night loop. */
export function DayNightController() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sky = useRef<ComponentRef<typeof Sky>>(null);
  const sunDisc = useRef<THREE.Group>(null);
  const moonDisc = useRef<THREE.Group>(null);
  const shadowTimer = useRef(0);

  useFrame((state, dt) => {
    const { scene, gl } = state;

    // the sun moves slowly, so refresh shadows a few times a second, not every
    // frame — a big saving (one full shadow pass per refresh instead of 60).
    gl.shadowMap.autoUpdate = false;
    shadowTimer.current -= dt;
    if (shadowTimer.current <= 0) {
      gl.shadowMap.needsUpdate = true;
      shadowTimer.current = 0.35;
    }

    const elev = advanceDay(Math.min(dt, 0.05));
    const { night, sunUp: up, dusk } = DAY;
    const sunPos = DAY.sunDir.clone().multiplyScalar(420);

    const skyMat = sky.current?.material as THREE.ShaderMaterial | undefined;
    if (skyMat) {
      skyMat.uniforms.sunPosition.value.copy(sunPos);
      skyMat.uniforms.turbidity.value = THREE.MathUtils.lerp(2.4, 10, dusk);
      skyMat.uniforms.rayleigh.value = THREE.MathUtils.lerp(0.7, 3, dusk) * (1 - night) + 0.04;
      skyMat.uniforms.mieCoefficient.value = 0.005;
      skyMat.uniforms.mieDirectionalG.value = 0.86;
    }

    const bg = C_DAY_SKY.clone().lerp(C_DUSK_SKY, dusk).lerp(C_NIGHT_SKY, night);
    const fogC = C_DAY_FOG.clone().lerp(C_DUSK_FOG, dusk).lerp(C_NIGHT_FOG, night);
    if (scene.background instanceof THREE.Color) scene.background.copy(bg);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fogC);

    if (sun.current) {
      sun.current.position.copy(sunPos);
      sun.current.intensity = up * 1.95;
      sun.current.color.copy(C_SUN.clone().lerp(C_SUN_DUSK, dusk));
    }
    if (moon.current) {
      moon.current.position.set(-sunPos.x, Math.abs(sunPos.y) * 0.5 + 80, -sunPos.z);
      moon.current.intensity = night * 0.4;
    }
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(0.16, 0.5, up) + night * 0.08;
      hemi.current.color.copy(C_DAY_SKY.clone().lerp(C_NIGHT_SKY, night));
    }
    if (ambient.current) {
      ambient.current.intensity = THREE.MathUtils.lerp(0.14, 0.24, up) + night * 0.06;
      ambient.current.color.copy(C_MOON.clone().lerp(C_SUN, up));
    }

    gl.toneMappingExposure = THREE.MathUtils.lerp(0.5, 1.05, up) + dusk * 0.12;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.1, 0.7, up);

    // place the discs on a capped-elevation dome so they stay in the sky view
    // instead of climbing straight overhead at noon/midnight
    const azi = Math.atan2(DAY.sunDir.x, DAY.sunDir.z);
    const elevAngle = Math.asin(THREE.MathUtils.clamp(DAY.sunDir.y, -1, 1));
    if (sunDisc.current) {
      const e = Math.min(elevAngle, 0.26);
      const ch = Math.cos(e);
      sunDisc.current.position
        .set(Math.sin(azi) * ch, Math.sin(e), Math.cos(azi) * ch)
        .multiplyScalar(260);
      sunDisc.current.visible = elev > -0.1;
    }
    if (moonDisc.current) {
      const e = Math.min(Math.max(-elevAngle, 0.08), 0.26);
      const ch = Math.cos(e);
      const ma = azi + Math.PI;
      moonDisc.current.position
        .set(Math.sin(ma) * ch, Math.sin(e), Math.cos(ma) * ch)
        .multiplyScalar(260);
      moonDisc.current.visible = elev < 0.1;
    }
  });

  return (
    <>
      <Sky ref={sky} distance={3000} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-far={520}
        shadow-bias={-0.0005}
        shadow-normalBias={0.6}
      />
      <directionalLight ref={moon} color="#9fb8e6" />
      <hemisphereLight ref={hemi} groundColor="#5d5566" />
      <ambientLight ref={ambient} />
      <group ref={sunDisc}>
        <mesh>
          <sphereGeometry args={[18, 28, 28]} />
          <meshBasicMaterial color="#fff4d0" fog={false} toneMapped={false} />
        </mesh>
        <sprite scale={[175, 175, 1]}>
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
          <sphereGeometry args={[13, 28, 28]} />
          <meshBasicMaterial color="#eef3ff" fog={false} toneMapped={false} />
        </mesh>
        <sprite scale={[105, 105, 1]}>
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
        .multiplyScalar(600);
      pos.set([v.x, v.y, v.z], i * 3);
      c.setHSL(0.55 + (rnd() - 0.5) * 0.1, 0.3, 0.7 + rnd() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  useFrame((state) => {
    if (mat.current) {
      const tw = 0.82 + 0.18 * Math.sin(state.clock.elapsedTime * 2.5);
      mat.current.opacity = DAY.night * tw;
    }
  });

  return (
    <points geometry={geom} frustumCulled={false}>
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

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    timer.current -= dt;
    if (DAY.night > 0.5 && timer.current <= 0) {
      timer.current = 2 + Math.random() * 5;
      const s = streaks.current.find((x) => !x.active);
      if (s) {
        s.active = true;
        s.t = 0;
        s.life = 0.6 + Math.random() * 0.6;
        const az = Math.random() * Math.PI * 2;
        s.p.set(Math.cos(az) * 200, 110 + Math.random() * 70, Math.sin(az) * 200);
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
      mesh.quaternion.setFromUnitVectors(_X, s.v.clone().normalize());
      const k = 1 - s.t / s.life;
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * DAY.night;
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} visible={false}>
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
