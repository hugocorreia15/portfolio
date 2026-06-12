#!/usr/bin/env node
/**
 * Bake the real Aveiro canal network into data/aveiro-canals.json.
 *
 * Source priority:
 *   1. data/aveiro-canals.geojson — hand-drawn override (draw LineStrings on
 *      geojson.io, name them, save the file here, re-run `npm run canals`).
 *   2. OpenStreetMap via the Overpass API (default).
 *
 * Output is already projected to world units (north = -z) around ORIGIN.
 * Data © OpenStreetMap contributors, ODbL.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "aveiro-canals.json");
const OVERRIDE = path.join(ROOT, "data", "aveiro-canals.geojson");

const BBOX = [40.622, -8.685, 40.658, -8.628]; // south, west, north, east
const ORIGIN = { lat: 40.6406, lon: -8.6538 }; // Praça Gen. Humberto Delgado
const K = 0.12; // world units per metre
const SNAP = 0.4; // endpoint snapping in world units
const SIMPLIFY = 3.5 * K; // Douglas-Peucker epsilon (3.5 m)

const M_LAT = 111320;
const M_LON = M_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toWorld = ([lon, lat]) => [
  (lon - ORIGIN.lon) * M_LON * K,
  -(lat - ORIGIN.lat) * M_LAT * K,
];
const r2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- helpers

function simplifyDP(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  const [ax, az] = pts[0];
  const [bx, bz] = pts[pts.length - 1];
  const abx = bx - ax;
  const abz = bz - az;
  const ab2 = abx * abx + abz * abz || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * abx + (pts[i][1] - az) * abz) / ab2));
    const d = Math.hypot(pts[i][0] - (ax + abx * t), pts[i][1] - (az + abz * t));
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  const left = simplifyDP(pts.slice(0, idx + 1), eps);
  return [...left.slice(0, -1), ...simplifyDP(pts.slice(idx), eps)];
}

const snapKey = ([x, z]) => `${Math.round(x / SNAP)}:${Math.round(z / SNAP)}`;

/** Focus area in world units — the city canals, not the 15 km of ria upstream. */
const CLIP = { x0: -140, x1: 130, z0: -110, z1: 70 };

/** Drop points outside the focus area, splitting ways where they leave it. */
function clipLines(lines) {
  const out = [];
  for (const l of lines) {
    let run = [];
    for (const p of l.pts) {
      const inside = p[0] >= CLIP.x0 && p[0] <= CLIP.x1 && p[1] >= CLIP.z0 && p[1] <= CLIP.z1;
      if (inside) {
        run.push(p);
      } else if (run.length > 1) {
        out.push({ name: l.name, pts: run });
        run = [];
      } else {
        run = [];
      }
    }
    if (run.length > 1) out.push({ name: l.name, pts: run });
  }
  return out;
}

/** Split ways at T-junctions: interior points that other ways also touch. */
function splitAtJunctions(lines) {
  const usage = new Map();
  lines.forEach((l, li) => {
    for (const p of l.pts) {
      const k = snapKey(p);
      if (!usage.has(k)) usage.set(k, new Set());
      usage.get(k).add(li);
    }
  });
  const out = [];
  for (const l of lines) {
    let cur = [l.pts[0]];
    for (let i = 1; i < l.pts.length; i++) {
      cur.push(l.pts[i]);
      const shared = (usage.get(snapKey(l.pts[i]))?.size ?? 0) >= 2;
      if (shared && i < l.pts.length - 1) {
        out.push({ name: l.name, pts: cur });
        cur = [l.pts[i]];
      }
    }
    if (cur.length > 1) out.push({ name: l.name, pts: cur });
  }
  return out;
}

/** Merge way fragments into junction-to-junction polylines. */
function stitch(lines) {
  const degree = new Map();
  for (const l of lines) {
    for (const k of [snapKey(l.pts[0]), snapKey(l.pts[l.pts.length - 1])]) {
      degree.set(k, (degree.get(k) ?? 0) + 1);
    }
  }
  const used = new Set();
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    let pts = [...lines[i].pts];
    let name = lines[i].name;
    let extended = true;
    while (extended) {
      extended = false;
      for (let j = 0; j < lines.length; j++) {
        if (used.has(j)) continue;
        const head = snapKey(pts[0]);
        const tail = snapKey(pts[pts.length - 1]);
        const other = lines[j].pts;
        const oHead = snapKey(other[0]);
        const oTail = snapKey(other[other.length - 1]);
        // only merge through degree-2 nodes so junctions stay graph nodes
        if (tail === oHead && degree.get(tail) === 2) {
          pts = [...pts, ...other.slice(1)];
        } else if (tail === oTail && degree.get(tail) === 2) {
          pts = [...pts, ...other.slice(0, -1).reverse()];
        } else if (head === oTail && degree.get(head) === 2) {
          pts = [...other.slice(0, -1), ...pts];
        } else if (head === oHead && degree.get(head) === 2) {
          pts = [...other.slice(1).reverse(), ...pts];
        } else {
          continue;
        }
        name = name || lines[j].name;
        used.add(j);
        extended = true;
        break;
      }
    }
    merged.push({ name, pts });
  }
  return merged;
}

/** Keep only the connected component closest to the city centre (0,0). */
function mainComponent(edges) {
  const adj = new Map();
  edges.forEach((e, i) => {
    for (const k of [snapKey(e.pts[0]), snapKey(e.pts[e.pts.length - 1])]) {
      adj.set(k, [...(adj.get(k) ?? []), i]);
    }
  });
  let seedEdge = 0;
  let seedD = Infinity;
  edges.forEach((e, i) => {
    for (const [x, z] of e.pts) {
      const d = x * x + z * z;
      if (d < seedD) {
        seedD = d;
        seedEdge = i;
      }
    }
  });
  const keep = new Set([seedEdge]);
  const queue = [seedEdge];
  while (queue.length) {
    const e = edges[queue.pop()];
    for (const k of [snapKey(e.pts[0]), snapKey(e.pts[e.pts.length - 1])]) {
      for (const j of adj.get(k) ?? []) {
        if (!keep.has(j)) {
          keep.add(j);
          queue.push(j);
        }
      }
    }
  }
  return edges.filter((_, i) => keep.has(i));
}

