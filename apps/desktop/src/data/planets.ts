// Planet registry. `id` = the AreaEntered area id the game writes to the combat log. `bounds` =
// [minX, maxX, minY, maxY] world metres, the fallback for planets without a real map; where maps.json has
// the game's own map bounds, those win.

import { mapBounds, mapsFor, SCALE } from "./maps";

export type Biome =
  | "city"
  | "desert"
  | "ice"
  | "jungle"
  | "grass"
  | "swamp"
  | "ocean"
  | "volcanic"
  | "station"
  | "industrial"
  | "redrock";
export type Category = "Fleets & Hubs" | "Capitals" | "Origin Worlds" | "Core Worlds" | "Outer Rim" | "Frontier";

export interface Planet {
  id: string | null; // null = id not yet observed in logs
  slug: string;
  name: string;
  category: Category;
  biome: Biome;
  bounds: [number, number, number, number];
  faction?: "imp" | "rep"; // faction-locked world (or the Imperial/Republic version of a split planet)
  hotspots: [number, number][]; // world coords of landmarks (cantinas, spaceports) drawn on procedural maps
}

const P = (
  id: string | null,
  slug: string,
  name: string,
  category: Category,
  biome: Biome,
  bounds: [number, number, number, number],
  hotspots: [number, number][] = [],
  faction?: "imp" | "rep",
): Planet => ({ id, slug, name, category, biome, bounds, hotspots, faction });

