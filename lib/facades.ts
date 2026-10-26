import * as THREE from "three";

/**
 * Facade atlases for the instanced buildings, painted on canvas.
 *
 * Each style is a strip of three square cells — an upper-floor bay, a ground
 * bay with a door and a ground bay with a window or shop front — that the
 * building shader tiles across every wall (see components/three/buildings.tsx).
 * Two textures per style:
 *   - colour: what the wall looks like (tintable areas are painted white);
 *   - mask:   R = glazing (lit at night, glossy), G = tintable wall,
 *             B = soft halo around the glazing (the glow a lit window
 *                 throws on the wall around it);
 *   - relief: height, 0.5 = the wall plane — glass and doors sit back, frames,
 *             sills and cornices stand out (the shader marches into it for
 *             parallax and tilts the light with it).
 */

export type FacadeStyle =
  | "ribeira" // pastel plaster, open shutters — the canal-side houses
  | "azulejo" // tiled facade, the tile pattern takes the tint
  | "artenova" // Art Nouveau: tall arched windows, iron balconies, cornices
  | "armazem" // salt warehouse: white lime, small high windows, big doors
  | "palheiro" // Costa Nova: vertical stripes
  | "tijolo" // red brick with strip windows (university, factory)
  | "moderno"; // 20th-century blocks: white render, ribbon windows, shop fronts

export const CELLS = 3;
const S = 256; // px per cell

/** `h`: relief height (0.5 = wall plane); by default glass sits back, walls
 *  are flush and anything else (frames, trim) stands slightly proud. */
type Paint = { color: string | CanvasGradient; glass?: boolean; tint?: boolean; h?: number };

const grey = (h: number) => {
  const v = Math.round(THREE.MathUtils.clamp(h, 0, 1) * 255);
  return `rgb(${v},${v},${v})`;
};

class Painter {
  readonly color: CanvasRenderingContext2D;
  readonly mask: CanvasRenderingContext2D;
  readonly relief: CanvasRenderingContext2D;
  constructor(color: CanvasRenderingContext2D, mask: CanvasRenderingContext2D, relief: CanvasRenderingContext2D) {
    this.color = color;
    this.mask = mask;
    this.relief = relief;
  }
  private maskStyle(p: Paint) {
    return `rgb(${p.glass ? 255 : 0}, ${p.tint ? 255 : 0}, 0)`;
  }
  private height(p: Paint) {
    return grey(p.h ?? (p.glass ? 0.08 : p.tint ? 0.5 : 0.72));
  }
  rect(x: number, y: number, w: number, h: number, p: Paint) {
    for (const [ctx, style] of [
      [this.color, p.color],
      [this.mask, this.maskStyle(p)],
      [this.relief, this.height(p)],
    ] as const) {
      ctx.fillStyle = style;
      ctx.fillRect(x * S, y * S, w * S, h * S);
    }
  }
  /** rectangle with a semicircular top */
  arch(x: number, y: number, w: number, h: number, p: Paint) {
    for (const [ctx, style] of [
      [this.color, p.color],
      [this.mask, this.maskStyle(p)],
      [this.relief, this.height(p)],
    ] as const) {
      ctx.fillStyle = style;
      ctx.beginPath();
      const r = (w * S) / 2;
      ctx.moveTo(x * S, (y + h) * S);
      ctx.lineTo(x * S, y * S + r);
      ctx.arc(x * S + r, y * S + r, r, Math.PI, 0);
      ctx.lineTo((x + w) * S, (y + h) * S);
      ctx.closePath();
      ctx.fill();
    }
  }
  /** colour-only detail (no mask change) */
  line(x0: number, y0: number, x1: number, y1: number, color: string, width: number) {
    this.color.strokeStyle = color;
    this.color.lineWidth = width;
    this.color.beginPath();
    this.color.moveTo(x0 * S, y0 * S);
    this.color.lineTo(x1 * S, y1 * S);
    this.color.stroke();
  }
  /** a glazing bar: drawn over the glass, cut out of its glow, standing proud of it */
  bar(x0: number, y0: number, x1: number, y1: number, color: string, width: number, h = 0.6) {
    this.line(x0, y0, x1, y1, color, width);
    for (const [ctx, style] of [
      [this.mask, "#000"],
      [this.relief, grey(h)],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0 * S, y0 * S);
      ctx.lineTo(x1 * S, y1 * S);
      ctx.stroke();
    }
  }
  /** relief only: a joint pressed into the wall (mortar, tile and board joints) */
  groove(x0: number, y0: number, x1: number, y1: number, width: number, h = 0.42) {
    this.relief.strokeStyle = grey(h);
    this.relief.lineWidth = width;
    this.relief.beginPath();
    this.relief.moveTo(x0 * S, y0 * S);
    this.relief.lineTo(x1 * S, y1 * S);
    this.relief.stroke();
  }
}

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
}

