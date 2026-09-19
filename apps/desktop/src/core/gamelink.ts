// GameLink: everything that touches the game's own files. Read-only.
//  - roster():  character names per server from settings filenames
//  - scanHistory(): last-known state of your characters from recent logs
//  - Tail: live follow of the newest combat log
import { gameFS, decoder, join, fileErrorCode, type DirEntry } from "./fs";
import { SERVERS } from "../data/servers";
import { feedChunk, newSession, type Area, type Position, type SessionState, type Sighting } from "./parser";

/** Server id (as written in the log) -> display name; PTS is not a playable server but appears in logs. */
export const SERVER_NAMES: Record<string, string> = {
  ...Object.fromEntries(SERVERS.map((s) => [s.id, s.name])),
  he8000: "PTS",
};

export interface Paths {
  logsDir: string;
  settingsDir: string;
  installDir?: string;
}

export type GameLinkIssue = "missing-folder" | "permission-denied" | "unavailable";

class GameLinkError extends Error {
  constructor(
    readonly issue: GameLinkIssue,
    message: string,
    cause: unknown,
  ) {
    super(message, { cause });
  }
}

export function gameLinkFailure(error: unknown): { status: "nolog" | "error"; issue: GameLinkIssue; error: string } {
  if (error instanceof GameLinkError)
    return { status: error.issue === "missing-folder" ? "nolog" : "error", issue: error.issue, error: error.message };
  if (fileErrorCode(error) === "permission-denied")
    return { status: "error", issue: "permission-denied", error: "Hydian needs permission to read your game files." };
  return {
    status: "error",
    issue: "unavailable",
    error: "Hydian couldn't read your game files. Check the folder and try again.",
  };
}

export const LOG_RE = /^combat_.*\.txt$/i;

/** combat_YYYY-MM-DD_HH_MM_SS_us.txt -> epoch ms (local time), or 0. Lets us pick recent logs without stat-ing 2000 files. */
export function logTime(name: string): number {
  const m = /^combat_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/.exec(name);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0;
}

/** Seed a session's clock from the log file name so line timestamps become absolute. */
export function seedClock(s: SessionState, name: string) {
  const m = /^combat_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/.exec(name);
  if (!m) return;
  s.dayBase = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  s.startSec = +m[4] * 3600 + +m[5] * 60 + +m[6];
}

/** Log filenames newest-first, by the timestamp in the name. No per-file stat. */
export async function listLogs(logsDir: string): Promise<string[]> {
  const fs = await gameFS();
  let entries: DirEntry[];
  try {
    entries = await fs.readDir(logsDir, /^$/);
  } catch (error) {
    const code = fileErrorCode(error);
    if (code === "not-found")
      throw new GameLinkError("missing-folder", "The combat-log folder hasn't been found yet.", error);
    if (code === "not-directory")
      throw new GameLinkError("unavailable", "Choose the CombatLogs folder, rather than a file.", error);
    throw error;
  }
  return entries
    .filter((e) => !e.isDir && LOG_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => logTime(b) - logTime(a));
}

/**
 * Users point at "their SWTOR folder", which can mean the game install, the
 * Documents folder, or CombatLogs itself. Resolve whichever they picked.
 * Returns the folder to use plus a note when we had to redirect.
 */
export async function resolveLogsDir(picked: string): Promise<{ dir: string; note: string | null }> {
  const fs = await gameFS();
  const list = async (d: string) => {
    try {
      return await fs.readDir(d, /^$/);
    } catch {
      return null;
    }
  };
  const here = await list(picked);
  const def = (await detectPaths()).logsDir;
  if (here === null) return { dir: picked, note: null };
  if (here.some((e) => !e.isDir && LOG_RE.test(e.name))) return { dir: picked, note: null };
  if (here.some((e) => e.isDir && /^CombatLogs$/i.test(e.name)))
    return { dir: join(picked, "CombatLogs"), note: "Using the CombatLogs subfolder." };
  const looksLikeInstall = here.some((e) => /^(Assets|swtor|launcher\.exe|launcher\.settings)$/i.test(e.name));
  if (looksLikeInstall)
    return {
      dir: def,
      note: "That is the game install folder. SWTOR writes combat logs to Documents, so the default folder is used instead.",
    };
  return { dir: picked, note: "No combat_*.txt files found here yet." };
}

