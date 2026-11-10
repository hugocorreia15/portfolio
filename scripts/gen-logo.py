#!/usr/bin/env python3
"""
Bake the hfc signature monogram (the site's logo) into SVG.

The strokes are centrelines traced from a hand sketch: a cursive "h" and "f"
inside a large calligraphic C, whose lower stroke cuts through them and runs
out into a long rising flourish. A pointed-pen model gives them weight — thick on the way down,
hairline on the way up, tapering at both ends — then the ink is painted at
high resolution and traced back into a clean vector outline (OpenCV
contours, smoothed into cubic Béziers).

    python3 scripts/gen-logo.py

Writes public/logo.svg (the full signature), public/logo-mark.svg (heavier,
with a shorter flourish, for small sizes such as the site header) and
app/icon.svg (the favicon: the monogram on a tile, so it holds up at 16 px).
"""
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
INK = "#16324a"
TILE = "#1e4f8f"
CREAM = "#faf5e9"

# centrelines, in the sketch's pixel space (y down), in pen order
C = [  # a ball at the upper terminal, over the top, down the back, and the
       # lower stroke cutting through the letters and away as the flourish
    (652, 178), (659, 152), (650, 126), (628, 108), (595, 100), (550, 103), (500, 116),
    (452, 138), (408, 168), (370, 205), (338, 248), (315, 295), (302, 343), (300, 386),
    (312, 422), (340, 445), (384, 451), (432, 443), (480, 426), (530, 403), (584, 373),
    (648, 336), (720, 297), (800, 257), (880, 219), (960, 183), (1040, 149),
]
H = [  # off the stem, up and over the ascender loop, down the stem, the arch, the join
    (441, 372), (452, 350), (462, 323), (469, 288), (471, 245), (467, 207), (458, 185),
    (448, 176), (437, 185), (431, 215), (430, 260), (432, 302), (436, 342), (439, 377),
    (440, 404), (443, 384), (452, 365), (464, 357), (476, 363), (482, 379), (486, 396),
    (495, 406), (509, 409), (523, 404), (537, 392),
]
F = [  # up into the loop, down the long stem, round the lower loop, a small tie
       # that runs on into the "c": up to its hook, round its back and away
    (537, 392), (549, 360), (563, 319), (573, 275), (577, 231), (574, 196), (564, 180),
    (551, 181), (539, 197), (531, 224), (527, 264), (526, 310), (528, 355), (530, 400),
    (532, 442), (536, 470), (546, 487), (559, 484), (572, 467), (583, 443), (588, 418),
    (584, 397), (571, 386), (556, 387), (543, 396), (537, 406), (548, 411), (566, 407),
    (586, 397), (604, 380), (618, 365), (628, 357), (630, 350), (623, 348), (612, 354),
    (603, 367), (598, 383), (600, 398), (609, 408), (623, 410), (637, 404), (650, 394),
]


def catmull(points, step=0.5):
    """Centripetal Catmull-Rom through the points, resampled every `step` units."""
    p = np.array(points, float)
    p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        t0 = 0.0
        t1 = t0 + np.linalg.norm(p1 - p0) ** 0.5
        t2 = t1 + np.linalg.norm(p2 - p1) ** 0.5
        t3 = t2 + np.linalg.norm(p3 - p2) ** 0.5
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for t in np.linspace(t1, t2, n, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(p[-2])
    return np.array(out)


def smooth(path, sigma):
    """Gaussian-smooth a polyline (ends pinned) so the hand tremor goes."""
    if sigma <= 0:
        return path
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2)
    k /= k.sum()
    pad = len(k) // 2
    padded = np.vstack([np.repeat(path[:1], pad, 0), path, np.repeat(path[-1:], pad, 0)])
    return np.stack([np.convolve(padded[:, c], k, mode="valid") for c in (0, 1)], 1)


def pen(path, wmin, wmax, taper_in, taper_out, ball=0.0):
    """Pointed pen: weight on the downstrokes, hairlines up, tapered ends, and
    optionally a ball terminal (a swelling `ball` wide where the pen lands)."""
    d = np.gradient(path, axis=0)
    d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
    down = np.clip(d[:, 1], 0, 1) ** 1.3
    w = wmin + (wmax - wmin) * down
    w = smooth(np.stack([w, w], 1), 10)[:, 0]
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
    ease = lambda x: x * x * (3 - 2 * x)
    w *= 0.3 + 0.7 * ease(np.clip(s / taper_in, 0, 1))
    w *= 0.12 + 0.88 * ease(np.clip((s[-1] - s) / taper_out, 0, 1))
    if ball:
        w = np.maximum(w, ball * np.exp(-((s / (ball * 0.55)) ** 2)))
    return w