const TRIM = "#f3eee3";
const STONE = "#bdb5a6";
const WOOD = "#6b4a30";

function glass(p: Painter, x: number, y: number, w: number, h: number, arched = false) {
  const g = p.color.createLinearGradient(0, y * S, 0, (y + h) * S);
  g.addColorStop(0, "#5a7584");
  g.addColorStop(0.55, "#2c3f4c");
  g.addColorStop(1, "#22303a");
  const paint = { color: g, glass: true };
  if (arched) p.arch(x, y, w, h, paint);
  else p.rect(x, y, w, h, paint);
}

/** A framed window with mullions; `frame` widens the surround. */
function windowAt(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { arched?: boolean; frame?: number; trim?: string; bars?: number } = {}
) {
  const f = opts.frame ?? 0.035;
  const trim = opts.trim ?? TRIM;
  if (opts.arched) p.arch(x - f, y - f, w + 2 * f, h + 2 * f, { color: trim });
  else p.rect(x - f, y - f, w + 2 * f, h + 2 * f, { color: trim });
  glass(p, x, y, w, h, opts.arched);
  // mullions
  const r = opts.arched ? w / 2 : 0;
  p.bar(x + w / 2, y + r * 0.6, x + w / 2, y + h, trim, 4);
  for (let i = 1; i <= (opts.bars ?? 1); i++) {
    const yy = y + r + ((h - r) * i) / ((opts.bars ?? 1) + 1);
    p.bar(x, yy, x + w, yy, trim, 4);
  }
  // sill
  p.rect(x - f * 1.6, y + h + f * 0.4, w + f * 3.2, 0.03, { color: trim, h: 0.9 });
}

function shutters(p: Painter, x: number, y: number, w: number, h: number, color: string) {
  for (const sx of [x - 0.13, x + w + 0.03]) {
    p.rect(sx, y, 0.1, h, { color, h: 0.62 });
    for (let k = 1; k < 9; k++) p.line(sx, y + (h * k) / 9, sx + 0.1, y + (h * k) / 9, "rgba(0,0,0,0.25)", 1.5);
  }
}

function door(p: Painter, x: number, w: number, top: number, bottom: number, arched = false) {
  const trim = TRIM;
  if (arched) p.arch(x - 0.04, top - 0.04, w + 0.08, bottom - top + 0.04, { color: trim });
  else p.rect(x - 0.04, top - 0.04, w + 0.08, bottom - top + 0.04, { color: trim });
  // transom light
  const tH = arched ? w / 2 + 0.04 : 0.1;
  glass(p, x, top, w, tH, arched);
  p.rect(x, top + tH + 0.015, w, bottom - top - tH - 0.015, { color: WOOD, h: 0.3 });
  p.line(x + w / 2, top + tH + 0.02, x + w / 2, bottom, "rgba(0,0,0,0.35)", 2);
  for (const yy of [0.35, 0.7]) {
    const py = top + tH + (bottom - top - tH) * yy;
    p.line(x + 0.03, py, x + w - 0.03, py, "rgba(0,0,0,0.2)", 2);
  }
}

function plaster(p: Painter, seed: number) {
  p.rect(0, 0, 1, 1, { color: "#ffffff", tint: true });
  for (let i = 0; i < 260; i++) {
    const a = hash(i, seed);
    p.color.fillStyle = `rgba(80,70,55,${(0.02 + hash(seed, i) * 0.05).toFixed(3)})`;
    p.color.fillRect(a * S, hash(i * 3, seed) * S, 2 + hash(i, 7) * 5, 2 + hash(7, i) * 5);
  }
}

