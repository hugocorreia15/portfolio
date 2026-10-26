"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, Stats } from "@react-three/drei";
import * as THREE from "three";
import type { MapDef } from "@/lib/maps";
import Water, { WATER_FOG } from "@/components/three/Water";
import City from "@/components/three/City";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Landmark from "@/components/three/Landmarks";
import PortDock from "@/components/three/PortDock";
import { PlacedProps } from "@/components/three/props";
import Moliceiro, { AmbientBoats } from "@/components/three/Moliceiro";
import { preloadModels } from "@/lib/models";
import { installLampLighting } from "@/lib/lampLights";
import { mirrorStats, setMirrorQuality } from "@/lib/reflection";
import {
  DayNightController,
  NightStars,
  ShootingStars,
  SkyClouds,
} from "@/components/three/Atmosphere";

preloadModels();
installLampLighting();

// the real-city geometry is a few hundred KB: only fetch it for that map
const AveiroCity = lazy(() => import("@/components/three/AveiroCity"));

// whole-frame counters (the water's mirror pass would reset three's own), plus
// the cost of the last shadow-map refresh on its own
const frameStats = { shadowCalls: 0, shadowTris: 0 };
function instrumentRenderer(gl: THREE.WebGLRenderer) {
  gl.info.autoReset = false;
  const shadows = gl.shadowMap;
  const render = shadows.render.bind(shadows);
  shadows.render = (lights, scene, camera) => {
    const c0 = gl.info.render.calls;
    const t0 = gl.info.render.triangles;
    render(lights, scene, camera);
    if (gl.info.render.calls > c0) {
      frameStats.shadowCalls = gl.info.render.calls - c0;
      frameStats.shadowTris = gl.info.render.triangles - t0;
    }
  };
  return () => {
    gl.info.autoReset = true;
    shadows.render = render;
  };
}

/** ?stats: also log draw calls and triangles every few seconds. */
function RenderInfo() {
  const next = useRef(0);
  const gl = useThree((s) => s.gl);
  useEffect(() => instrumentRenderer(gl), [gl]);
  useFrame(({ gl, clock, scene }) => {
    // runs before this frame's render: the counters hold the whole last frame
    const { calls, triangles } = gl.info.render;
    gl.info.reset();
    if (clock.elapsedTime < next.current) return;
    next.current = clock.elapsedTime + 3;
    console.info(
      `[render] ${calls} calls · ${(triangles / 1000).toFixed(0)}k tris · ${gl.info.programs?.length ?? 0} programs` +
        ` · shadow pass ${frameStats.shadowCalls} calls / ${(frameStats.shadowTris / 1000).toFixed(0)}k tris` +
        ` · mirror ${mirrorStats.calls} calls`
    );
    // heaviest meshes in the scene (whole scene, not just what's on screen)
    const heavy = new Map<string, number>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const g = m.geometry;
      const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
      const key = `${m.geometry.type}:${(m.material as THREE.Material).type}:${Math.round(tris)}`;
      heavy.set(key, (heavy.get(key) ?? 0) + tris * n);
    });
    const top = [...heavy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.info(`[heavy] ${top.map(([k, v]) => `${k}=${(v / 1000).toFixed(0)}k`).join(" | ")}`);
  });
  return null;
}

export default function Scene({
  map,
  targetIndex,
  dockedIndex,
  startIndex,
  joystick,
  onArrive,
  onNavigate,
  onManualStart,
  onNearPort,
  onRequestDock,
}: {
  map: MapDef;
  targetIndex: number | null;
  dockedIndex: number | null;
  startIndex: number | null;
  joystick: { current: { x: number; y: number } };
  onArrive: (index: number) => void;
  onNavigate: (index: number) => void;
  onManualStart: () => void;
  onNearPort: (index: number | null) => void;
  onRequestDock: (index: number) => void;
}) {
  // add ?stats to the URL to show a live FPS / frame-time overlay
  // resolution follows the frame rate: sharper on capable machines, softer when
  // the GPU struggles (the monitor nudges `factor` between 0 and 1)
  const maxDpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 1.6) : 1;
  const [dpr, setDpr] = useState(Math.min(maxDpr, 1.15));

  const ambientCenter = useMemo(() => {
    const pts = map.ambientCurve.getPoints(16);
    return {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      z: pts.reduce((a, p) => a + p.z, 0) / pts.length,
    };
  }, [map]);
  const showStats =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("stats");
  return (
    <Canvas
      shadows="percentage"
      dpr={dpr}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      camera={{ position: [6, 10, 46], fov: 42, near: 0.5, far: 240 }}
      className="!fixed inset-0"
    >
      {showStats && <Stats />}
      {showStats && <RenderInfo />}
      <PerformanceMonitor
        factor={0.5}
        flipflops={4}
        onChange={({ factor }) => {
          setDpr(Math.round((0.7 + (maxDpr - 0.7) * factor) * 20) / 20);
          setMirrorQuality(factor);
        }}
        onFallback={() => {
          setDpr(0.75);
          setMirrorQuality(0);
        }}
      />
      <color attach="background" args={["#cfe6f2"]} />
      <fog attach="fog" args={["#cfe6f2", WATER_FOG.near, WATER_FOG.far]} />

      {/* sun, moon, sky, fog and lights, all driven through the day-night loop */}
      <DayNightController />
      <NightStars />
      <SkyClouds />
      <ShootingStars />

      {/* lightweight baked reflections (no external HDRI) for PBR materials */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.6} position={[0, 6, 0]} scale={[12, 12, 1]} color="#eaf3ff" />
        <Lightformer intensity={1.0} position={[6, 2, 4]} scale={[8, 8, 1]} color="#fff2d8" />
        <Lightformer intensity={0.6} position={[-6, 1, -4]} scale={[8, 8, 1]} color="#9fb6d8" />
      </Environment>

      <Water />
      {/* every <Tree>/<Bush> of the landmarks and islands, instanced */}
      <Suspense fallback={null}>
        <PlacedProps />
      </Suspense>
      {map.id === "island" ? (
        <City />
      ) : (
        <Suspense fallback={null}>
          <AveiroCity />
        </Suspense>
      )}
      {map.ports.map((port, i) => (
        <group key={port.id}>
          <Landmark port={port} />
          <PortDock
            port={port}
            index={i}
            active={dockedIndex === i}
            targeted={targetIndex === i}
            quayside={map.kind === "network"}
            scale={map.boatScale}
            onSelect={() => onNavigate(i)}
          />
        </group>
      ))}
      <Moliceiro
        map={map}
        targetIndex={targetIndex}
        dockedIndex={dockedIndex}
        startIndex={startIndex}
        joystick={joystick}
        onArrive={onArrive}
        onManualStart={onManualStart}
        onNearPort={onNearPort}
        onRequestDock={onRequestDock}
      />
      <AmbientBoats curve={map.ambientCurve} scale={map.boatScale} center={ambientCenter} />
    </Canvas>
  );
}