def ink(strokes, box, scale):
    """Paint the strokes (as runs of overlapping discs) into a binary image."""
    x0, y0, x1, y1 = box
    img = np.zeros((int((y1 - y0) * scale), int((x1 - x0) * scale)), np.uint8)
    for path, w in strokes:
        for (x, y), r in zip(path, w / 2):
            c = (int(round((x - x0) * scale * 16)), int(round((y - y0) * scale * 16)))
            cv2.circle(img, c, max(1, int(round(r * scale * 16))), 255, -1, cv2.LINE_8, shift=4)
    return img


def to_path(img, box, scale, tol=0.12, digits=1):
    """Trace the ink back to SVG: contours (holes included), simplified to within
    `tol` design units and smoothed into Béziers."""
    x0, y0 = box[0], box[1]
    contours, _ = cv2.findContours(img, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in contours:
        pts = c[:, 0, :].astype(float)
        if len(pts) < 12:
            continue
        # light closed-curve smoothing, then keep only the points that matter
        k = np.exp(-0.5 * (np.arange(-6, 7) / 2.5) ** 2)
        k /= k.sum()
        wrap = np.vstack([pts[-6:], pts, pts[:6]])
        pts = np.stack([np.convolve(wrap[:, i], k, mode="valid") for i in (0, 1)], 1)
        simple = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), tol * scale, True)[:, 0, :]
        if len(simple) < 3:
            continue
        p = simple / scale + np.array([x0, y0])
        n = len(p)
        f = lambda v: f"{v:.{digits}f}".rstrip("0").rstrip(".")
        seg = [f"M{f(p[0][0])} {f(p[0][1])}"]
        for i in range(n):  # closed Catmull-Rom -> cubic Bézier
            a, b, c2, d2 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
            c1 = b + (c2 - a) / 6
            c3 = c2 - (d2 - b) / 6
            seg.append(f"C{f(c1[0])} {f(c1[1])} {f(c3[0])} {f(c3[1])} {f(c2[0])} {f(c2[1])}")
        parts.append("".join(seg) + "Z")
    return "".join(parts)


def strokes(weights, cut=None):
    """The three pen strokes; `cut` ends the C's flourish at that x."""
    out = []
    for points, (wmin, wmax, tin, tout, ball) in zip((C, H, F), weights):
        path = smooth(catmull(points), 3)
        if cut is not None and points is C:
            path = path[path[:, 0] <= cut] if path[-1, 0] > cut else path
        out.append((path, pen(path, wmin, wmax, tin, tout, ball)))
    return out


def write(path, svg):
    with open(os.path.join(ROOT, path), "w") as f:
        f.write(svg)
    print("wrote", path, len(svg) // 1024, "KB")


if __name__ == "__main__":
    # the full signature: fine hairlines, the flourish fading to a point
    box = (282, 88, 1052, 508)
    s = strokes([(1.5, 10.5, 1, 220, 13), (1.4, 8.0, 10, 12, 0), (1.4, 8.0, 10, 14, 0)])
    d = to_path(ink(s, box, 8), box, 8, tol=0.12)
    w, h = box[2] - box[0], box[3] - box[1]
    write(
        "public/logo.svg",
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box[0]} {box[1]} {w} {h}" '
        f'role="img" aria-label="Hugo Correia"><path fill="{INK}" fill-rule="evenodd" d="{d}"/></svg>\n',
    )

    # the favicon: the monogram on a tile, heavy enough for a browser tab
    box = (262, 78, 702, 518)
    s = strokes([(7, 19, 1, 50, 30), (6.5, 15, 10, 12, 0), (6.5, 15, 10, 14, 0)], cut=box[2] + 20)
    d = to_path(ink(s, box, 6), box, 6, tol=0.35)
    side = box[2] - box[0]
    tile = f'x="{box[0]}" y="{box[1]}" width="{side}" height="{side}" rx="{side * 0.22:.0f}"'
    write(
        "app/icon.svg",
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box[0]} {box[1]} {side} {side}">'
        f'<rect {tile} fill="{TILE}"/><path fill="{CREAM}" fill-rule="evenodd" d="{d}"/></svg>\n',
    )

    # the mark for small sizes (the site header, ~4–5 rem tall): the favicon's
    # weights so the hairlines survive, no tile, the flourish tapering out early
    box = (262, 78, 872, 518)
    s = strokes([(6, 17, 1, 150, 28), (5.5, 13, 10, 12, 0), (5.5, 13, 10, 14, 0)], cut=860)
    d = to_path(ink(s, box, 6), box, 6, tol=0.3)
    w, h = box[2] - box[0], box[3] - box[1]
    write(
        "public/logo-mark.svg",
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box[0]} {box[1]} {w} {h}" '
        f'role="img" aria-label="Hugo Correia"><path fill="{INK}" fill-rule="evenodd" d="{d}"/></svg>\n',
    )
