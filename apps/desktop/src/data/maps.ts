// Real in-game maps: the game's own map textures, one WebP per floor, with their world bounds.
// Coordinates in maps.json are GOM units; the combat log (and every Player.x/y in the
// app) uses log units = GOM * 10, with log (x, y) = GOM (x, z). Height is ignored.
import raw from "./maps.json";
import iconsRaw from "./planet-icons.json";

export type TileKind = "world" | "region" | "interior";
export interface MapTile {
  name: string;
  label: string; // display name from the game's string table
  kind: TileKind;
  id: string;
  depth: number; // 0 = planet map, 1+ = region inside its parent
  file: string; // relative to the app root (public/)
  size: [number, number];
  bounds: [number, number, number, number]; // GOM x0, x1, z0, z1
  height: [number, number];
  parent: string | null;
  phase?: boolean; // story phase / personal instance: unreachable for other players (hidden unless enabled)
}
export interface PlanetMaps {
  slug: string;
  name: string;
  folders: string[];
  maps: MapTile[];
}

const MAPS = raw as unknown as Record<string, PlanetMaps>;
const ICONS = iconsRaw as Record<string, string>;
export const SCALE = 10; // log units per GOM unit

let showPhases = false;
const filtered = new Map<string, PlanetMaps>();
/** Toggle visibility of story phases (the app re-renders via the store flag; this just changes what mapsFor returns). */
export function setShowPhases(v: boolean) {
  if (v !== showPhases) {
    showPhases = v;
    filtered.clear();
  }
}
export const mapsFor = (planetId: string | null | undefined): PlanetMaps | undefined => {
  if (!planetId || !MAPS[planetId]) return undefined;
  if (showPhases) return MAPS[planetId];
  let f = filtered.get(planetId);
  if (!f) {
    const pm = MAPS[planetId];
    f = { ...pm, maps: pm.maps.filter((t) => !t.phase) };
    filtered.set(planetId, f);
  }
  return f;
};
export const phaseCount = (planetId: string | null | undefined) =>
  planetId && MAPS[planetId] ? MAPS[planetId].maps.filter((t) => t.phase).length : 0;
export const hasRealMap = (planetId: string | null | undefined) => !!mapsFor(planetId)?.maps.length;

/** Union of all tiles, in log units: [minX, maxX, minY, maxY]. */
export function mapBounds(planetId: string | null | undefined): [number, number, number, number] | null {
  const pm = mapsFor(planetId);
  if (!pm?.maps.length) return null;
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const t of pm.maps) {
    // each tile image covers a square of side max(w,h) centred on its bounds
    const [a, b, c, d] = t.bounds;
    const side = Math.max(b - a, d - c);
    const cx = (a + b) / 2,
      cz = (c + d) / 2;
    x0 = Math.min(x0, cx - side / 2);
    x1 = Math.max(x1, cx + side / 2);
    z0 = Math.min(z0, cz - side / 2);
    z1 = Math.max(z1, cz + side / 2);
  }
  return [x0 * SCALE, x1 * SCALE, z0 * SCALE, z1 * SCALE];
}

/** Square world rect (log units) that a tile's image covers: [x, y, side]. */
export function tileRect(t: MapTile): [number, number, number] {
  const [a, b, c, d] = t.bounds;
  const side = Math.max(b - a, d - c);
  return [((a + b) / 2 - side / 2) * SCALE, ((c + d) / 2 - side / 2) * SCALE, side * SCALE];
}

const H_MARGIN = 1.5; // GOM units of slack on floor height ranges

const area = (t: MapTile) => (t.bounds[1] - t.bounds[0]) * (t.bounds[3] - t.bounds[2]);
const inXZ = (t: MapTile, gx: number, gz: number) =>
  gx >= t.bounds[0] && gx <= t.bounds[1] && gz >= t.bounds[2] && gz <= t.bounds[3];
const hFit = (t: MapTile, gh: number) =>
  gh >= t.height[0] && gh <= t.height[1] ? 0 : gh >= t.height[0] - H_MARGIN && gh <= t.height[1] + H_MARGIN ? 1 : 2;
/** Interiors, plus regions with a narrow height range (e.g. Upper/Lower Promenade), behave as floors. */
export const isFloor = (t: MapTile) => t.kind === "interior" || (t.kind === "region" && t.height[1] - t.height[0] < 15);

export interface Location {
  tile: MapTile;
  label: string;
  floor: boolean;
  path: string[];
}

/**
 * Where is a log position (x, y, z=height, all log units)? Among the maps containing the point,
 * prefer the best height fit, then the smallest footprint (floor > region > planet).
 */
export function locate(
  planetId: string | null | undefined,
  x: number,
  y: number,
  z: number | null | undefined,
): Location | null {
  const pm = mapsFor(planetId);
  if (!pm) return null;
  const gx = x / SCALE,
    gz = y / SCALE,
    gh = z == null ? null : z / SCALE;
  const hits = pm.maps.filter((t) => inXZ(t, gx, gz) && (gh == null ? !isFloor(t) : hFit(t, gh) < 2));
  if (!hits.length) return null;
  hits.sort((a, b) => (gh == null ? 0 : hFit(a, gh) - hFit(b, gh)) || area(a) - area(b));
  const t = hits[0];
  const byId = new Map(pm.maps.map((m) => [m.id, m]));
  const path: string[] = [];
  let c: MapTile | undefined = t;
  while (c) {
    path.unshift(c.label);
    c = c.parent ? byId.get(c.parent) : undefined;
  }
  if (path[0] !== pm.name && t.kind !== "world") path.unshift(pm.name);
  return { tile: t, label: t.label, floor: isFloor(t), path };
}

