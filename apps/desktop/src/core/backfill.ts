// History backfill: on start, walk every combat log on disk (7.x logs carry positions on every line) and
// upload the movement history: own characters as `history` pings, other players as sightings, with the
// original log timestamps, so hotspots / activity can be reconstructed from day one, not from install day.
//
// Rules: a file is uploaded only once (progress is persisted per file); a character's history is sent only
// while that character is shared (status other than Invisible); files whose owner was not shared are
// remembered and picked up when the character is shared later. Nothing is ever deleted locally.
import { decoder, gameFS, join } from "./fs";
import { feedChunk, newSession, type SessionState } from "./parser";
import { listLogs, seedClock } from "./gamelink";
import { pingFromSession, sightingFromSession, type PingOut, type SightingOut, type Uplink } from "./uplink";
import { foldFile, loadMet, loadMetFiles, saveMet, type MetIndex } from "./met";

const LS_DONE = "hydian:backfill:done"; // { [file]: ownerKey | "!ownerKey" (skipped: not shared) | "-" (no owner) }
const MIN_MS = 10_000,
  MIN_MOVE = 20; // resample own position: every 10 s, or 20 log units (2 m) of movement
const SIGHT_MS = 30_000,
  SIGHT_MOVE = 20; // per other player
const CHUNK = 4 * 1024 * 1024;
const BATCH_PINGS = 2000,
  BATCH_SIGHTS = 5000;

export interface BackfillState {
  running: boolean;
  total: number;
  done: number;
  skipped: number;
  pings: number;
  sightings: number;
  file: string;
  error: string;
}

export class Backfill {
  state: BackfillState = { running: false, total: 0, done: 0, skipped: 0, pings: 0, sightings: 0, file: "", error: "" };
  onState: () => void = () => {};
  private doneMap: Record<string, string> = {};
  /** local "known characters" index: every file is folded in once, uploaded or not */
  met: MetIndex = loadMet();
  private metFiles: Record<string, 1> = loadMetFiles();
  onMet: (met: MetIndex) => void = () => {};
  private stop = false;
  private wake: (() => void) | null = null;

  constructor(
    private uplink: Uplink,
    private isShared: (server: string, id: string) => boolean,
  ) {
    try {
      this.doneMap = JSON.parse(localStorage.getItem(LS_DONE) ?? "{}");
    } catch {
      /* ignore */
    }
  }
  private save() {
    try {
      localStorage.setItem(LS_DONE, JSON.stringify(this.doneMap));
    } catch {
      /* ignore */
    }
  }
  private emit(p: Partial<BackfillState>) {
    Object.assign(this.state, p);
    this.onState();
  }

  /** A character became shared: forget the "skipped" marks of its files so the next run uploads them. */
  release(server: string, id: string) {
    const mark = `!${server}:${id}`;
    let n = 0;
    for (const [f, v] of Object.entries(this.doneMap))
      if (v === mark) {
        delete this.doneMap[f];
        n++;
      }
    if (n) {
      this.save();
      this.wake?.();
    }
  }
  cancel() {
    this.stop = true;
    this.wake?.();
  }

  async run(logsDir: string) {
    if (this.state.running) {
      this.wake?.();
      return;
    }
    this.stop = false;
    this.emit({ running: true, error: "" });
    try {
      for (;;) {
        // newest first: the people and places that matter now show up in the first minutes, the old logs follow
        const files = (await listLogs(logsDir)).filter((f) => !(f in this.doneMap) || !(f in this.metFiles));
        const doneCount = Object.values(this.doneMap).filter((v) => !v.startsWith("!")).length;
        const skipped = Object.values(this.doneMap).filter((v) => v.startsWith("!")).length;
        this.emit({ total: files.length + doneCount + skipped, done: doneCount, skipped });
        if (!files.length) break;
        for (const f of files) {
          if (this.stop) break;
          const online = this.uplink.enabled && !!this.uplink.baseUrl;
          const upload = !(f in this.doneMap) && online;
          if (!upload && f in this.metFiles) {
            await this.sleep(30_000);
            continue;
          } // only the upload is pending and the server is off: wait
          this.emit({ file: f });
          try {
            const mark = await this.file(logsDir, f, upload);
            this.metFiles[f] = 1;
            saveMet(this.met, this.metFiles);
            this.onMet(this.met);
            if (!upload) {
              await this.sleep(40);
              continue;
            }
            this.doneMap[f] = mark;
            this.save();
            this.emit({
              done: this.state.done + (mark.startsWith("!") ? 0 : 1),
              skipped: this.state.skipped + (mark.startsWith("!") ? 1 : 0),
            });
          } catch (e) {
            this.emit({ error: String((e as Error).message ?? e) });
            await this.sleep(20_000); // server down / offline: wait, then retry the same file
            break;
          }
          await this.sleep(40); // keep the UI responsive
        }
        if (this.stop) break;
      }
    } finally {
      this.emit({ running: false, file: "" });
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => {
      this.wake = () => {
        this.wake = null;
        r();
      };
      setTimeout(() => this.wake?.(), ms);
    });
  }