function azulejo(p: Painter) {
  const n = 6;
  const t = 1 / n;
  p.rect(0, 0, 1, 1, { color: "#f7f5ef", h: 0.5 });
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = (i + 0.5) * t;
      const cy = (j + 0.5) * t;
      // four-petal motif, painted white so the instance tint colours it
      for (const [ctx, style] of [
        [p.color, "#ffffff"],
        [p.mask, "rgb(0,255,0)"],
      ] as const) {
        ctx.fillStyle = style;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          ctx.ellipse(
            (cx + Math.cos(a) * t * 0.22) * S,
            (cy + Math.sin(a) * t * 0.22) * S,
            t * 0.18 * S,
            t * 0.09 * S,
            a,
            0,
            Math.PI * 2
          );
        }
        ctx.fill();
        ctx.beginPath();
        // corner quarter-circles join into rings across tiles
        for (const [qx, qy] of [
          [i * t, j * t],
          [(i + 1) * t, j * t],
          [i * t, (j + 1) * t],
          [(i + 1) * t, (j + 1) * t],
        ]) {
          ctx.moveTo(qx * S + t * 0.16 * S, qy * S);
          ctx.arc(qx * S, qy * S, t * 0.16 * S, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      // tile joints
      p.line(i * t, 0, i * t, 1, "rgba(120,120,120,0.35)", 1);
      p.line(0, j * t, 1, j * t, "rgba(120,120,120,0.35)", 1);
      p.groove(i * t, 0, i * t, 1, 2, 0.45);
      p.groove(0, j * t, 1, j * t, 2, 0.45);
    }
  }
}

function brick(p: Painter, seed: number) {
  p.rect(0, 0, 1, 1, { color: "#b4583e", h: 0.44 });
  const rows = 22;
  const bh = 1 / rows;
  const bw = bh * 2.2;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let c = -1; c < 1 / bw + 1; c++) {
      const k = hash(c + seed * 31, r);
      const tone = 150 + k * 50;
      p.color.fillStyle = `rgb(${tone | 0}, ${(tone * 0.42) | 0}, ${(tone * 0.3) | 0})`;
      p.color.fillRect((c * bw + off) * S + 1, r * bh * S + 1, bw * S - 2, bh * S - 2);
      p.relief.fillStyle = grey(0.5);
      p.relief.fillRect((c * bw + off) * S + 1, r * bh * S + 1, bw * S - 2, bh * S - 2);
    }
  }
}

function stripes(p: Painter) {
  const n = 4;
  for (let i = 0; i < n; i++) {
    p.rect(i / n, 0, 1 / n, 1, i % 2 === 0 ? { color: "#ffffff", tint: true } : { color: "#f8f5ee", h: 0.5 });
    p.line(i / n, 0, i / n, 1, "rgba(0,0,0,0.18)", 2);
    p.groove(i / n, 0, i / n, 1, 3);
  }
}

function cornice(p: Painter) {
  p.rect(0, 0, 1, 0.07, { color: TRIM, h: 0.88 });
  p.line(0, 0.07, 1, 0.07, "rgba(0,0,0,0.25)", 3);
}

function plinth(p: Painter) {
  p.rect(0, 0.9, 1, 0.1, { color: STONE, h: 0.62 });
  p.line(0, 0.9, 1, 0.9, "rgba(0,0,0,0.25)", 2);
}

