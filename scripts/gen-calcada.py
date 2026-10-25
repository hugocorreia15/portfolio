#!/usr/bin/env python3
"""
Bake a tileable Portuguese pavement ("calçada portuguesa", mar-largo waves)
into public/textures/calcada_{color,normal,rough}.webp.

Irregular cubes come from a toroidal Voronoi diagram (each cell = one stone);
a stone is basalt when its centre falls inside a wave band, limestone
otherwise, so the waves follow the stones the way real calçada does.

    python3 scripts/gen-calcada.py
"""
import os

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

S = 1024  # texture size (px)
N = 34  # stones per side
WAVES_Y = 4  # wave bands per tile (vertical period S / WAVES_Y)
BAND = 0.24  # fraction of each period that is black basalt
AMP = 0.09  # wave amplitude (fraction of the tile)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")

rng = np.random.default_rng(1755)

# jittered grid of stone centres, wrapped 3x3 so the diagram tiles seamlessly
cell = S / N
gx, gy = np.meshgrid(np.arange(N), np.arange(N))
pts = np.stack(
    [
        (gx.ravel() + 0.5 + rng.uniform(-0.32, 0.32, N * N)) * cell,
        (gy.ravel() + 0.5 + rng.uniform(-0.32, 0.32, N * N)) * cell,
    ],
    axis=1,
)
offsets = [(dx * S, dy * S) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
all_pts = np.concatenate([pts + o for o in offsets])
owner = np.tile(np.arange(N * N), len(offsets))

yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
pix = np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], axis=1)
dist, idx = cKDTree(all_pts).query(pix, k=2)
stone = owner[idx[:, 0]].reshape(S, S)
f1 = dist[:, 0].reshape(S, S)
edge = (dist[:, 1] - dist[:, 0]).reshape(S, S)  # ~0 on the joints

# which stones are basalt: test the stone centre against the wave bands
cx, cy = pts[:, 0], pts[:, 1]
period = S / WAVES_Y
phase = (cy + AMP * S * np.sin(2 * np.pi * cx / S)) % period
basalt = phase < BAND * period

# per-stone tone variation
tone = rng.uniform(-1, 1, N * N)
light = np.array([230, 224, 209], np.float32)
dark = np.array([78, 78, 82], np.float32)
base = np.where(basalt[:, None], dark, light) + tone[:, None] * np.where(
    basalt[:, None], 9, 11
)
col = base[stone]

# joints: sandy grout, a soft dark rim on each stone
joint = np.clip(edge / 3.2, 0, 1)[..., None]
grout = np.array([150, 140, 118], np.float32)
col = grout * (1 - joint) + col * joint
# a little speckle on the limestone
col += rng.normal(0, 3.2, (S, S, 1))
col = np.clip(col, 0, 255).astype(np.uint8)

# height: domed stones, sunk joints → normal map via wrapped central differences
r = cell * 0.62
dome = 1 - np.clip(f1 / r, 0, 1) ** 2
height = np.clip(edge / 4.5, 0, 1) ** 0.6 * (0.55 + 0.45 * dome)
strength = 3.0
dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
nz = 1 / np.sqrt(dx * dx + dy * dy + 1)
normal = np.stack([-dx * nz, dy * nz, nz], axis=-1) * 0.5 + 0.5
normal = (normal * 255).astype(np.uint8)

# roughness: worn limestone, slightly polished basalt, rough joints
rough = np.where(basalt[stone], 0.62, 0.8) + tone[stone] * 0.05
rough = rough * joint[..., 0] + 1.0 * (1 - joint[..., 0])
rough = (np.clip(rough, 0, 1) * 255).astype(np.uint8)

Image.fromarray(col, "RGB").save(os.path.join(OUT, "calcada_color.webp"), quality=84, method=6)
Image.fromarray(normal, "RGB").save(os.path.join(OUT, "calcada_normal.webp"), quality=90, method=6)
Image.fromarray(rough, "L").save(os.path.join(OUT, "calcada_rough.webp"), quality=80, method=6)
print("baked calcada textures →", os.path.abspath(OUT))
