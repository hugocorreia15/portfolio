#!/usr/bin/env python3
"""
Bake the real Aveiro city centre from OpenStreetMap (© OSM contributors, ODbL)
into data/aveiro-city.json + public/textures/aveiro-ground.webp.

  - water: the real canal, lake and salt-pan polygons, plus a minimum
    navigable width along the canal centrelines of data/aveiro-canals.json
    (the moliceiro is bigger than life, so narrow canals are widened a little)
    and a stylised open ria in the west, where Costa Nova and the Barra sit
    much closer than in reality;
  - land: the complement, traced into polygons with holes (the runtime
    triangulates them) — their outlines are also the quay walls;
  - ground: streets, squares, gardens and pavements painted from OSM;
  - buildings: real footprints with levels, a facade style chosen by
    neighbourhood, and an oriented box for a hipped roof when one fits;
  - lamps along the quays and trees from OSM tree nodes and parks.

Overpass responses are cached in assets-src/osm/ (delete to refresh).

    python3 scripts/bake-aveiro.py
"""
import json
import math
import os
import urllib.parse
import urllib.request

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE = os.path.join(ROOT, "assets-src", "osm")
OUT_JSON = os.path.join(ROOT, "data", "aveiro-city.json")
OUT_NET = os.path.join(ROOT, "data", "aveiro-network.json")
OUT_GROUND = os.path.join(ROOT, "public", "textures", "aveiro-ground.webp")
CANALS = os.path.join(ROOT, "data", "aveiro-canals.json")

K = 0.3  # world units per metre
O_LAT, O_LON = 40.6406, -8.6538  # Praça General Humberto Delgado
M_LAT = 111320.0
M_LON = M_LAT * math.cos(math.radians(O_LAT))

X0, Z0, X1, Z1 = -420.0, -300.0, 330.0, 220.0  # baked region (world units)
RES = 0.25  # world units per mask pixel
GROUND_RES = 0.4  # world units per ground-texture pixel
NAV_HALF = 4.0  # minimum half-width of a navigable canal
SIMPLIFY = 0.3  # contour simplification tolerance (world units)

W = int((X1 - X0) / RES)
H = int((Z1 - Z0) / RES)
rng = np.random.default_rng(2026)


def to_world(lat, lon):
    return ((lon - O_LON) * M_LON * K, -(lat - O_LAT) * M_LAT * K)


def to_px(x, z, res=RES):
    return ((x - X0) / res, (z - Z0) / res)


# ── Overpass ────────────────────────────────────────────────────────────────

LAT_MIN = O_LAT - Z1 / (M_LAT * K)
LAT_MAX = O_LAT - Z0 / (M_LAT * K)
LON_MIN = O_LON + X0 / (M_LON * K)
LON_MAX = O_LON + X1 / (M_LON * K)
BBOX = f"{LAT_MIN:.5f},{LON_MIN:.5f},{LAT_MAX:.5f},{LON_MAX:.5f}"

QUERIES = {
    "water": f"""[out:json][timeout:120];(
      way["natural"="water"]({BBOX}); relation["natural"="water"]({BBOX});
      way["waterway"="riverbank"]({BBOX}); way["landuse"="salt_pond"]({BBOX});
    );out body;>;out skel qt;""",
    "city": f"""[out:json][timeout:180];(
      way["building"]({BBOX}); way["highway"]({BBOX});
      way["leisure"~"park|garden|pitch|playground"]({BBOX});
      way["landuse"~"grass|meadow|recreation_ground|cemetery"]({BBOX});
      way["place"="square"]({BBOX}); way["area:highway"]({BBOX});
      way["amenity"="parking"]({BBOX}); way["railway"="rail"]({BBOX});
      node["natural"="tree"]({BBOX});
    );out body;>;out skel qt;""",
}