/** cell 0 = upper floor, 1 = ground with door, 2 = ground with window/shop */
function paintCell(p: Painter, style: FacadeStyle, cell: number) {
  const ground = cell > 0;
  switch (style) {
    case "ribeira":
      plaster(p, cell + 1);
      if (!ground) {
        windowAt(p, 0.32, 0.2, 0.36, 0.52);
        shutters(p, 0.32, 0.2, 0.36, 0.52, "#2f5d50");
      } else if (cell === 1) door(p, 0.33, 0.34, 0.2, 0.9);
      else windowAt(p, 0.32, 0.26, 0.36, 0.44);
      if (ground) plinth(p);
      break;
    case "azulejo":
      azulejo(p);
      if (!ground) windowAt(p, 0.31, 0.18, 0.38, 0.54, { frame: 0.05 });
      else if (cell === 1) door(p, 0.32, 0.36, 0.16, 0.9);
      else windowAt(p, 0.31, 0.22, 0.38, 0.48, { frame: 0.05 });
      if (ground) plinth(p);
      break;
    case "artenova":
      plaster(p, cell + 11);
      cornice(p);
      if (!ground) {
        windowAt(p, 0.33, 0.16, 0.34, 0.62, { arched: true, frame: 0.045, bars: 2 });
        // wrought-iron balcony
        p.rect(0.2, 0.8, 0.6, 0.035, { color: TRIM, h: 0.95 });
        for (let k = 0; k <= 12; k++) p.bar(0.22 + k * 0.047, 0.66, 0.22 + k * 0.047, 0.8, "#23262b", 2.5, 0.9);
        p.bar(0.21, 0.66, 0.79, 0.66, "#23262b", 3, 0.92);
        p.bar(0.25, 0.73, 0.75, 0.73, "#23262b", 2, 0.9);
      } else if (cell === 1) door(p, 0.32, 0.36, 0.14, 0.9, true);
      else {
        // shop front
        p.rect(0.1, 0.16, 0.8, 0.7, { color: "#3f4a3a" });
        glass(p, 0.15, 0.2, 0.7, 0.58);
        p.bar(0.5, 0.2, 0.5, 0.78, "#3f4a3a", 5);
      }
      if (ground) plinth(p);
      break;
    case "armazem":
      plaster(p, cell + 21);
      if (!ground) windowAt(p, 0.4, 0.22, 0.2, 0.22, { frame: 0.03 });
      else if (cell === 1) {
        p.rect(0.18, 0.28, 0.64, 0.62, { color: "#d9d2c3", h: 0.64 });
        p.rect(0.22, 0.32, 0.56, 0.58, { color: "#7a5b3d", h: 0.3 });
        for (let k = 1; k < 7; k++) p.line(0.22 + k * 0.08, 0.32, 0.22 + k * 0.08, 0.9, "rgba(0,0,0,0.3)", 2);
      } else windowAt(p, 0.4, 0.26, 0.2, 0.22, { frame: 0.03 });
      p.rect(0, 0.93, 1, 0.07, { color: STONE, h: 0.62 });
      break;
    case "palheiro":
      stripes(p);
      if (!ground) windowAt(p, 0.33, 0.24, 0.34, 0.42, { trim: "#ffffff" });
      else if (cell === 1) door(p, 0.34, 0.32, 0.22, 0.94);
      else windowAt(p, 0.33, 0.3, 0.34, 0.4, { trim: "#ffffff" });
      break;
    case "moderno":
      plaster(p, cell + 31);
      if (!ground) {
        p.rect(0, 0.24, 1, 0.5, { color: "#d8d4cc", h: 0.6 });
        glass(p, 0.03, 0.27, 0.94, 0.42);
        for (const x of [0.03, 0.5, 0.97]) p.bar(x, 0.27, x, 0.69, "#d8d4cc", 6);
        p.rect(0, 0.74, 1, 0.04, { color: "#c9c4ba", h: 0.9 });
      } else if (cell === 1) {
        p.rect(0.08, 0.14, 0.84, 0.86, { color: "#4a4a48" });
        glass(p, 0.12, 0.18, 0.76, 0.82);
        p.bar(0.5, 0.18, 0.5, 1, "#4a4a48", 6);
      } else {
        p.rect(0.04, 0.16, 0.92, 0.7, { color: "#4a4a48" });
        glass(p, 0.08, 0.2, 0.84, 0.62);
      }
      break;
    case "tijolo":
      brick(p, cell);
      if (!ground) {
        p.rect(0, 0.26, 1, 0.48, { color: "#e8e2d6", h: 0.62 });
        glass(p, 0.04, 0.3, 0.92, 0.4);
        for (const x of [0.04, 0.27, 0.5, 0.73, 0.96]) p.bar(x, 0.3, x, 0.7, "#e8e2d6", 5);
      } else if (cell === 1) {
        p.rect(0.12, 0.2, 0.76, 0.8, { color: "#e8e2d6" });
        glass(p, 0.16, 0.24, 0.68, 0.76);
        p.bar(0.5, 0.24, 0.5, 1, "#e8e2d6", 5);
      } else {
        p.rect(0, 0.3, 1, 0.42, { color: "#e8e2d6", h: 0.62 });
        glass(p, 0.04, 0.34, 0.92, 0.34);
        for (const x of [0.04, 0.35, 0.65, 0.96]) p.bar(x, 0.34, x, 0.68, "#e8e2d6", 5);
      }
      break;
  }
}

