// Stylised planet surfaces, generated once per planet and cached: the fallback for areas without a real map.
// The coordinate contract (world metres -> map px, north up) is the same as for the real maps.
import { BIOME_PALETTES, type Planet } from "../data/planets";
import { hasRealMap } from "../data/maps";

export const MAP_PX = 900;

export interface MapGeom {
  S: number;
  mpp: number;
  cx: number;
  cy: number;
}
export function geom(p: Planet): MapGeom {
  const [x0, x1, y0, y1] = p.bounds;
  const w = x1 - x0,
    h = y1 - y0;
  return {
    S: MAP_PX,
    mpp: Math.max(w, h) / (MAP_PX * (hasRealMap(p.id) ? 1 : 0.88)),
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
  };
}
// In-game maps have min z (log y) at the TOP of the image, so v grows with y (no flip).
export const worldToMap = (g: MapGeom, x: number, y: number): [number, number] => [
  (x - g.cx) / g.mpp + g.S / 2,
  (y - g.cy) / g.mpp + g.S / 2,
];
export const mapToWorld = (g: MapGeom, u: number, v: number): [number, number] => [
  (u - g.S / 2) * g.mpp + g.cx,
  (v - g.S / 2) * g.mpp + g.cy,
];

// ------------------------------------------------------------ value noise
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const grad = (h: number, x: number, y: number) => {
    switch (h & 3) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      default:
        return -x - y;
    }
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x),
      v = fade(y);
    const a = perm[X] + Y,
      b = perm[X + 1] + Y;
    return lerp(
      lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
      lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u),
      v,
    );
  };
}
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

const cache = new Map<string, HTMLCanvasElement>();

export function planetSurface(p: Planet): HTMLCanvasElement {
  const hit = cache.get(p.slug);
  if (hit) return hit;
  const S = MAP_PX,
    pal = BIOME_PALETTES[p.biome];
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d")!;
  const noise = makeNoise(hash(p.slug));
  const img = ctx.createImageData(S, S),
    d = img.data;
  const bands = pal.bands.map(hex),
    water = hex(pal.water);
  const N = 4; // generate at quarter res, upscale
  const small = S / N;
  const elev = new Float32Array(small * small);
  const f0 = p.biome === "station" ? 3.2 : 2.4;
  for (let j = 0; j < small; j++)
    for (let i = 0; i < small; i++) {
      const x = i / small,
        y = j / small;
      let e = 0,
        amp = 1,
        f = f0,
        norm = 0;
      for (let o = 0; o < 5; o++) {
        e += noise(x * f, y * f) * amp;
        norm += amp;
        amp *= 0.5;
        f *= 2.1;
      }
      e = (e / norm) * 0.5 + 0.5;
      // soft vignette so the edge of the world fades to dark
      const dx = x - 0.5,
        dy = y - 0.5,
        rad = Math.sqrt(dx * dx + dy * dy);
      e -= Math.max(0, rad - 0.36) * 1.6;
      elev[j * small + i] = e;
    }
  const waterLevel = {
    ocean: 0.5,
    swamp: 0.42,
    jungle: 0.36,
    grass: 0.33,
    ice: 0.3,
    city: 0.28,
    desert: 0.22,
    volcanic: 0.3,
    station: 0.38,
    industrial: 0.3,
    redrock: 0.24,
  }[p.biome];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const si = (x / N) | 0,
        sj = (y / N) | 0;
      const i = sj * small + si;
      const e = elev[i];
      let c: number[];
      if (e < waterLevel) c = water;
      else {
        const t = Math.min(0.999, (e - waterLevel) / (1 - waterLevel));
        c = bands[Math.floor(t * bands.length)];
      }
      // hillshade: light from the north-west
      const ex = elev[sj * small + Math.min(small - 1, si + 1)] - elev[sj * small + Math.max(0, si - 1)];
      const ey = elev[Math.min(small - 1, sj + 1) * small + si] - elev[Math.max(0, sj - 1) * small + si];
      const shade = e < waterLevel ? 1 : Math.max(0.55, Math.min(1.35, 1 + (-ex - ey) * 6));
      // contour lines
      const k = (e * 26) % 1;
      const line = e >= waterLevel && k < 0.06 ? 0.82 : 1;
      const o = (y * S + x) * 4;
      d[o] = Math.min(255, c[0] * line * shade);
      d[o + 1] = Math.min(255, c[1] * line * shade);
      d[o + 2] = Math.min(255, c[2] * line * shade);
      d[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  // slight blur to hide the quarter-res blocks
  ctx.filter = "blur(1.2px)";
  ctx.drawImage(cv, 0, 0);
  ctx.filter = "none";

  // biome décor
  if (p.biome === "city" || p.biome === "industrial") {
    ctx.strokeStyle = pal.grid;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    const step = p.biome === "city" ? 34 : 58;
    for (let x = 40; x < S - 40; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 40 + (hash(p.slug + x) % 30));
      ctx.lineTo(x, S - 40);
      ctx.stroke();
    }
    for (let y = 40; y < S - 40; y += step) {
      ctx.beginPath();
      ctx.moveTo(40 + (hash(p.slug + y) % 30), y);
      ctx.lineTo(S - 40, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (p.biome === "station") {
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    for (let r = 60; r < S / 2; r += 70) {
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let a = 0; a < 12; a++) {
      ctx.beginPath();
      ctx.moveTo(S / 2, S / 2);
      ctx.lineTo(S / 2 + Math.cos((a * Math.PI) / 6) * S * 0.47, S / 2 + Math.sin((a * Math.PI) / 6) * S * 0.47);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // hotspots = landing zones / cantinas: soft glow + ring
  const g = geom(p);
  for (const [hx, hy] of p.hotspots) {
    const [u, v] = worldToMap(g, hx, hy);
    const rg = ctx.createRadialGradient(u, v, 0, u, v, 46);
    rg.addColorStop(0, pal.accent + "55");
    rg.addColorStop(1, pal.accent + "00");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(u, v, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.accent + "88";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(u, v, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // frame
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  cache.set(p.slug, cv);
  return cv;
}
