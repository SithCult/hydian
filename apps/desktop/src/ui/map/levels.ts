// Which level of a stacked building is shown: the view's per-cluster choice, else the focused character's
// height (2D) or every level (3D).
import {
  isFloor,
  levelClusters,
  levelIndex,
  locate,
  mapsFor,
  pickFloor,
  roomOfLevel,
  SCALE,
  type LevelCluster,
  type MapTile,
  type PlanetMaps,
} from "../../data/maps";

export interface LevelModel {
  clusters: LevelCluster[];
  clusterOf: Map<string, LevelCluster>; // level tile id -> its cluster
  floors: MapTile[]; // every floor, lowest first
  levelIdx: Map<string, number>; // 3D level number per floor
}

export function levelModel(pm: PlanetMaps | null): LevelModel {
  const clusters = pm ? levelClusters(pm) : [];
  const clusterOf = new Map<string, LevelCluster>();
  for (const c of clusters) for (const t of c.levels) clusterOf.set(t.id, c);
  return {
    clusters,
    clusterOf,
    floors: pm ? pm.maps.filter(isFloor).sort((a, b) => a.height[0] - b.height[0]) : [],
    levelIdx: pm ? levelIndex(pm) : new Map(),
  };
}

/** Which level of each cluster is shown this frame; null = every level (3D auto). */
export function activeLevels(
  m: LevelModel,
  choice: Record<string, string>,
  focus: number | null,
  allWhenAuto: boolean,
): Map<string, MapTile | null> {
  const out = new Map<string, MapTile | null>();
  for (const c of m.clusters) {
    const chosen = choice[c.key];
    out.set(
      c.key,
      chosen ? (c.levels.find((t) => t.id === chosen) ?? null) : allWhenAuto ? null : pickFloor(c.levels, focus),
    );
  }
  return out;
}

/** Hidden this frame: a non-active level, or a room that belongs to a hidden level of the cluster it sits in. */
export const hiddenBy =
  (m: LevelModel, act: Map<string, MapTile | null>) =>
  (t: MapTile): boolean => {
    const own = m.clusterOf.get(t.id);
    if (own) {
      const a = act.get(own.key);
      return a != null && a.id !== t.id;
    }
    for (const c of m.clusters) {
      const a = act.get(c.key);
      if (!a) continue;
      if (c.levels.some((l) => l.id !== a.id && roomOfLevel(t, l)) && !roomOfLevel(t, a)) return true;
    }
    return false;
  };

/** The cluster whose footprint contains a world point (log units): the smallest one, when buildings nest. */
export function clusterAt(m: LevelModel, x: number, y: number): LevelCluster | undefined {
  const gx = x / SCALE,
    gz = y / SCALE;
  const area = (c: LevelCluster) => (c.bounds[1] - c.bounds[0]) * (c.bounds[3] - c.bounds[2]);
  return m.clusters
    .filter((c) => gx >= c.bounds[0] && gx <= c.bounds[1] && gz >= c.bounds[2] && gz <= c.bounds[3])
    .sort((a, b) => area(a) - area(b))[0];
}

/** The cluster a character stands in, by the floor its height resolves to (not just its footprint). */
export function clusterOfPosition(
  m: LevelModel,
  planetId: string | null,
  x: number,
  y: number,
  z: number | null | undefined,
): LevelCluster | undefined {
  const loc = locate(planetId, x, y, z);
  if (!loc) return undefined;
  // a room inside a level belongs to that level's cluster
  const byId = new Map((mapsFor(planetId)?.maps ?? []).map((t) => [t.id, t]));
  for (let t: MapTile | undefined = loc.tile; t; t = t.parent ? byId.get(t.parent) : undefined) {
    const c = m.clusterOf.get(t.id);
    if (c) return c;
  }
  return undefined;
}
