import * as THREE from "three";

/**
 * Procedural tileable textures drawn on canvas — no downloads, no licensing.
 * All patterns are near-white so the material `color` tints them; darker
 * pixels become shading/joints in whatever hue the mesh uses.
 */

export type TextureKind =
  | "plaster"
  | "roofTiles"
  | "brick"
  | "wood"
  | "calcada"
  | "sand";

const cache = new Map<string, THREE.Texture>();

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 144665) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
}

function draw(kind: TextureKind, ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, s, s);

  if (kind === "plaster" || kind === "sand") {
    const grain = kind === "sand" ? 5 : 3;
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const v = hash(x, y, 7) * grain + hash(x >> 4, y >> 4, 11) * grain;
        ctx.fillStyle = `rgba(90,80,60,${(v / 100).toFixed(3)})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    if (kind === "plaster") {
      for (let i = 0; i < 9; i++) {
        const x = hash(i, 3, 5) * s;
        ctx.strokeStyle = "rgba(120,110,90,0.05)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (hash(i, 9, 5) - 0.5) * 40, s);
        ctx.stroke();
      }
    }
  } else if (kind === "roofTiles") {
    const rows = 8;
    const cols = 8;
    const rh = s / rows;
    const cw = s / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw / 2);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, r * rh, s, 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + off;
        const shade = 0.06 + hash(c + 9, r, 3) * 0.12;
        ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + cw / 2, r * rh + rh, cw / 2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(x + 2, r * rh + 3, cw - 4, 2);
      }
    }
  } else if (kind === "brick") {
    const rows = 12;
    const bh = s / rows;
    const bw = bh * 2.3;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw / 2);
      for (let c = -1; c < s / bw + 1; c++) {
        const shade = hash(c + 31, r, 17) * 0.16;
        ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
        ctx.fillRect(c * bw + off + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      }
      ctx.fillStyle = "rgba(255,252,245,0.55)";
      ctx.fillRect(0, r * bh, s, 1.5);
      for (let c = -1; c < s / bw + 1; c++) {
        ctx.fillRect(c * bw + off, r * bh, 1.5, bh);
      }
    }
  } else if (kind === "wood") {
    const planks = 6;
    const pw = s / planks;
    for (let p = 0; p < planks; p++) {
      const tone = hash(p, 1, 23) * 0.14;
      ctx.fillStyle = `rgba(40,25,10,${tone.toFixed(3)})`;
      ctx.fillRect(p * pw, 0, pw, s);
      ctx.fillStyle = "rgba(30,18,8,0.35)";
      ctx.fillRect(p * pw, 0, 2, s);
      for (let g = 0; g < 7; g++) {
        const x = p * pw + 3 + hash(p, g, 41) * (pw - 6);
        ctx.strokeStyle = `rgba(60,40,18,${(0.06 + hash(g, p, 43) * 0.1).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 4, s * 0.3, x - 4, s * 0.7, x, s);
        ctx.stroke();
      }
    }
  } else if (kind === "calcada") {
    const n = 18;
    const cs = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = 0.04 + hash(x, y, 57) * 0.16;
        ctx.fillStyle = `rgba(40,40,50,${v.toFixed(3)})`;
        const j = (hash(x, y, 61) - 0.5) * 2;
        ctx.beginPath();
        ctx.roundRect(x * cs + 1 + j, y * cs + 1 + j, cs - 2, cs - 2, 2.5);
        ctx.fill();
      }
    }
  }
}

/** Shared tileable texture; `rx`/`ry` clones share the same bitmap. */
export function getTexture(kind: TextureKind, rx = 1, ry = 1): THREE.Texture {
  const key = `${kind}:${rx}:${ry}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const baseKey = `${kind}:1:1`;
  let base = cache.get(baseKey);
  if (!base) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    draw(kind, canvas.getContext("2d")!, 256);
    base = new THREE.CanvasTexture(canvas);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.colorSpace = THREE.SRGBColorSpace;
    base.anisotropy = 4;
    cache.set(baseKey, base);
  }
  if (rx === 1 && ry === 1) return base;

  const clone = base.clone();
  clone.repeat.set(rx, ry);
  clone.needsUpdate = true;
  cache.set(key, clone);
  return clone;
}