const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "aveiro-portfolio-canal-bake/1.0 (one-off map generation)",
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status} (${url})`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn(`attempt ${attempt + 1} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------- sources

async function linesFromOSM() {
  const bbox = BBOX.join(",");
  const json = await overpass(
    `[out:json][timeout:60];way["waterway"~"^(canal|river|stream)$"](${bbox});out geom tags;`
  );
  return json.elements
    .filter((w) => w.type === "way" && w.geometry?.length > 1)
    .filter((w) => !w.tags?.tunnel) // boats don't sail culverts
    .map((w) => ({
      name: w.tags?.name,
      pts: w.geometry.map((g) => toWorld([g.lon, g.lat])),
    }));
}

function linesFromGeoJSON() {
  const gj = JSON.parse(fs.readFileSync(OVERRIDE, "utf8"));
  const lines = [];
  for (const f of gj.features ?? []) {
    const name = f.properties?.name;
    if (f.geometry?.type === "LineString") {
      lines.push({ name, pts: f.geometry.coordinates.map(toWorld) });
    } else if (f.geometry?.type === "MultiLineString") {
      for (const part of f.geometry.coordinates) {
        lines.push({ name, pts: part.map(toWorld) });
      }
    }
  }
  return lines;
}

async function fetchPOIs() {
  const bbox = BBOX.join(",");
  const pattern =
    "Praça do Peixe|Arte Nova|Centro de Congressos|Troncalhada|Humberto Delgado|Carcassonne|Ponte d|Jardim do Rossio|Fonte Nova";
  const json = await overpass(
    `[out:json][timeout:60];(node["name"~"${pattern}",i](${bbox});way["name"~"${pattern}",i](${bbox});relation["name"~"${pattern}",i](${bbox}););out center tags;`
  );
  const pois = [];
  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || !el.tags?.name) continue;
    const [x, z] = toWorld([lon, lat]);
    pois.push({ name: el.tags.name, type: el.type, x: r2(x), z: r2(z) });
  }
  return pois;
}

// ---------------------------------------------------------------- main

const useOverride = fs.existsSync(OVERRIDE);
const rawLines = useOverride ? linesFromGeoJSON() : await linesFromOSM();
console.log(`source: ${useOverride ? "local geojson override" : "OpenStreetMap"} — ${rawLines.length} raw ways`);

const lineLen = (e) =>
  e.pts.reduce(
    (acc, p, j) => (j ? acc + Math.hypot(p[0] - e.pts[j - 1][0], p[1] - e.pts[j - 1][1]) : 0),
    0
  );

/** Iteratively drop short dead-end stubs, re-merging chains in between. */
function prune(edges) {
  for (let iter = 0; iter < 5; iter++) {
    const deg = new Map();
    for (const e of edges) {
      for (const k of [snapKey(e.pts[0]), snapKey(e.pts[e.pts.length - 1])]) {
        deg.set(k, (deg.get(k) ?? 0) + 1);
      }
    }
    const next = edges.filter((e) => {
      const free =
        deg.get(snapKey(e.pts[0])) === 1 ||
        deg.get(snapKey(e.pts[e.pts.length - 1])) === 1;
      return !(free && lineLen(e) < 12);
    });
    if (next.length === edges.length) return next;
    edges = stitch(next);
  }
  return edges;
}

let edges = stitch(splitAtJunctions(clipLines(rawLines)));
edges = mainComponent(edges);
edges = prune(edges);
edges = edges
  .map((e) => ({ name: e.name, pts: simplifyDP(e.pts, SIMPLIFY).map(([x, z]) => [r2(x), r2(z)]) }))
  .filter((e) => {
    let len = 0;
    for (let i = 1; i < e.pts.length; i++) {
      len += Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]);
    }
    return len > 1.5;
  });

const pois = await fetchPOIs().catch((err) => {
  console.warn("POI fetch failed:", err.message);
  return [];
});

const endpoints = edges.flatMap((e, i) => [
  { edge: i, end: "a", x: e.pts[0][0], z: e.pts[0][1] },
  { edge: i, end: "b", x: e.pts[e.pts.length - 1][0], z: e.pts[e.pts.length - 1][1] },
]);

const out = {
  generated: new Date().toISOString(),
  source: useOverride ? "local geojson" : "OpenStreetMap (ODbL)",
  origin: ORIGIN,
  unitsPerMetre: K,
  edges,
  pois,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log(`edges: ${edges.length}`);
edges.forEach((e, i) => {
  const len = e.pts.reduce(
    (acc, p, j) => (j ? acc + Math.hypot(p[0] - e.pts[j - 1][0], p[1] - e.pts[j - 1][1]) : 0),
    0
  );
  console.log(
    `  #${i} ${e.name ?? "(unnamed)"} — ${e.pts.length} pts, len ${len.toFixed(1)}, ` +
      `a(${e.pts[0]}) b(${e.pts[e.pts.length - 1]})`
  );
});
console.log("endpoints (west of x=-15):", endpoints.filter((p) => p.x < -15).map((p) => `#${p.edge}${p.end}(${p.x},${p.z})`).join(" "));
console.log("pois:");
pois.forEach((p) => console.log(`  ${p.name} (${p.x}, ${p.z}) [${p.type}]`));
console.log(`wrote ${OUT}`);
