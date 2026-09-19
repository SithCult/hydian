// Heat layer: anonymous, aggregated cells from the Hydian server (own pings + sightings, no names/ids).
export interface HeatCell {
  cx: number;
  cz: number;
  people: number;
  days: number;
  samples: number;
  w: number;
}
export interface Heat {
  server: string;
  area: string;
  days: number;
  cell: number;
  players: number;
  minPlayers: number;
  cells: HeatCell[];
  max: number;
  canvas?: HTMLCanvasElement;
}

/** Resolution of the heat texture in map space (MAP_PX map units are the planet square). */
export const HEAT_PX = 4096;
// density -> colour: transparent → amber → orange → red → white-hot
const STOPS: [number, number, number, number, number][] = [
  [0, 255, 200, 60, 0],
  [0.12, 255, 200, 60, 0.35],
  [0.45, 255, 120, 40, 0.7],
  [0.8, 255, 50, 70, 0.85],
  [1, 255, 240, 230, 0.95],
];
function palette(d: number): [number, number, number, number] {
  let i = 1;
  while (i < STOPS.length - 1 && STOPS[i][0] < d) i++;
  const [a, ...ca] = STOPS[i - 1],
    [b, ...cb] = STOPS[i],
    t = Math.max(0, Math.min(1, (d - a) / (b - a)));
  return [
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
    ca[3] + (cb[3] - ca[3]) * t,
  ];
}
/**
 * Render the cells into one texture in map space (same square as the planet map), so the layer is drawn
 * with the map's own transform and zooms/rotates exactly like the tiles. Built once per data load.
 */
export function heatTexture(
  heat: Heat,
  worldToMap: (x: number, y: number) => [number, number],
  mpp: number,
  mapPx: number,
): HTMLCanvasElement {
  if (heat.canvas) return heat.canvas;
  const cv = document.createElement("canvas");
  cv.width = cv.height = HEAT_PX;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const k = HEAT_PX / mapPx; // map px -> texture px
  const r = Math.max(6, (heat.cell / mpp) * k * 1.5); // blob radius: 1.5 cells, in world units
  ctx.globalCompositeOperation = "lighter";
  for (const c of heat.cells) {
    const [u, v] = worldToMap((c.cx + 0.5) * heat.cell, (c.cz + 0.5) * heat.cell);
    const a = 0.25 + 0.75 * (c.w / heat.max);
    const gr = ctx.createRadialGradient(u * k, v * k, 0, u * k, v * k, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(0.35, `rgba(255,255,255,${a * 0.5})`);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(u * k, v * k, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // colourise: the accumulated white density becomes the palette
  const xs = heat.cells.map((c) => worldToMap((c.cx + 0.5) * heat.cell, (c.cz + 0.5) * heat.cell)[0] * k),
    ys = heat.cells.map((c) => worldToMap((c.cx + 0.5) * heat.cell, (c.cz + 0.5) * heat.cell)[1] * k);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - r)),
    y0 = Math.max(0, Math.floor(Math.min(...ys) - r));
  const x1 = Math.min(HEAT_PX, Math.ceil(Math.max(...xs) + r)),
    y1 = Math.min(HEAT_PX, Math.ceil(Math.max(...ys) + r));
  if (x1 > x0 && y1 > y0) {
    const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0),
      d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const dens = d[i + 3] / 255;
      if (dens <= 0.02) {
        d[i + 3] = 0;
        continue;
      }
      const [R, G, B, A] = palette(Math.min(1, dens));
      d[i] = R;
      d[i + 1] = G;
      d[i + 2] = B;
      d[i + 3] = Math.round(A * 255);
    }
    ctx.putImageData(img, x0, y0);
  }
  heat.canvas = cv;
  return cv;
}

const cache = new Map<string, { at: number; heat: Heat }>();
const TTL = 90_000;
export function clearHeatCache() {
  cache.clear();
}

export async function fetchHeat(baseUrl: string, server: string, area: string, days = 365): Promise<Heat | null> {
  if (!baseUrl) return null;
  const key = `${baseUrl}|${server}|${area}|${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.heat;
  const r = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/v1/heat?server=${encodeURIComponent(server)}&area=${encodeURIComponent(area)}&days=${days}`,
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as {
    server: string;
    area: string;
    days: number;
    cell: number;
    players?: number;
    minPlayers?: number;
    cells: [number, number, number, number, number][];
  };
  // weight: how many different people, on how many different days; not how chatty the log was
  const cells = j.cells.map(([cx, cz, people, days, samples]) => ({
    cx,
    cz,
    people,
    days,
    samples,
    w: Math.sqrt(people) * Math.log2(1 + days),
  }));
  const max = cells.reduce((m, c) => Math.max(m, c.w), 0) || 1;
  const heat: Heat = { ...j, players: j.players ?? 0, minPlayers: j.minPlayers ?? 10, cells, max };
  cache.set(key, { at: Date.now(), heat });
  return heat;
}