export async function detectPaths(): Promise<Paths> {
  const fs = await gameFS();
  const r = await fs.roots();
  return { logsDir: join(r.documents, "CombatLogs"), settingsDir: join(r.localData, "swtor", "settings") };
}

// --------------------------------------------------------------- roster
export interface RosterEntry {
  server: string;
  name: string;
}

export async function roster(settingsDir: string): Promise<RosterEntry[]> {
  const fs = await gameFS();
  const entries = await fs.readDir(settingsDir, /^$/);
  const re = /^(he\d+)_(.+)_PlayerGUIState\.ini$/i;
  const out: RosterEntry[] = [];
  for (const e of entries) {
    const m = re.exec(e.name);
    if (m) out.push({ server: m[1], name: m[2] });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// --------------------------------------------------------------- history
export interface CharacterSnapshot {
  /** epoch ms of the character's last logged position (better "last active" than the file mtime) */
  lastEventMs: number;
  id: string;
  name: string;
  server: string;
  cls: string | null;
  disc: string | null;
  area: Area | null;
  pos: Position | null;
  lastSeen: number; // file mtime
  sessions: number;
}
export interface EncounterSnapshot extends Sighting {
  server: string;
  areaId: string;
  areaName: string;
  lastSeen: number;
  times: number;
}

export interface History {
  characters: CharacterSnapshot[];
  encounters: EncounterSnapshot[];
}

const HEAD = 24 * 1024,
  TAIL = 192 * 1024;

/**
 * Last-known state of your characters from recent logs only (default: last 7 days, at most 12 files).
 * Reads just the head (owner/class/first area) and tail (last area/pos) of each file.
 */
export async function scanHistory(
  logsDir: string,
  opts: { maxFiles?: number; maxAgeMs?: number } = {},
  onProgress?: (done: number, total: number) => void,
): Promise<History> {
  const { maxFiles = 12, maxAgeMs = 7 * 24 * 3600 * 1000 } = opts;
  const fs = await gameFS();
  let names = await listLogs(logsDir);
  const cutoff = Date.now() - maxAgeMs;
  names = names.filter((n) => logTime(n) >= cutoff).slice(0, maxFiles);
  if (!names.length) names = (await listLogs(logsDir)).slice(0, 3); // nothing recent: fall back to the 3 newest
  const files: DirEntry[] = [];
  for (const name of names) {
    try {
      const st = await fs.stat(join(logsDir, name));
      files.push({ name, isDir: false, size: st.size, mtime: st.mtime || logTime(name) });
    } catch (error) {
      if (fileErrorCode(error) !== "not-found") throw error;
    }
  }
  const chars = new Map<string, CharacterSnapshot>();
  const enc = new Map<string, EncounterSnapshot>();
  let done = 0;
  onProgress?.(0, files.length);
  for (const f of files) {
    const path = join(logsDir, f.name);
    const s = newSession();
    seedClock(s, f.name);
    try {
      const head = await fs.read(path, 0, Math.min(HEAD, f.size));
      feedChunk(s, head, (b) => decoder.decode(b));
      if (f.size > HEAD) {
        const off = Math.max(HEAD, f.size - TAIL);
        const tail = await fs.read(path, off, f.size - off);
        // skip the first partial line of the tail chunk
        const nl = tail.indexOf(10);
        feedChunk(s, tail.subarray(nl + 1), (b) => decoder.decode(b));
      }
    } catch (error) {
      if (fileErrorCode(error) !== "not-found") throw error;
      continue;
    }
    if (s.ownerId && s.server) {
      const key = `${s.server}:${s.ownerId}`;
      const prev = chars.get(key);
      if (!prev)
        chars.set(key, {
          id: s.ownerId,
          name: s.ownerName!,
          server: s.server,
          cls: s.cls,
          disc: s.disc,
          area: s.area,
          pos: s.pos,
          lastSeen: f.mtime,
          lastEventMs: s.pos?.atMs ?? f.mtime,
          sessions: 1,
        });
      else prev.sessions++;
      if (s.area)
        for (const sg of s.sightings.values()) {
          const k = `${s.server}:${sg.id}`;
          const p = enc.get(k);
          if (!p)
            enc.set(k, {
              ...sg,
              server: s.server,
              areaId: s.area.id,
              areaName: s.area.name,
              lastSeen: sg.atMs || f.mtime,
              times: 1,
            });
          else p.times++;
        }
    }
    onProgress?.(++done, files.length);
  }
  return { characters: [...chars.values()], encounters: [...enc.values()] };
}

// --------------------------------------------------------------- live tail
export interface TailEvents {
  onFile?(name: string): void;
  onNoLog?(): void;
  onOwner?(s: SessionState, raw: string): void;
  onArea?(area: Area, s: SessionState, raw: string): void;
  onPos?(pos: Position, s: SessionState, raw: string): void;
  onSighting?(sight: Sighting, isNew: boolean, s: SessionState, raw: string): void;
  onTick?(s: SessionState): void;
  onError?(e: unknown): void;
}

export class Tail {
  private timer: number | null = null;
  private file: string | null = null;
  private offset = 0;
  private rest: Uint8Array = new Uint8Array(0);
  private lastDirCheck = 0;
  private failed = false;
  session = newSession();
  /** false while replaying the existing file on attach; true once caught up */
  primed = false;
  private votes = new Map<string, number>();

  constructor(
    private logsDir: string,
    private ev: TailEvents,
    private intervalMs = 750,
  ) {}

  start() {
    this.stop();
    this.timer = window.setInterval(() => void this.tick(), this.intervalMs);
    void this.tick();
  }
  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async newest(): Promise<DirEntry | null> {
    const names = await listLogs(this.logsDir);
    if (!names.length) return null;
    const fs = await gameFS();
    const st = await fs.stat(join(this.logsDir, names[0]));
    return { name: names[0], isDir: false, size: st.size, mtime: st.mtime };
  }

  private async tick() {
    try {
      const fs = await gameFS();
      const now = Date.now();
      if (!this.file || now - this.lastDirCheck > 5000) {
        this.lastDirCheck = now;
        const n = await this.newest();
        if (!n) {
          this.file = null;
          this.failed = false;
          this.ev.onNoLog?.();
        }
        if (n && n.name !== this.file) {
          this.file = n.name;
          this.offset = 0;
          this.rest = new Uint8Array(0);
          this.session = newSession();
          seedClock(this.session, n.name);
          this.votes.clear();
          this.primed = false;
          this.ev.onFile?.(n.name);
        }
      }
      if (!this.file) return;
      const path = join(this.logsDir, this.file);
      const st = await fs.stat(path);
      if (st.size <= this.offset) {
        this.primed = true;
        this.recovered();
        return;
      }
      // On first attach to a big file, jump to the last 512 KB rather than replaying a whole raid.
      if (this.offset === 0 && st.size > 512 * 1024) {
        // head carries owner + first AreaEntered + discipline: identity first ...
        const head = await fs.read(path, 0, Math.min(HEAD, st.size));
        this.rest = feedChunk(this.session, head, (b) => decoder.decode(b), this.ev, this.votes);
        this.rest = new Uint8Array(0);
        // ... then jump to the last 512 KB for the current state
        this.offset = st.size - 512 * 1024;
        const chunk = await fs.read(path, this.offset, st.size - this.offset);
        const nl = chunk.indexOf(10);
        this.offset += nl + 1;
        this.consume(chunk.subarray(nl + 1));
        this.primed = true;
        this.recovered();
        return;
      }
      const chunk = await fs.read(path, this.offset, Math.min(st.size - this.offset, 4 * 1024 * 1024));
      this.consume(chunk);
      if (this.offset >= st.size) this.primed = true;
      this.recovered();
    } catch (e) {
      this.failed = true;
      if (fileErrorCode(e) === "not-found") this.file = null;
      this.ev.onError?.(e);
    }
  }

  private recovered() {
    if (this.failed && this.file) {
      this.ev.onFile?.(this.file);
      this.ev.onTick?.(this.session);
    }
    this.failed = false;
  }

  private consume(chunk: Uint8Array) {
    this.offset += chunk.length; // bytes consumed from the file
    const buf = new Uint8Array(this.rest.length + chunk.length);
    buf.set(this.rest);
    buf.set(chunk, this.rest.length);
    this.rest = feedChunk(this.session, buf, (b) => decoder.decode(b), this.ev, this.votes); // leftover partial line
    this.ev.onTick?.(this.session);
  }
}