  /** Parse one whole log: fold its sightings into the local index and (if `upload`) send its history. Returns the progress mark. */
  private async file(logsDir: string, name: string, upload = true): Promise<string> {
    const fs = await gameFS();
    const path = join(logsDir, name);
    const { size } = await fs.stat(path);
    const s: SessionState = newSession();
    seedClock(s, name);
    const pings: PingOut[] = [];
    const sights: SightingOut[] = [];
    let shared: boolean | null = null; // unknown until the owner shows up
    let lastPos: { x: number; y: number; atMs: number } | null = null;
    const lastSight = new Map<string, { x: number; y: number; atMs: number }>();
    const met = new Map<
      string,
      { name: string; server: string; atMs: number; areaId: string | null; areaName?: string | null }
    >();
    const flushIfFull = async () => {
      if (pings.length >= BATCH_PINGS || sights.length >= BATCH_SIGHTS) await this.send(pings, sights);
    };
    const ev = {
      onOwner: (st: SessionState, raw: string) => {
        shared = !!st.server && !!st.ownerId && this.isShared(st.server, st.ownerId);
        if (shared && upload) {
          const p = pingFromSession("history", st, null, false, raw);
          if (p) pings.push(p);
        }
      },
      onArea: (_a: unknown, st: SessionState, raw: string) => {
        if (shared && upload) {
          const p = pingFromSession("history", st, null, false, raw);
          if (p) {
            pings.push(p);
            lastPos = st.pos ? { x: st.pos.x, y: st.pos.y, atMs: st.pos.atMs } : null;
          }
        }
      },
      onPos: (pos: { x: number; y: number; atMs: number }, st: SessionState, raw: string) => {
        if (!shared || !upload) return;
        if (lastPos && pos.atMs - lastPos.atMs < MIN_MS && Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y) < MIN_MOVE)
          return;
        const p = pingFromSession("history", st, null, false, raw);
        if (p) {
          pings.push(p);
          lastPos = { x: pos.x, y: pos.y, atMs: pos.atMs };
        }
      },
      onSighting: (
        sg: { id: string; name: string; x: number; y: number; z: number; at: string; atMs: number },
        _new: boolean,
        st: SessionState,
        raw: string,
      ) => {
        if (st.server)
          met.set(`${st.server}:${sg.id}`, {
            name: sg.name,
            server: st.server,
            atMs: sg.atMs,
            areaId: st.area?.id ?? null,
            areaName: st.area?.name ?? null,
          });
        if (!shared || !upload) return;
        const l = lastSight.get(sg.id);
        if (l && sg.atMs - l.atMs < SIGHT_MS && Math.hypot(sg.x - l.x, sg.y - l.y) < SIGHT_MOVE) return;
        const o = sightingFromSession(sg, st, raw);
        if (o) {
          sights.push(o);
          lastSight.set(sg.id, { x: sg.x, y: sg.y, atMs: sg.atMs });
        }
      },
    };
    let rest: Uint8Array = new Uint8Array(0);
    for (let off = 0; off < size; off += CHUNK) {
      const chunk = await fs.read(path, off, Math.min(CHUNK, size - off));
      const buf = rest.length ? concat(rest, chunk) : chunk;
      rest = feedChunk(s, buf, (b) => decoder.decode(b), ev);
      await flushIfFull();
      if (this.stop) throw new Error("cancelled");
      await new Promise((r) => setTimeout(r, 0));
    }
    if (rest.length) feedChunk(s, concat(rest, new Uint8Array([10])), (b) => decoder.decode(b), ev);
    foldFile(this.met, name, met);
    if (!s.ownerId || !s.server) return "-";
    if (!shared) return `!${s.server}:${s.ownerId}`;
    if (upload) await this.send(pings, sights);
    return `${s.server}:${s.ownerId}`;
  }

  private async send(pings: PingOut[], sights: SightingOut[]) {
    while (pings.length || sights.length) {
      const p = pings.splice(0, BATCH_PINGS),
        sg = sights.splice(0, BATCH_SIGHTS);
      await this.uplink.send(p, sg, true);
      this.emit({ pings: this.state.pings + p.length, sightings: this.state.sightings + sg.length });
    }
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const o = new Uint8Array(a.length + b.length);
  o.set(a);
  o.set(b, a.length);
  return o;
}
