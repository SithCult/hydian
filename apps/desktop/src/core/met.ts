// "Known characters": who you have actually met, from your own combat logs. Never uploaded, never shown to
// anyone else. Built once over every log on disk (the backfill pass feeds it) and kept fresh by the live tail.
export interface MetEntry {
  name: string;
  server: string;
  times: number; // distinct log files (≈ sessions) the character appeared in
  first: number;
  last: number; // epoch ms
  areas: Record<string, number>; // area id -> sessions there
  areaNames?: Record<string, string>; // area id -> what the log called it (ships, strongholds have no planet)
  lastArea: string | null;
}
export type MetIndex = Record<string, MetEntry>; // key = server:id

const LS_MET = "hydian:met",
  LS_MET_FILES = "hydian:met:files";

export function loadMet(): MetIndex {
  try {
    return JSON.parse(localStorage.getItem(LS_MET) ?? "{}") as MetIndex;
  } catch {
    return {};
  }
}
export function loadMetFiles(): Record<string, 1> {
  try {
    return JSON.parse(localStorage.getItem(LS_MET_FILES) ?? "{}") as Record<string, 1>;
  } catch {
    return {};
  }
}
export function saveMet(met: MetIndex, files: Record<string, 1>) {
  try {
    localStorage.setItem(LS_MET, JSON.stringify(met));
    localStorage.setItem(LS_MET_FILES, JSON.stringify(files));
  } catch {
    /* ignore */
  }
}

/** Fold one file's sightings into the index: each character counts once per file, on its last position. */
export function foldFile(
  met: MetIndex,
  file: string,
  seen: Map<string, { name: string; server: string; atMs: number; areaId: string | null; areaName?: string | null }>,
) {
  for (const [key, s] of seen) {
    const e =
      met[key] ??
      (met[key] = { name: s.name, server: s.server, times: 0, first: s.atMs, last: 0, areas: {}, lastArea: null });
    e.times++;
    if (s.atMs < e.first) e.first = s.atMs;
    if (s.atMs >= e.last) {
      e.last = s.atMs;
      e.lastArea = s.areaId;
      e.name = s.name; // the newest spelling wins, whatever order the files come in
    }
    if (s.areaId) {
      e.areas[s.areaId] = (e.areas[s.areaId] ?? 0) + 1;
      if (s.areaName) (e.areaNames ??= {})[s.areaId] = s.areaName;
    }
  }
  void file;
}

/** Sort areas by how often you met someone there. */
export const usualAreas = (e: MetEntry, n = 3) =>
  Object.entries(e.areas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
