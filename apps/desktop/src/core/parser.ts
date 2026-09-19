// SWTOR 7.x combat-log parser (format tag <v7.0.0b>).
//
// [HH:MM:SS.mmm] [source] [target] [ability] [effect] (value) <threat>
// entity  = @Name#id|(x,y,z,heading)|(hp/hpmax)          player
//         | @Owner#id/Comp {id}:inst|(..)|(..)             companion
//         | Npc Name {id}:inst|(..)|(..)                   npc
// effect  = AreaEntered {..}: Nar Shaddaa {137438987989}                     (he4000) <v7.0.0b>
//         | AreaEntered {..}: The Dread Palace {137438993410} 8 Player Story {836045448953651}
//         | DisciplineChanged {..}: Assassin {..}/Darkness {..}

export interface Entity {
  name: string;
  id: string | null;
  isPlayer: boolean;
  companion: string | null;
  x: number;
  y: number;
  z: number;
  heading: number;
  hp: number;
  hpMax: number;
}

export interface Area {
  name: string;
  id: string;
  mode: string | null;
  modeId: string | null;
}

export interface ParsedLine {
  ts: string;
  src: Entity | null;
  tgt: Entity | null;
  ability: string;
  effect: string;
  area?: Area;
  server?: string;
  discipline?: { cls: string; disc: string };
}

