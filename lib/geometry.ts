import * as THREE from "three";

/**
 * Give a geometry a flat vertex colour, so differently coloured parts can be
 * merged into one mesh (one draw call) under a `vertexColors` material.
 */
export function tinted<T extends THREE.BufferGeometry>(geometry: T, color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(data, 3));
  return geometry;
}