export const PLANETS: Planet[] = [
  // ---- hubs
  P(
    "137438989504",
    "imperial-fleet",
    "Imperial Fleet",
    "Fleets & Hubs",
    "station",
    [-7200, 7200, -7200, 7200],
    [
      [-4400, -4500],
      [-4300, -4300],
      [4800, 4900],
      [-4550, -4650],
    ],
    "imp",
  ),
  P(
    "137438989514",
    "republic-fleet",
    "Republic Fleet",
    "Fleets & Hubs",
    "station",
    [-7200, 7200, -7200, 7200],
    [
      [-4800, -4700],
      [-4700, -4900],
      [-6600, -6700],
    ],
    "rep",
  ),
  P(
    "833571547775726",
    "odessen",
    "Odessen",
    "Fleets & Hubs",
    "station",
    [-900, 500, -300, 900],
    [
      [-300, 220],
      [-420, 120],
    ],
  ),
  // ---- capitals
  P(
    "137438987726",
    "coruscant",
    "Coruscant",
    "Capitals",
    "city",
    [-4300, 3000, -5200, 1800],
    [
      [-3400, -4200],
      [2100, 900],
      [-900, -1300],
    ],
    "rep",
  ),
  P(
    "137438954928",
    "dromund-kaas",
    "Dromund Kaas",
    "Capitals",
    "jungle",
    [-2300, 1200, -1100, 2100],
    [
      [-1900, -700],
      [400, 1500],
      [-200, 300],
    ],
    "imp",
  ),
  // ---- origin
  P(
    "137438953533",
    "tython",
    "Tython",
    "Origin Worlds",
    "grass",
    [-1600, 1600, -1600, 1600],
    [
      [-200, -450],
      [600, 300],
    ],
    "rep",
  ),
  P(
    "137438953622",
    "korriban",
    "Korriban",
    "Origin Worlds",
    "redrock",
    [-700, 1250, -700, 800],
    [
      [-300, -400],
      [800, 400],
    ],
    "imp",
  ),
  P(
    "137438954894",
    "ord-mantell",
    "Ord Mantell",
    "Origin Worlds",
    "grass",
    [-1100, 1200, -900, 900],
    [
      [-700, -500],
      [600, 300],
    ],
    "rep",
  ),
  P(
    "137438988437",
    "hutta",
    "Hutta",
    "Origin Worlds",
    "swamp",
    [-1500, 1200, -900, 1500],
    [
      [-550, 330],
      [-100, 900],
    ],
    "imp",
  ),
  // ---- core
  P(
    "137438987583",
    "alderaan",
    "Alderaan",
    "Core Worlds",
    "grass",
    [-2900, 2300, -2900, 2000],
    [
      [-2400, -2300],
      [1500, 1200],
      [-300, -800],
    ],
  ),
  // Balmorra and Taris exist twice: the Imperial and Republic versions are different maps and players can't meet across them.
  P(
    "137438955045",
    "balmorra-imp",
    "Balmorra",
    "Core Worlds",
    "industrial",
    [-2100, 2200, -500, 2300],
    [
      [-1700, 200],
      [1500, 1900],
    ],
    "imp",
  ),
  P(
    "137438986584",
    "balmorra-rep",
    "Balmorra",
    "Core Worlds",
    "industrial",
    [-2100, 2200, -500, 2300],
    [
      [-1700, 200],
      [1500, 1900],
    ],
    "rep",
  ),
  P(
    "137438986532",
    "taris-rep",
    "Taris",
    "Core Worlds",
    "industrial",
    [-1500, 1000, -300, 1100],
    [
      [-1100, 100],
      [600, 700],
    ],
    "rep",
  ),
  P(
    "137438987374",
    "taris-imp",
    "Taris",
    "Core Worlds",
    "industrial",
    [-1500, 1000, -300, 1100],
    [
      [-1100, 100],
      [600, 700],
    ],
    "imp",
  ),
  P(
    "137438986595",
    "corellia",
    "Corellia",
    "Core Worlds",
    "city",
    [-3000, 3000, -3000, 3000],
    [
      [-1200, 800],
      [900, -1500],
    ],
  ),
  P("833571547775706", "manaan", "Manaan", "Core Worlds", "ocean", [800, 1800, -500, 600], [[1320, 20]]),
  // ---- outer rim
  P(
    "137438987989",
    "nar-shaddaa",
    "Nar Shaddaa",
    "Outer Rim",
    "city",
    [-4300, 3300, -3500, 4000],
    [
      [-944, -785],
      [-3700, 3200],
      [2500, -2600],
      [1100, 1400],
    ],
  ),
  P(
    "137438987025",
    "tatooine",
    "Tatooine",
    "Outer Rim",
    "desert",
    [-1900, 1900, -1300, 3900],
    [
      [-1400, 3200],
      [1200, -600],
      [-200, 1200],
    ],
  ),
  P(
    "137438987388",
    "hoth",
    "Hoth",
    "Outer Rim",
    "ice",
    [-2900, 1300, -200, 1800],
    [
      [-2500, 100],
      [700, 1300],
    ],
  ),
  P(
    "137438987150",
    "belsavis",
    "Belsavis",
    "Outer Rim",
    "jungle",
    [-1700, 2900, -3600, 1900],
    [
      [-1200, 1400],
      [2200, -2800],
    ],
  ),
  P(
    "137438987149",
    "voss",
    "Voss",
    "Outer Rim",
    "grass",
    [-2600, 1200, -2600, 900],
    [
      [-2200, -2100],
      [700, 400],
    ],
  ),
  P("137438987570", "quesh", "Quesh", "Outer Rim", "swamp", [200, 1500, -400, 700], [[850, 110]]),
  P(
    "137438955315",
    "ilum",
    "Ilum",
    "Outer Rim",
    "ice",
    [-2600, 1300, -1800, 1500],
    [
      [-2100, -1300],
      [800, 1000],
    ],
  ),
  P(
    "833571547775701",
    "makeb",
    "Makeb",
    "Outer Rim",
    "industrial",
    [-4100, 4900, -4600, 3500],
    [
      [-3500, -4000],
      [4200, 2800],
    ],
  ),
  P(
    "833571547775718",
    "rishi",
    "Rishi",
    "Outer Rim",
    "ocean",
    [-1100, 1300, -2500, 900],
    [
      [-700, -2100],
      [900, 400],
    ],
  ),
  P(
    "833571547775717",
    "yavin-4",
    "Yavin 4",
    "Outer Rim",
    "jungle",
    [-700, 3700, -600, 800],
    [
      [-300, -200],
      [3300, 400],
    ],
  ),
  P(
    "833571547775722",
    "ziost",
    "Ziost",
    "Outer Rim",
    "volcanic",
    [-2300, 2300, -900, 1200],
    [
      [-1800, -500],
      [1900, 800],
    ],
  ),
  P(
    "833571547775749",
    "iokath",
    "Iokath",
    "Outer Rim",
    "industrial",
    [-700, 1100, -700, 2200],
    [
      [-400, -300],
      [800, 1900],
    ],
  ),
  P(
    "833571547775785",
    "ossus",
    "Ossus",
    "Outer Rim",
    "desert",
    [-900, 5600, -4800, 900],
    [
      [-500, 400],
      [5000, -4300],
    ],
  ),
  P(
    "833571547775786",
    "dantooine",
    "Dantooine",
    "Outer Rim",
    "grass",
    [-1200, 700, -200, 2900],
    [
      [-900, 200],
      [300, 2500],
    ],
  ),
  P("137438992608", "black-hole", "The Black Hole", "Outer Rim", "industrial", [-400, 300, 0, 550], [[-100, 250]]),
  P("137438992756", "section-x", "Section X", "Outer Rim", "jungle", [500, 1600, -2300, -1100], [[1000, -1700]]),
  // ---- frontier (7.x)
  P(
    "945872057669595",
    "onderon",
    "Onderon",
    "Frontier",
    "jungle",
    [-1100, 1000, -1250, 600],
    [
      [-640, 55],
      [700, -900],
    ],
  ),
  P(
    "945872057669597",
    "mek-sha",
    "Mek-Sha",
    "Frontier",
    "station",
    [-400, 1100, -100, 4400],
    [
      [-100, 200],
      [700, 3900],
    ],
  ),
  P(
    "945872057669636",
    "ruhnuk",
    "Ruhnuk",
    "Frontier",
    "redrock",
    [-1900, 1200, -1700, 1100],
    [
      [-1500, -1300],
      [900, 700],
    ],
  ),
  P(
    "137438993357",
    "oricon",
    "Oricon",
    "Frontier",
    "volcanic",
    [-900, 1400, -300, 500],
    [
      [-500, 100],
      [1000, 200],
    ],
  ),
  P(
    "833571547775804",
    "kessans-landing",
    "Kessan's Landing",
    "Frontier",
    "grass",
    [-700, 500, -600, 500],
    [
      [-300, -200],
      [200, 300],
    ],
  ),
  P("833571547775805", "copero", "Copero", "Frontier", "ice", [-200, 400, -250, 150], [[80, -40]]),
];

