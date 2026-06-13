"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PLACED_MODELS } from "@/lib/placedModels";
import type { MapId } from "@/lib/maps";

// one probe per file — placements simply skip GLBs that aren't downloaded yet
const probes = new Map<string, Promise<boolean>>();
function probe(url: string) {
  let p = probes.get(url);
  if (!p) {
    p = fetch(url, { method: "HEAD" })
      .then((r) => r.ok)
      .catch(() => false);
    probes.set(url, p);
  }
  return p;
}

export function useModelFile(url: string) {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let on = true;
    probe(url).then((v) => {
      if (on) setHas(v);
    });
    return () => {
      on = false;
    };
  }, [url]);
  return has;
}

function Glb({ url, size, y }: { url: string; size: number; y: number }) {
  const { scene } = useGLTF(url);
  const prepared = useMemo(() => {
    const obj = scene.clone(true);
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(obj);
    const sz = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(obj);
    const s = size / Math.max(sz.x, sz.z, 0.001);
    wrapper.scale.setScalar(s);
    // bounding-box bottom on the ground
    wrapper.position.y = (sz.y * s) / 2 + y;
    return wrapper;
  }, [scene, size, y]);
  return <primitive object={prepared} />;
}

/**
 * A downloaded Sketchfab model standing in the world. Renders the fallback
 * children (if any) until/unless the GLB exists in public/models.
 */
export function OptionalGlb({
  url,
  position,
  rotY = 0,
  size,
  islet = false,
  children,
}: {
  url: string;
  position: [number, number, number];
  rotY?: number;
  size: number;
  islet?: boolean;
  children?: React.ReactNode;
}) {
  const has = useModelFile(url);
  if (!has) return <>{children}</>;
  return (
    <group position={position} rotation-y={rotY}>
      {islet && (
        <mesh position-y={-0.1} receiveShadow>
          <cylinderGeometry args={[size * 0.62, size * 0.72, 0.4, 22]} />
          <meshStandardMaterial color="#9fae74" roughness={1} />
        </mesh>
      )}
      <Suspense fallback={children ? <>{children}</> : null}>
        <Glb url={url} size={size} y={islet ? 0.1 : 0} />
      </Suspense>
    </group>
  );
}

/** All registry placements for the active map. */
export default function PlacedModels({ map }: { map: MapId }) {
  return (
    <>
      {PLACED_MODELS.filter((m) => m.map === map).map((m, i) => (
        <OptionalGlb
          key={`${m.file}-${i}`}
          url={`/models/${m.file}`}
          position={m.position}
          rotY={m.rotY}
          size={m.size}
          islet={m.islet}
        />
      ))}
    </>
  );
}