def overpass(name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{name}.json")
    if not os.path.exists(path):
        print(f"fetching {name} from Overpass…")
        req = urllib.request.Request(
            "https://overpass-api.de/api/interpreter",
            data=urllib.parse.urlencode({"data": QUERIES[name]}).encode(),
            headers={"User-Agent": "aveiro-portfolio-map-bake/1.0 (personal portfolio)"},
        )
        with urllib.request.urlopen(req, timeout=300) as res:
            open(path, "wb").write(res.read())
    return json.load(open(path))


water_osm = overpass("water")
city_osm = overpass("city")

nodes = {}
ways = {}
for d in (water_osm, city_osm):
    for e in d["elements"]:
        if e["type"] == "node":
            nodes[e["id"]] = (e["lat"], e["lon"], e.get("tags"))
        elif e["type"] == "way":
            ways.setdefault(e["id"], e)
            if "tags" in e:
                ways[e["id"]] = e


def way_pts(w):
    return [to_world(nodes[n][0], nodes[n][1]) for n in w["nodes"] if n in nodes]


def join_rings(member_ways):
    """Chain open ways sharing endpoints into closed rings."""
    segs = [list(w["nodes"]) for w in member_ways if len(w.get("nodes", [])) > 1]
    rings = []
    while segs:
        ring = segs.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[::-1][1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) > 3:
            rings.append([to_world(nodes[n][0], nodes[n][1]) for n in ring if n in nodes])
    return rings


def area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return a / 2


def fill(mask, pts, value, res=RES):
    if len(pts) < 3:
        return
    p = np.array([to_px(x, z, res) for x, z in pts], np.float32)
    cv2.fillPoly(mask, [np.round(p * 4).astype(np.int32)], value, shift=2)


# ── water mask ──────────────────────────────────────────────────────────────

water = np.zeros((H, W), np.uint8)
for e in water_osm["elements"]:
    if e["type"] == "way" and "tags" in e and e["nodes"][0] == e["nodes"][-1]:
        fill(water, way_pts(e), 255)
for e in water_osm["elements"]:
    if e["type"] != "relation":
        continue
    by_role = {"outer": [], "inner": []}
    for m in e["members"]:
        if m["type"] == "way" and m["ref"] in ways:
            by_role.setdefault(m["role"] or "outer", []).append(ways[m["ref"]])
    for ring in join_rings(by_role["outer"]):
        fill(water, ring, 255)
    for ring in join_rings(by_role["inner"]):
        fill(water, ring, 0)

# the canal network (centrelines are baked at another scale)
canals = json.load(open(CANALS))
cs = K / canals["unitsPerMetre"]
edges = [{"name": e.get("name"), "pts": [[x * cs, z * cs] for x, z in e["pts"]]} for e in canals["edges"]]
pois = [{"name": p["name"], "x": p["x"] * cs, "z": p["z"] * cs} for p in canals["pois"]]

nav = np.zeros_like(water)
for e in edges:
    p = np.array([to_px(x, z) for x, z in e["pts"]], np.float32)
    thick = int(round(2 * NAV_HALF / RES))
    cv2.polylines(nav, [np.round(p * 4).astype(np.int32)], False, 255, thick, cv2.LINE_8, shift=2)
    for x, y in p:
        cv2.circle(nav, (int(round(x)), int(round(y))), thick // 2, 255, -1)

# stylised open ria to the west, with the Costa Nova and Barra spits in it
RIA = [(-420, -300), (-300, -300), (-268, -210), (-300, -60), (-292, 40), (-262, 120), (-300, 220), (-420, 220)]
COSTA_NOVA = [(-420, 20), (-372, 10), (-356, 30), (-360, 70), (-376, 110), (-420, 130)]
BARRA = [(-420, -190), (-388, -186), (-366, -168), (-360, -146), (-372, -126), (-420, -120)]
ria = np.zeros_like(water)
fill(ria, RIA, 255)
fill(ria, COSTA_NOVA, 0)
fill(ria, BARRA, 0)

water = cv2.bitwise_or(water, nav)
water = cv2.bitwise_or(water, ria)
fill(water, COSTA_NOVA, 0)  # the spits stay dry whatever OSM maps under them
fill(water, BARRA, 0)
k3 = np.ones((3, 3), np.uint8)
water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, k3)
water = cv2.morphologyEx(water, cv2.MORPH_OPEN, k3)
land = cv2.bitwise_not(water)

# ── land polygons (= quay outlines) ─────────────────────────────────────────


def px_to_world(c):
    return [[round(X0 + (x + 0.5) * RES, 2), round(Z0 + (y + 0.5) * RES, 2)] for x, y in c]


contours, hier = cv2.findContours(land, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
land_polys = []
eps = SIMPLIFY / RES
for i, c in enumerate(contours):
    if hier[0][i][3] != -1:
        continue  # holes are collected with their parent
    if cv2.contourArea(c) * RES * RES < 6:
        continue
    outer = px_to_world(cv2.approxPolyDP(c, eps, True)[:, 0, :])
    holes = []
    child = hier[0][i][2]
    while child != -1:
        hc = contours[child]
        if cv2.contourArea(hc) * RES * RES >= 3:
            holes.append(px_to_world(cv2.approxPolyDP(hc, eps, True)[:, 0, :]))
        child = hier[0][child][0]
    land_polys.append({"outer": outer, "holes": holes})
print(f"land: {len(land_polys)} polygons, {sum(len(p['holes']) for p in land_polys)} holes")

# ── ground texture ──────────────────────────────────────────────────────────

GW, GH = int((X1 - X0) / GROUND_RES), int((Z1 - Z0) / GROUND_RES)
ground = Image.new("RGB", (GW, GH), (205, 196, 176))
gd = ImageDraw.Draw(ground)


def gpts(pts):
    return [to_px(x, z, GROUND_RES) for x, z in pts]


def gpoly(pts, color):
    if len(pts) > 2:
        gd.polygon(gpts(pts), fill=color)


ROAD_W = {  # metres
    "motorway": 14, "trunk": 12, "primary": 11, "secondary": 9.5, "tertiary": 8,
    "residential": 6.5, "unclassified": 6, "living_street": 5, "service": 4.2,
    "motorway_link": 7, "primary_link": 7, "secondary_link": 6, "tertiary_link": 6,
    "pedestrian": 6, "footway": 2.6, "cycleway": 2.4, "path": 1.6, "steps": 2.4, "track": 3,
}
ASPHALT = (118, 116, 112)
CALCADA = (226, 219, 203)
GREEN = (150, 178, 112)
PAVED = (196, 188, 170)

for e in city_osm["elements"]:
    if e["type"] != "way" or "tags" not in e:
        continue
    t = e["tags"]
    pts = way_pts(e)
    if t.get("leisure") in ("park", "garden", "playground") or t.get("landuse") in (
        "grass", "meadow", "recreation_ground", "cemetery"
    ):
        gpoly(pts, GREEN if t.get("landuse") != "cemetery" else (170, 175, 140))
    elif t.get("leisure") == "pitch":
        gpoly(pts, (122, 160, 98))
    elif t.get("amenity") == "parking":
        gpoly(pts, (150, 146, 140))
for e in city_osm["elements"]:
    if e["type"] != "way" or "tags" not in e:
        continue
    t = e["tags"]
    pts = way_pts(e)
    closed = e["nodes"][0] == e["nodes"][-1]
    if t.get("place") == "square" or t.get("area:highway") or (t.get("highway") == "pedestrian" and t.get("area") == "yes"):
        gpoly(pts, CALCADA)
    elif "highway" in t and t["highway"] in ROAD_W and len(pts) > 1:
        hw = t["highway"]
        width = max(1, int(round(ROAD_W[hw] * K / GROUND_RES)))
        color = ASPHALT if hw not in ("pedestrian", "footway", "steps", "path", "cycleway") else CALCADA
        if hw == "cycleway":
            color = (168, 112, 96)
        if t.get("area") == "yes" and closed:
            gpoly(pts, color)
        else:
            gd.line(gpts(pts), fill=color, width=width, joint="curve")
    elif t.get("railway") == "rail" and len(pts) > 1:
        gd.line(gpts(pts), fill=(120, 108, 96), width=max(1, int(4 * K / GROUND_RES)))

# the stylised Costa Nova and Barra spits are dunes
gpoly(COSTA_NOVA, (226, 210, 172))
gpoly(BARRA, (226, 210, 172))

# pavement along every quay: a light stone band where the land meets the water
quay = np.array(ground)
edge = cv2.resize(water, (GW, GH), interpolation=cv2.INTER_NEAREST)
band = cv2.dilate(edge, np.ones((5, 5), np.uint8)) & ~edge
quay[band > 0] = (232, 226, 212)
ground = Image.fromarray(quay)
noise = (rng.normal(0, 5, (GH, GW, 1))).astype(np.int16)
ground = Image.fromarray(np.clip(np.array(ground, np.int16) + noise, 0, 255).astype(np.uint8))
ground = ground.filter(ImageFilter.GaussianBlur(0.5))
ground.save(OUT_GROUND, quality=82, method=6)
print(f"ground: {GW}x{GH} → {os.path.relpath(OUT_GROUND, ROOT)}")

# ── buildings ───────────────────────────────────────────────────────────────

# zones by distance to particular canals (world units)
def dist_to_edges(x, z, names):
    best = 1e9
    for e in edges:
        if not any(n in (e["name"] or "") for n in names):
            continue
        p = e["pts"]
        for (ax, az), (bx, bz) in zip(p, p[1:]):
            dx, dz = bx - ax, bz - az
            l2 = dx * dx + dz * dz or 1e-6
            t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / l2))
            best = min(best, math.hypot(x - ax - dx * t, z - az - dz * t))
    return best


