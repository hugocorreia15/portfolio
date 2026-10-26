#!/usr/bin/env python3
"""
Bake the tileable noise the sky's cloud layer is drawn from
(public/textures/clouds.webp, also sampled by the water for cloud reflections).

    R  large-scale fBm (gradient noise) — where the cloud banks are
    G  fine fBm — erodes the edges into wisps
    B  inverted cellular noise — round, cumulus-like puffs

Every channel wraps seamlessly, so the shader can tile it across the sky.

    python3 scripts/gen-clouds.py
"""
import os

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

S = 512
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures", "clouds.webp")

rng = np.random.default_rng(90210)


def fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def perlin(freq):
    """Periodic 2D gradient noise on an S×S grid, roughly in [-0.7, 0.7]."""
    ang = rng.random((freq, freq)) * 2 * np.pi
    gx, gy = np.cos(ang), np.sin(ang)
    c = np.arange(S) * freq / S
    i0 = np.floor(c).astype(int)
    f = c - i0
    i1 = (i0 + 1) % freq
    fy, fx = f[:, None], f[None, :]

    def corner(iy, ix, dy, dx):
        return gx[np.ix_(iy, ix)] * dx + gy[np.ix_(iy, ix)] * dy

    n00 = corner(i0, i0, fy, fx)
    n01 = corner(i0, i1, fy, fx - 1)
    n10 = corner(i1, i0, fy - 1, fx)
    n11 = corner(i1, i1, fy - 1, fx - 1)
    ux, uy = fade(fx), fade(fy)
    return (n00 * (1 - ux) + n01 * ux) * (1 - uy) + (n10 * (1 - ux) + n11 * ux) * uy


def fbm(base, octaves, gain=0.5):
    total = np.zeros((S, S))
    amp, norm, f = 1.0, 0.0, base
    for _ in range(octaves):
        total += amp * perlin(f)
        norm += amp
        amp *= gain
        f *= 2
    return total / norm


def cellular(cells):
    """Periodic distance to the nearest feature point, inverted: 1 at puff centres."""
    pts = rng.random((cells * cells, 2)) * S
    tiled = np.concatenate([pts + np.array([dx, dy]) * S for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    yy, xx = np.mgrid[0:S, 0:S]
    d, _ = cKDTree(tiled).query(np.stack([xx.ravel(), yy.ravel()], axis=1))
    d = d.reshape(S, S) / (S / cells)
    return 1 - np.clip(d, 0, 1)


def normalise(a):
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return np.clip((a - lo) / (hi - lo), 0, 1)


r = normalise(fbm(4, 6))
g = normalise(fbm(16, 4))
b = normalise(0.7 * cellular(10) + 0.3 * cellular(22))

img = (np.stack([r, g, b], axis=-1) * 255).round().astype(np.uint8)
Image.fromarray(img, "RGB").save(OUT, "WEBP", quality=92, method=6)
print("wrote", os.path.relpath(OUT), os.path.getsize(OUT) // 1024, "KB")
