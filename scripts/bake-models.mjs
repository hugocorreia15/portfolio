#!/usr/bin/env node
/**
 * Bake the runtime GLBs in public/models from the downloaded Sketchfab sources
 * in assets-src/models (see data/credits.ts for authors and licences).
 *
 * - packs are split into single props (tree, tree pair, bush, street lamp),
 *   centred on the origin, grounded at y = 0 and scaled to unit height;
 * - heavy meshes (bridge, lamp) are simplified;
 * - everything is meshopt-compressed with textures re-encoded as small WebP.
 *
 *   npm run models
 */
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  getBounds,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.join(ROOT, "assets-src", "models");
const OUT = path.join(ROOT, "public", "models");

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

/** Drop NORMALs so flat-shaded meshes can weld (and thus simplify). */
const dropNormals = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) prim.setAttribute("NORMAL", null);
  }
};

/** Area-weighted smooth normals for indexed triangle primitives. */
const smoothNormals = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const idx = prim.getIndices();
      if (!pos || !idx) continue;
      const p = pos.getArray();
      const ix = idx.getArray();
      const n = new Float32Array(pos.getCount() * 3);
      for (let t = 0; t < ix.length; t += 3) {
        const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
        const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const v of [a, b, c]) {
          n[v] += nx;
          n[v + 1] += ny;
          n[v + 2] += nz;
        }
      }
      for (let v = 0; v < n.length; v += 3) {
        const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1;
        n[v] /= l;
        n[v + 1] /= l;
        n[v + 2] /= l;
      }
      prim.setAttribute(
        "NORMAL",
        doc.createAccessor().setType("VEC3").setArray(n).setBuffer(pos.getBuffer())
      );
    }
  }
};

const center = (b) => b.min.map((v, i) => (v + b.max[i]) / 2);

/** Keep only the mesh nodes the predicate accepts (by name and world centre). */
function keepMeshes(doc, keep) {
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    if (!keep(node.getName(), center(getBounds(node)))) node.dispose();
  }
}

/** Re-parent the scene under one node that centres it on x/z and grounds it;
 *  with `unitHeight` the result is also scaled to 1 unit tall. */
function normalise(doc, unitHeight) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  const [cx, , cz] = center(b);
  const s = unitHeight ? 1 / (b.max[1] - b.min[1]) : 1;
  const pivot = doc.createNode("pivot").setScale([s, s, s]);
  const inner = doc.createNode("offset").setTranslation([-cx, -b.min[1], -cz]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    inner.addChild(child);
  }
  pivot.addChild(inner);
  scene.addChild(pivot);
}

async function bake({
  src,
  out,
  keep,
  unitHeight = false,
  simplifyRatio,
  simplifyError = 0.002,
  resmooth = false,
  maxTexture = 512,
}) {
  const doc = await io.read(path.join(SRC, src));
  if (keep) keepMeshes(doc, keep);
  normalise(doc, unitHeight);
  const steps = [prune(), dedup()];
  if (simplifyRatio) {
    if (resmooth) steps.push(dropNormals());
    steps.push(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: simplifyError })
    );
    if (resmooth) steps.push(smoothNormals());
  }
  steps.push(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [maxTexture, maxTexture] }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" })
  );
  await doc.transform(...steps);
  await io.write(path.join(OUT, out), doc);
  const verts = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((a, p) => a + p.getAttribute("POSITION").getCount(), 0);
  console.log(`${out.padEnd(22)} ${verts} verts`);
}

const near = (v, target, r) => Math.abs(v - target) < r;

// the forest pack: tree A stands at x≈-13.5, the pair (big + small) around x≈-35
await bake({
  src: "low_poly_forest_tree_pack.glb",
  out: "tree-a.glb",
  unitHeight: true,
  keep: (n, c) => /Tree_(Branches|Trunk)_02/.test(n) && near(c[0], -13.5, 5),
});
await bake({
  src: "low_poly_forest_tree_pack.glb",
  out: "tree-b.glb",
  unitHeight: true,
  keep: (n) => /Tree_(Branches|Trunk)_01/.test(n),
});
await bake({
  src: "low_poly_forest_tree_pack.glb",
  out: "bush.glb",
  unitHeight: true,
  keep: (n) => /Tree_Branches_02/.test(n),
});
// the middle lamp of the three-lamp row
await bake({
  src: "old_street_lamp_pack.glb",
  out: "street-lamp.glb",
  unitHeight: true,
  simplifyRatio: 0.25,
  simplifyError: 0.01,
  resmooth: true,
  keep: (_n, c) => near(c[0], 0, 1.1),
});
await bake({
  src: "ponte-carcavelos.glb",
  out: "ponte-carcavelos.glb",
  simplifyRatio: 0.18,
  simplifyError: 0.008,
  resmooth: true,
});
await bake({ src: "igreja-barrocas.glb", out: "igreja-barrocas.glb" });