nav_dilated = cv2.dilate(nav, np.ones((9, 9), np.uint8))
occupied = np.zeros_like(water)  # footprints kept so far (overlapping duplicates z-fight)
buildings = []
skipped = 0
candidates = [
    e for e in city_osm["elements"] if e["type"] == "way" and "tags" in e and "building" in e["tags"]
]
# big footprints first, so a duplicate outline inside one is the one dropped
candidates.sort(key=lambda e: -abs(area(way_pts(e))) if len(e["nodes"]) > 3 else 0)
for e in candidates:
    t = e["tags"]
    if t["building"] in ("roof", "ruins", "construction") or e["nodes"][0] != e["nodes"][-1]:
        continue
    pts = way_pts(e)[:-1]
    if len(pts) < 3:
        continue
    a = area(pts)
    if abs(a) < 3:
        continue
    if a < 0:
        pts = pts[::-1]  # counter-clockwise in (x, z)
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    if min(xs) < X0 + 2 or max(xs) > X1 - 2 or min(zs) < Z0 + 2 or max(zs) > Z1 - 2:
        continue
    # drop footprints the widened canals (or the water) run through
    probe = np.zeros_like(water)
    fill(probe, pts, 255)
    inside = probe > 0
    n_in = int(inside.sum()) or 1
    if (water[inside] > 0).sum() / n_in > 0.12 or (nav_dilated[inside] > 0).sum() / n_in > 0.05:
        skipped += 1
        continue
    if (occupied[inside] > 0).sum() / n_in > 0.3:
        continue
    occupied[inside] = 255

    cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
    kind = t["building"]
    r = rng.random()
    if "building:levels" in t:
        try:
            floors = max(1, min(14, int(float(t["building:levels"].split(";")[0]))))
        except ValueError:
            floors = 2
    elif kind in ("apartments",):
        floors = 4 + int(r * 3)
    elif kind in ("industrial", "warehouse", "garages", "garage", "shed", "service", "kiosk"):
        floors = 1
    elif kind in ("church", "cathedral", "chapel"):
        floors = 3
    else:
        floors = 2 + int(r * 2)

    big = abs(a) > 160  # ~1800 m²
    near_central = dist_to_edges(cx, cz, ["Côjo", "Pirâmides"]) < 40 and cx < 60
    near_sroque = dist_to_edges(cx, cz, ["São Roque"]) < 30
    s = rng.random()
    if kind in ("industrial", "warehouse") or (near_sroque and floors <= 2 and s < 0.6):
        style = "armazem"
    elif kind in ("university", "school", "college", "hospital", "civic", "public") or (big and floors >= 3):
        style = "moderno"
    elif near_central:
        style = "artenova" if s < 0.4 else ("azulejo" if s < 0.65 else "ribeira")
    else:
        style = "ribeira" if s < 0.62 else ("azulejo" if s < 0.82 else ("moderno" if floors >= 4 else "artenova"))

    b = {"p": [[round(x, 2), round(z, 2)] for x, z in pts], "f": floors, "s": style}
    (rcx, rcz), (rw, rd), ang = cv2.minAreaRect(np.array(pts, np.float32))
    if style not in ("moderno",) and rw * rd > 0 and abs(a) / (rw * rd) > 0.82 and max(rw, rd) < 40:
        b["r"] = [round(rcx, 2), round(rcz, 2), round(rw, 2), round(rd, 2), round(math.radians(ang), 4)]
    buildings.append(b)