const LINE_RE = /^\[([^\]]*)\] \[([^\]]*)\] \[([^\]]*)\] \[([^\]]*)\] \[([^\]]*)\](.*)$/;
const ENTITY_RE =
  /^(@)?([^#{|/]+?)(?:#(\d+))?(?:\/([^{|]+?))?(?:\s*\{(\d+)\}:(\d+))?\|\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)\|\((\d+)\/(\d+)\)$/;
const AREA_RE = /AreaEntered \{\d+\}: (.+?) \{(\d+)\}(?: (.+?) \{(\d+)\})?/;
const SERVER_RE = /\((he\d+)\)/;
const DISC_RE = /DisciplineChanged \{\d+\}: (.+?) \{\d+\}\/(.+?) \{\d+\}/;

export function parseEntity(raw: string): Entity | null {
  raw = raw.trim();
  if (!raw || raw === "=") return null;
  const m = ENTITY_RE.exec(raw);
  if (!m) return null;
  return {
    name: m[2].trim(),
    id: m[3] ?? null,
    isPlayer: !!m[1] && !m[4],
    companion: m[4]?.trim() ?? null,
    x: +m[7],
    y: +m[8],
    z: +m[9],
    heading: +m[10],
    hp: +m[11],
    hpMax: +m[12],
  };
}

export function parseLine(line: string): ParsedLine | null {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const src = parseEntity(m[2]);
  const tgt = m[3].trim() === "=" ? src : parseEntity(m[3]);
  const effect = m[5];
  const out: ParsedLine = { ts: m[1], src, tgt, ability: m[4], effect };
  if (effect.startsWith("AreaEntered")) {
    const a = AREA_RE.exec(effect);
    if (a) out.area = { name: a[1], id: a[2], mode: a[3] ?? null, modeId: a[4] ?? null };
    const s = SERVER_RE.exec(m[6]);
    if (s) out.server = s[1];
  } else if (effect.startsWith("DisciplineChanged")) {
    const d = DISC_RE.exec(effect);
    if (d) out.discipline = { cls: d[1], disc: d[2] };
  }
  return out;
}

// ------------------------------------------------------------- session state

export interface Position {
  x: number;
  y: number;
  z: number;
  heading: number;
  hp: number;
  hpMax: number;
  at: string;
  atMs: number;
}
export interface Sighting {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  at: string;
  atMs: number;
}

export interface SessionState {
  ownerId: string | null;
  ownerName: string | null;
  server: string | null;
  cls: string | null;
  disc: string | null;
  area: Area | null;
  areaEnteredAt: string | null;
  pos: Position | null;
  sightings: Map<string, Sighting>;
  lines: number;
  /** epoch ms of local midnight for the log file's date, and the file's start second-of-day (for midnight rollover) */
  dayBase: number;
  startSec: number;
}

/** "HH:MM:SS.mmm" -> epoch ms using the session's file date; handles sessions crossing midnight. */
export function lineMs(s: SessionState, ts: string): number {
  const h = +ts.slice(0, 2),
    m = +ts.slice(3, 5),
    sec = +ts.slice(6, 8),
    ms = +(ts.slice(9, 12) || 0);
  let sod = h * 3600 + m * 60 + sec;
  if (s.startSec && sod < s.startSec - 3600) sod += 86400;
  return s.dayBase + sod * 1000 + ms;
}

export function newSession(): SessionState {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return {
    ownerId: null,
    ownerName: null,
    server: null,
    cls: null,
    disc: null,
    area: null,
    areaEnteredAt: null,
    pos: null,
    sightings: new Map(),
    lines: 0,
    dayBase: d.getTime(),
    startSec: 0,
  };
}

export interface SessionEvents {
  onArea?(area: Area, s: SessionState, raw: string): void;
  onOwner?(s: SessionState, raw: string): void;
  onPos?(pos: Position, s: SessionState, raw: string): void;
  onSighting?(sight: Sighting, isNew: boolean, s: SessionState, raw: string): void;
}

/** Feed one raw line into a session; mutates `s` and fires events. */
export function feed(s: SessionState, line: string, ev: SessionEvents = {}, votes?: Map<string, number>) {
  const p = parseLine(line);
  if (!p) return;
  s.lines++;
  const { src, tgt } = p;

  // AreaEntered / DisciplineChanged always carry the log owner as source.
  if (p.area && p.server && src?.isPlayer) s.server = p.server;
  if (src?.isPlayer && (p.area || p.discipline)) {
    if (s.ownerId !== src.id) {
      s.ownerId = src.id;
      s.ownerName = src.name;
      s.sightings.clear();
      ev.onOwner?.(s, line);
    }
  } else if (src?.isPlayer && s.ownerId === null && votes) {
    const n = (votes.get(src.id!) ?? 0) + 1;
    votes.set(src.id!, n);
    if (n >= 5) {
      s.ownerId = src.id;
      s.ownerName = src.name;
      ev.onOwner?.(s, line);
    }
  }

  if (p.area && src?.id === s.ownerId) {
    if (p.server) s.server = p.server;
    const changed = !s.area || s.area.id !== p.area.id || s.area.modeId !== p.area.modeId;
    s.area = p.area;
    s.areaEnteredAt = p.ts;
    if (changed) {
      s.sightings.clear();
      ev.onArea?.(p.area, s, line);
    }
  }
  if (p.discipline && src?.id === s.ownerId) {
    s.cls = p.discipline.cls;
    s.disc = p.discipline.disc;
  }

  for (const e of [src, tgt]) {
    if (!e?.isPlayer || !e.id) continue;
    if (e.id === s.ownerId) {
      const moved = !s.pos || s.pos.x !== e.x || s.pos.y !== e.y || s.pos.z !== e.z;
      s.pos = { x: e.x, y: e.y, z: e.z, heading: e.heading, hp: e.hp, hpMax: e.hpMax, at: p.ts, atMs: lineMs(s, p.ts) };
      if (moved) ev.onPos?.(s.pos, s, line);
    } else {
      const isNew = !s.sightings.has(e.id);
      const sight = { id: e.id, name: e.name, x: e.x, y: e.y, z: e.z, at: p.ts, atMs: lineMs(s, p.ts) };
      s.sightings.set(e.id, sight);
      ev.onSighting?.(sight, isNew, s, line);
    }
  }
}

/** Split a byte chunk into complete lines; returns leftover partial bytes. */
export function feedChunk(
  s: SessionState,
  chunk: Uint8Array,
  decode: (b: Uint8Array) => string,
  ev: SessionEvents = {},
  votes?: Map<string, number>,
): Uint8Array {
  const cut = chunk.lastIndexOf(10);
  if (cut === -1) return chunk;
  const text = decode(chunk.subarray(0, cut + 1));
  for (const line of text.split("\n")) if (line) feed(s, line.replace(/\r$/, ""), ev, votes);
  return chunk.subarray(cut + 1);
}