/** Floors that share a footprint are stacks; pick one floor per stack for drawing. */
export function floorStacks(pm: PlanetMaps): MapTile[][] {
  const groups = new Map<string, MapTile[]>();
  for (const t of pm.maps) {
    if (!isFloor(t)) continue;
    const k = t.bounds.map((v) => Math.round(v / 6)).join(",");
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  return [...groups.values()].map((g) => g.sort((a, b) => a.height[0] - b.height[0]));
}
/**
 * Levels: floors of similar size that lie on top of each other (Lower / Upper Promenade). Drawing them both
 * gives a hybrid map that matches neither level, so exactly one of a cluster is shown at a time. Rooms nested
 * inside a level (much smaller) are not peers; they belong to whichever level their height matches.
 */
export interface LevelCluster {
  key: string;
  levels: MapTile[];
  bounds: [number, number, number, number];
}
/** Connected components of items under a symmetric relation (union-find), in first-seen order. */
function components<T>(items: T[], related: (a: T, b: T) => boolean): T[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) if (related(items[i], items[j])) parent[find(i)] = find(j);
  const groups = new Map<number, T[]>();
  items.forEach((t, i) => {
    const r = find(i);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(t);
  });
  return [...groups.values()];
}
const overlaps = (a: MapTile, b: MapTile) =>
  a.bounds[0] < b.bounds[1] && b.bounds[0] < a.bounds[1] && a.bounds[2] < b.bounds[3] && b.bounds[2] < a.bounds[3];

export function levelClusters(pm: PlanetMaps): LevelCluster[] {
  const area = (t: MapTile) => (t.bounds[1] - t.bounds[0]) * (t.bounds[3] - t.bounds[2]);
  const inter = (a: MapTile, b: MapTile) =>
    Math.max(0, Math.min(a.bounds[1], b.bounds[1]) - Math.max(a.bounds[0], b.bounds[0])) *
    Math.max(0, Math.min(a.bounds[3], b.bounds[3]) - Math.max(a.bounds[2], b.bounds[2]));
  const peers = (a: MapTile, b: MapTile) => {
    const s = Math.min(area(a), area(b)),
      l = Math.max(area(a), area(b));
    return s / l >= 0.3 && inter(a, b) / s >= 0.5;
  };
  return components(pm.maps.filter(isFloor), peers)
    .filter((g) => g.length > 1)
    .map((g) => {
      const levels = g.sort((a, b) => a.height[0] - b.height[0]);
      const b: [number, number, number, number] = [
        Math.min(...levels.map((t) => t.bounds[0])),
        Math.max(...levels.map((t) => t.bounds[1])),
        Math.min(...levels.map((t) => t.bounds[2])),
        Math.max(...levels.map((t) => t.bounds[3])),
      ];
      return { key: levels.map((t) => t.id).join("+"), levels, bounds: b };
    });
}
/**
 * 3D level number per floor tile. Floors with overlapping footprints form one building; within it every
 * distinct real height is one level, numbered from the bottom (real gaps are ignored: levels are spaced evenly).
 */
export function levelIndex(pm: PlanetMaps): Map<string, number> {
  const floors = pm.maps.filter(isFloor).sort((a, b) => a.height[0] - b.height[0]);
  const idx = new Map<string, number>();
  for (const grp of components(floors, overlaps)) {
    let level = 0,
      prevH = -Infinity;
    for (const t of grp) {
      if (t.height[0] - prevH > 1.5) {
        if (prevH !== -Infinity) level++;
        prevH = t.height[0];
      }
      idx.set(t.id, level);
    }
  }
  return idx;
}
/** Does this (small) tile sit inside the level's footprint and height range? */
export const roomOfLevel = (room: MapTile, level: MapTile) =>
  room.bounds[0] >= level.bounds[0] - 1 &&
  room.bounds[1] <= level.bounds[1] + 1 &&
  room.bounds[2] >= level.bounds[2] - 1 &&
  room.bounds[3] <= level.bounds[3] + 1 &&
  room.height[0] <= level.height[1] + H_MARGIN &&
  room.height[1] >= level.height[0] - H_MARGIN;

export const pickFloor = (stack: MapTile[], gh: number | null): MapTile =>
  (gh == null ? undefined : [...stack].sort((a, b) => hFit(a, gh) - hFit(b, gh))[0]) ?? stack[0];

export const planetIcon = (slug: string): string | undefined => (ICONS[slug] ? ASSET_BASE + ICONS[slug] : undefined);
/**
 * Where the in-game artwork (maps, icons) comes from. The images are BioWare/EA assets and are not
 * part of the repo or the installer: production builds load them from the hosted static service (long-lived
 * immutable cache headers, so the WebView keeps them on disk); dev uses public/ when the artwork is there.
 * Override with VITE_ASSET_BASE (e.g. "/" to bundle, or another host for a self-hosted instance).
 */
export const ASSET_BASE: string =
  (import.meta.env.VITE_ASSET_BASE as string | undefined) ??
  (import.meta.env.DEV ? import.meta.env.BASE_URL : "https://tiles-production-d7fc.up.railway.app/");
export const assetUrl = (rel: string) => ASSET_BASE + rel;