print(f"buildings: {len(buildings)} kept, {skipped} dropped by the canals")

# ── street lamps along the canal quays, trees ───────────────────────────────

blocked = np.zeros_like(water)
for b in buildings:
    fill(blocked, b["p"], 255)
blocked = cv2.dilate(blocked, np.ones((5, 5), np.uint8))
lamps = []
quay_edge = cv2.dilate(nav, np.ones((3, 3), np.uint8))
for e in edges:
    for side in (1, -1):
        pts = e["pts"]
        acc = 6.0
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            seg = math.hypot(bx - ax, bz - az)
            nx, nz = -(bz - az) / seg * side, (bx - ax) / seg * side
            while acc < seg:
                x = ax + (bx - ax) * acc / seg
                z = az + (bz - az) * acc / seg
                # walk out from the centreline until we reach dry land
                for off in np.arange(NAV_HALF, NAV_HALF + 14, 0.5):
                    px, pz = to_px(x + nx * off, z + nz * off)
                    ix, iz = int(px), int(pz)
                    if not (0 <= ix < W and 0 <= iz < H):
                        break
                    if water[iz, ix] == 0:
                        lx, lz = x + nx * (off + 1.0), z + nz * (off + 1.0)
                        jx, jz = [int(v) for v in to_px(lx, lz)]
                        if 0 <= jx < W and 0 <= jz < H and water[jz, jx] == 0 and blocked[jz, jx] == 0:
                            if all(math.hypot(lx - l[0], lz - l[1]) > 8 for l in lamps):
                                lamps.append([round(lx, 2), round(lz, 2)])
                        break
                acc += 13.0
            acc -= seg

