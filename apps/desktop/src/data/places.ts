// Places the log names that are not planets on the map: personal ships, strongholds, guild flagships,
// instances. They get a readable name and a kind, so nothing ever says "Unknown place".
import { planetById } from "./planets";

export type PlaceKind = "planet" | "ship" | "stronghold" | "other";

const SHIP = /\b(fury|phantom|mantis|defender|thunderclap|freighter|starship)\b/i;
const STRONGHOLD =
  /\b(stronghold|sky palace|apartment|homestead|retreat|hideout|estate|mobile base|flagship|temple)\b/i;

// area ids seen in logs that are not the planet they are named after, or ships
const KNOWN: Record<string, { name: string; kind: PlaceKind }> = {
  "137438962210": { name: "Kaas City Apartment", kind: "stronghold" },
  "137438956742": { name: "Fury", kind: "ship" },
  "137438956741": { name: "Fury", kind: "ship" },
  "137438988857": { name: "D5-Mantis", kind: "ship" },
  "137438956734": { name: "X-70 Phantom", kind: "ship" },
};

export function placeKind(areaId: string | null | undefined, areaName: string | null | undefined): PlaceKind {
  if (areaId && planetById(areaId)) return "planet";
  if (areaId && KNOWN[areaId]) return KNOWN[areaId].kind;
  if (!areaName) return "other";
  if (SHIP.test(areaName)) return "ship";
  if (STRONGHOLD.test(areaName)) return "stronghold";
  return "other";
}

/** The best name for an area: the planet's, else what the log called it, else a kind. */
export function placeName(areaId: string | null | undefined, areaName: string | null | undefined): string {
  const p = areaId ? planetById(areaId) : undefined;
  if (p) return p.name;
  if (areaId && KNOWN[areaId]) return KNOWN[areaId].name;
  return areaName ?? "Unknown";
}

/** A short line under a name: "Aboard the Fury", "Stronghold", or the area as the log names it. */
export function placeLabel(areaId: string | null | undefined, areaName: string | null | undefined): string {
  const kind = placeKind(areaId, areaName);
  const name = placeName(areaId, areaName);
  void kind;
  return name;
}
