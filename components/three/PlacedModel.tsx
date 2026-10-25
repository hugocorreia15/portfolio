"use client";

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

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
 * A model standing in the world, scaled to `size` and grounded; the fallback
 * children (a procedural stand-in) show while it streams in.
 */
export function ModelPlacement({
  url,
  position,
  rotY = 0,
  size,
  islet = false,
  yOffset = 0,
  children,
}: {
  url: string;
  position: [number, number, number];
  rotY?: number;
  size: number;
  islet?: boolean;
  yOffset?: number;
  children?: React.ReactNode;
}) {
  return (
    <group position={position} rotation-y={rotY}>
      {islet && (
        <mesh position-y={-0.1} receiveShadow>
          <cylinderGeometry args={[size * 0.62, size * 0.72, 0.4, 22]} />
          <meshStandardMaterial color="#9fae74" roughness={1} />
        </mesh>
      )}
      <Suspense fallback={children ?? null}>
        <Glb url={url} size={size} y={(islet ? 0.1 : 0) + yOffset} />
      </Suspense>
    </group>
  );
}