trees = []
for e in city_osm["elements"]:
    if e["type"] == "node" and (e.get("tags") or {}).get("natural") == "tree":
        x, z = to_world(e["lat"], e["lon"])
        px, pz = [int(v) for v in to_px(x, z)]
        if 0 <= px < W and 0 <= pz < H and water[pz, px] == 0 and blocked[pz, px] == 0:
            trees.append([round(x, 2), round(z, 2)])
# parks without mapped trees get a scatter
park = np.zeros_like(water)
for e in city_osm["elements"]:
    if e["type"] == "way" and "tags" in e and e["tags"].get("leisure") in ("park", "garden"):
        fill(park, way_pts(e), 255)
park[(water > 0) | (blocked > 0)] = 0
ys, xs = np.nonzero(park[::24, ::24])
for y, x in zip(ys, xs):
    if rng.random() < 0.55:
        wx = X0 + (x * 24 + rng.uniform(0, 20)) * RES
        wz = Z0 + (y * 24 + rng.uniform(0, 20)) * RES
        trees.append([round(wx, 2), round(wz, 2)])
print(f"lamps: {len(lamps)}, trees: {len(trees)}")

network = {
    "source": "OpenStreetMap contributors (ODbL)",
    "unitsPerMetre": K,
    "origin": {"lat": O_LAT, "lon": O_LON},
    "region": [X0, Z0, X1, Z1],
    "edges": [{"name": e["name"], "pts": [[round(x, 2), round(z, 2)] for x, z in e["pts"]]} for e in edges],
    "pois": [{"name": p["name"], "x": round(p["x"], 2), "z": round(p["z"], 2)} for p in pois],
}
json.dump(network, open(OUT_NET, "w"), indent=1)
out = {
    "source": "OpenStreetMap contributors (ODbL)",
    "region": [X0, Z0, X1, Z1],
    "land": land_polys,
    "buildings": buildings,
    "lamps": lamps,
    "trees": trees,
}
json.dump(out, open(OUT_JSON, "w"), separators=(",", ":"))
print(f"→ {os.path.relpath(OUT_JSON, ROOT)} ({os.path.getsize(OUT_JSON) // 1024} KB)")

# debug preview (not shipped)
dbg = cv2.cvtColor(land, cv2.COLOR_GRAY2BGR)
dbg[water > 0] = (200, 160, 110)
for b in buildings:
    p = np.array([to_px(x, z) for x, z in b["p"]], np.int32)
    cv2.fillPoly(dbg, [p], (90, 110, 170))
for e in edges:
    p = np.array([to_px(x, z) for x, z in e["pts"]], np.int32)
    cv2.polylines(dbg, [p], False, (40, 40, 220), 2)
for x, z in lamps:
    cv2.circle(dbg, [int(v) for v in to_px(x, z)], 3, (0, 200, 255), -1)
cv2.imwrite(os.path.join(CACHE, "preview.png"), cv2.resize(dbg, (W // 2, H // 2)))