/** Running-sum box blur of one S-tall strip of cells, clamped to each cell. */
function blurCells(a: Float32Array, R: number, passes: number) {
  const W = S * CELLS;
  const b = new Float32Array(a.length);
  const n = 2 * R + 1;
  const clamp = (v: number) => Math.min(S - 1, Math.max(0, v));
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < S; y++) {
      for (let c = 0; c < CELLS; c++) {
        const row = y * W + c * S;
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += a[row + clamp(k)];
        for (let x = 0; x < S; x++) {
          b[row + x] = sum / n;
          sum += a[row + clamp(x + R + 1)] - a[row + clamp(x - R)];
        }
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let k = -R; k <= R; k++) sum += b[clamp(k) * W + x];
      for (let y = 0; y < S; y++) {
        a[y * W + x] = sum / n;
        sum += b[clamp(y + R + 1) * W + x] - b[clamp(y - R) * W + x];
      }
    }
  }
  return a;
}

/** Read channel `ch` of a canvas as floats, blur it, write it into channel `into`. */
function blurChannel(ctx: CanvasRenderingContext2D, ch: number, into: number, R: number, passes: number, gain = 1, shiftDown = 0) {
  const W = S * CELLS;
  const img = ctx.getImageData(0, 0, W, S);
  const d = img.data;
  const a = new Float32Array(W * S);
  for (let i = 0; i < W * S; i++) a[i] = d[i * 4 + ch] / 255;
  blurCells(a, R, passes);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < W; x++) {
      const v = a[Math.max(0, y - shiftDown) * W + x];
      d[(y * W + x) * 4 + into] = Math.min(255, Math.round(v * gain * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
}

const atlasCache = new Map<
  FacadeStyle,
  { map: THREE.CanvasTexture; mask: THREE.CanvasTexture; relief: THREE.CanvasTexture }
>();

export function getFacadeAtlas(style: FacadeStyle) {
  let hit = atlasCache.get(style);
  if (hit) return hit;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = S * CELLS;
    c.height = S;
    return c;
  };
  const colorCanvas = mk();
  const maskCanvas = mk();
  const reliefCanvas = mk();
  const cctx = colorCanvas.getContext("2d")!;
  const mctx = maskCanvas.getContext("2d")!;
  const rctx = reliefCanvas.getContext("2d", { willReadFrequently: true })!;
  for (let cell = 0; cell < CELLS; cell++) {
    for (const ctx of [cctx, mctx, rctx]) {
      ctx.save();
      ctx.translate(cell * S, 0);
      ctx.beginPath();
      ctx.rect(0, 0, S, S);
      ctx.clip();
    }
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, S, S);
    rctx.fillStyle = "rgb(128,128,128)";
    rctx.fillRect(0, 0, S, S);
    paintCell(new Painter(cctx, mctx, rctx), style, cell);
    for (const ctx of [cctx, mctx, rctx]) ctx.restore();
  }
  // the glow a lit window spills on its frame, sill and the wall below:
  // the glazing (R) blurred into B, nudged down a little
  blurChannel(mctx, 0, 2, 9, 3, 1.6, 6);
  // soften the relief's steps into small bevels, so edges catch the light
  blurChannel(rctx, 0, 0, 2, 2);
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mask = new THREE.CanvasTexture(maskCanvas);
  mask.anisotropy = 8;
  const relief = new THREE.CanvasTexture(reliefCanvas);
  relief.anisotropy = 8;
  hit = { map, mask, relief };
  atlasCache.set(style, hit);
  return hit;
}