// Replace hand-derived bounds with the real map extents where we have them, and use the
// centres of the largest region maps (cities, hubs) as demo hotspots.
for (const p of PLANETS) {
  const b = mapBounds(p.id);
  if (!b) continue;
  p.bounds = b;
  const regions = (mapsFor(p.id)?.maps ?? [])
    .filter((t) => t.depth >= 1)
    .sort(
      (a, c) =>
        (c.bounds[1] - c.bounds[0]) * (c.bounds[3] - c.bounds[2]) -
        (a.bounds[1] - a.bounds[0]) * (a.bounds[3] - a.bounds[2]),
    );
  if (regions.length)
    p.hotspots = regions
      .slice(0, 4)
      .map((t) => [((t.bounds[0] + t.bounds[1]) / 2) * SCALE, ((t.bounds[2] + t.bounds[3]) / 2) * SCALE]);
  else p.hotspots = [[(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]];
}

export const CATEGORIES: Category[] = [
  "Fleets & Hubs",
  "Capitals",
  "Origin Worlds",
  "Core Worlds",
  "Outer Rim",
  "Frontier",
];

export const planetById = (id: string | null | undefined) => (id ? PLANETS.find((p) => p.id === id) : undefined);
export const planetBySlug = (slug: string) => PLANETS.find((p) => p.slug === slug);
/** Match a log area to a planet: by id first, then by name (ids for some worlds not observed yet). */
export const planetForArea = (area: { id: string; name: string } | null | undefined) =>
  area ? (planetById(area.id) ?? PLANETS.find((p) => p.name.toLowerCase() === area.name.toLowerCase())) : undefined;

export const BIOME_PALETTES: Record<Biome, { bands: string[]; water: string; accent: string; grid: string }> = {
  city: {
    bands: ["#151a24", "#1c2330", "#242d3c", "#2d3748", "#38445a"],
    water: "#0f131b",
    accent: "#7dd3fc",
    grid: "#3b4a63",
  },
  desert: {
    bands: ["#3a2a1a", "#5a4326", "#7a5b33", "#9a7742", "#b8955a"],
    water: "#2a3a44",
    accent: "#fbbf24",
    grid: "#6a5236",
  },
  ice: {
    bands: ["#1a2a3a", "#2a4258", "#3f5e7a", "#6b8aa6", "#a9c2d8"],
    water: "#122030",
    accent: "#bae6fd",
    grid: "#4a6a86",
  },
  jungle: {
    bands: ["#0f1f16", "#173222", "#1f452d", "#2c5c39", "#3f7347"],
    water: "#0b1a2a",
    accent: "#86efac",
    grid: "#2c5c39",
  },
  grass: {
    bands: ["#1a2a1c", "#263d28", "#355235", "#4a6b43", "#6b8a55"],
    water: "#1a3550",
    accent: "#bef264",
    grid: "#4a6b43",
  },
  swamp: {
    bands: ["#1a1f14", "#2b3320", "#3c472c", "#525c38", "#6a7346"],
    water: "#232b1e",
    accent: "#a3e635",
    grid: "#525c38",
  },
  ocean: {
    bands: ["#0d2a3e", "#12405a", "#1b5a78", "#2f7a98", "#d9c9a0"],
    water: "#0a2233",
    accent: "#67e8f9",
    grid: "#2f7a98",
  },
  volcanic: {
    bands: ["#1c1414", "#2c1c1a", "#3e2622", "#55302a", "#6e3a2e"],
    water: "#3a1108",
    accent: "#fb7185",
    grid: "#55302a",
  },
  station: {
    bands: ["#0e1016", "#151923", "#1d2331", "#262e40", "#33405a"],
    water: "#0a0c12",
    accent: "#a5b4fc",
    grid: "#33405a",
  },
  industrial: {
    bands: ["#1a1b1e", "#26282c", "#33363c", "#42464e", "#575c66"],
    water: "#141b22",
    accent: "#fda4af",
    grid: "#42464e",
  },
  redrock: {
    bands: ["#2a1410", "#3f1f16", "#5a2c1e", "#7a3d27", "#9a5232"],
    water: "#1a1a24",
    accent: "#f97316",
    grid: "#7a3d27",
  },
};
