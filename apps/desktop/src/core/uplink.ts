// Uplink: sends this install's pings (own character + sightings) to the Hydian server and
// subscribes to live presence for the selected game server. Nothing is dropped client-side:
// the queue persists across restarts and retries with backoff.
import type { Area, Position, SessionState, Sighting } from "./parser";
import { hueOf, type Player, type RPStatus } from "../model";
import { planetById } from "../data/planets";
import { CLASSES } from "../data/servers";

export interface PingOut {
  kind: "login" | "area" | "move" | "status" | "heartbeat" | "history";
  server: string;
  characterId: string;
  characterName: string;
  class?: string | null;
  discipline?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  areaMode?: string | null;
  x?: number | null;
  y?: number | null;
  h?: number | null;
  heading?: number | null;
  hp?: number | null;
  hpMax?: number | null;
  status: RPStatus | null;
  lfrp: boolean;
  instance?: number | null;
  logTs?: number | null;
  raw?: string | null; // null = history
}
export interface SightingOut {
  server: string;
  seenBy: string;
  characterId: string;
  characterName: string;
  areaId?: string | null;
  x?: number | null;
  y?: number | null;
  h?: number | null;
  logTs?: number | null;
  raw?: string | null;
}
export interface LivePlayer {
  key: string;
  server: string;
  characterId: string;
  name: string;
  cls?: string | null;
  disc?: string | null; // class is never served
  faction?: "imp" | "rep" | null; // derived from the class, server side
  areaId: string | null;
  areaName: string | null;
  x: number;
  y: number;
  h: number;
  status: RPStatus;
  lfrp: boolean;
  instance?: number | null;
  lastActive: number;
}

const APP_VERSION = "0.1.0";
const LSQ = "hydian:uplink:queue";

function uuid(): string {
  const k = "hydian:installId";
  try {
    const v = localStorage.getItem(k);
    if (v) return v;
    const n = crypto.randomUUID();
    localStorage.setItem(k, n);
    return n;
  } catch {
    return crypto.randomUUID();
  }
}

export class Uplink {
  readonly installId = uuid();
  private pings: PingOut[] = [];
  private sightings: SightingOut[] = [];
  private timer: number | null = null;
  private ws: WebSocket | null = null;
  private wsServer = "";
  private backoff = 5000;
  status: "off" | "idle" | "sending" | "error" | "live" = "off";
  lastError = "";
  sent = 0;
  onLive: (
    msg:
      | { type: "snapshot"; players: LivePlayer[] }
      | { type: "ping"; player: LivePlayer }
      | { type: "leave"; key: string },
  ) => void = () => {};
  onState: () => void = () => {};
  /** Characters the server refused because another install is sharing them right now. */
  onConflict?: (characterIds: string[]) => void;
  private lastConflicts = "";

  constructor(
    public baseUrl: string,
    public enabled: boolean,
  ) {
    try {
      const q = JSON.parse(localStorage.getItem(LSQ) ?? "null");
      if (q) {
        this.pings = q.pings ?? [];
        this.sightings = q.sightings ?? [];
      }
    } catch {
      /* ignore */
    }
  }

  configure(baseUrl: string, enabled: boolean) {
    const changed = baseUrl !== this.baseUrl || enabled !== this.enabled;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.enabled = enabled;
    if (changed) {
      this.closeLive();
      if (this.wsServer) this.subscribe(this.wsServer);
    }
    this.status = this.enabled && this.baseUrl ? "idle" : "off";
    this.onState();
  }

  // ---------------------------------------------------------------- queueing
  push(p: PingOut) {
    this.pings.push(p);
    this.persist();
    this.schedule();
  }
  pushSighting(s: SightingOut) {
    this.sightings.push(s);
    this.persist();
    this.schedule();
  }
  get queued() {
    return this.pings.length + this.sightings.length;
  }
  private persist() {
    // cap the offline queue at 5000 rows (~ a long evening); oldest first
    if (this.pings.length > 4000) this.pings.splice(0, this.pings.length - 4000);
    if (this.sightings.length > 1000) this.sightings.splice(0, this.sightings.length - 1000);
    try {
      localStorage.setItem(LSQ, JSON.stringify({ pings: this.pings, sightings: this.sightings }));
    } catch {
      /* ignore */
    }
  }
  private schedule(delay = 3000) {
    if (this.timer !== null || !this.enabled || !this.baseUrl) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }
  async flush() {
    if (!this.enabled || !this.baseUrl || this.queued === 0) return;
    const pings = this.pings.slice(0, 200),
      sightings = this.sightings.slice(0, 500);
    this.status = "sending";
    this.onState();
    try {
      const r = await fetch(`${this.baseUrl}/v1/pings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installId: this.installId, appVersion: APP_VERSION, pings, sightings }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { conflicts?: string[] };
      // a character another install is actively sharing: the server dropped those pings; say so once
      const conflicts = j.conflicts ?? [];
      if (conflicts.length && conflicts.join() !== this.lastConflicts) {
        this.lastConflicts = conflicts.join();
        this.onConflict?.(conflicts);
      }
      this.pings.splice(0, pings.length);
      this.sightings.splice(0, sightings.length);
      this.persist();
      this.sent += pings.length + sightings.length;
      this.backoff = 5000;
      this.lastError = "";
      this.status = this.ws?.readyState === 1 ? "live" : "idle";
      this.onState();
      if (this.queued) this.schedule(500);
    } catch (e) {
      this.lastError = String((e as Error).message ?? e);
      this.status = "error";
      this.onState();
      this.schedule(this.backoff);
      this.backoff = Math.min(120_000, this.backoff * 2);
    }
  }

  /** One direct POST (used by the history backfill); throws on failure so the caller can retry the file. */
  async send(pings: PingOut[], sightings: SightingOut[], historical = false) {
    if (!this.enabled || !this.baseUrl) throw new Error("uplink off");
    const r = await fetch(`${this.baseUrl}/v1/pings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ installId: this.installId, appVersion: APP_VERSION, historical, pings, sightings }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.sent += pings.length + sightings.length;
    this.onState();
  }

  /** Friend edge to the server (the list itself is local). Best effort. */
  async friend(server: string, characterId: string, action: "add" | "remove") {
    if (!this.baseUrl || !this.enabled) return;
    try {
      await fetch(`${this.baseUrl}/v1/friends`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installId: this.installId, server, characterId, action }),
      });
    } catch {
      /* ignore */
    }
  }

  /** Optional survey; failures are swallowed; feedback must never block leaving. */
  async feedback(kind: "offboarding" | "general", reasons: string[], rating: number | null, comment: string) {
    if (!this.baseUrl) return;
    try {
      await fetch(`${this.baseUrl}/v1/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installId: this.installId,
          appVersion: APP_VERSION,
          kind,
          reasons,
          rating,
          comment: comment || null,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  /** Delete everything this install ever sent (server anonymises it); then forget the install id and queues. */
  async deleteMyData(): Promise<{ characters: number; pings: number; sightings: number }> {
    if (!this.baseUrl) throw new Error("no server configured");
    const r = await fetch(`${this.baseUrl}/v1/me`, {
      method: "DELETE",
      headers: { "x-install-id": this.installId },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { characters: number; pings: number; sightings: number };
    this.pings = [];
    this.sightings = [];
    this.persist();
    try {
      localStorage.removeItem("hydian:installId");
      localStorage.removeItem("hydian:backfill:done");
    } catch {
      /* ignore */
    }
    return j;
  }

  // ---------------------------------------------------------------- live presence
  subscribe(server: string) {
    this.wsServer = server;
    this.closeLive();
    if (!this.enabled || !this.baseUrl) return;
    const url = this.baseUrl.replace(/^http/, "ws") + `/v1/live?server=${encodeURIComponent(server)}`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        if (this.status !== "error") {
          this.status = "live";
          this.onState();
        }
      };
      ws.onmessage = (ev) => {
        try {
          this.onLive(JSON.parse(ev.data));
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
          this.status = this.enabled ? "idle" : "off";
          this.onState();
          if (this.enabled && this.wsServer === server) setTimeout(() => this.subscribe(server), 5000);
        }
      };
      ws.onerror = () => ws.close();
    } catch (e) {
      this.lastError = String(e);
    }
  }
  private closeLive() {
    if (this.ws) {
      const w = this.ws;
      this.ws = null;
      w.onclose = null;
      w.close();
    }
  }
}

// ---------------------------------------------------------------- helpers to build payloads from parser state
export function pingFromSession(
  kind: PingOut["kind"],
  s: SessionState,
  status: RPStatus | null,
  lfrp: boolean,
  raw?: string,
  instance: number | null = null,
): PingOut | null {
  if (!s.ownerId || !s.server || !s.ownerName) return null;
  const pos: Position | null = s.pos,
    area: Area | null = s.area;
  return {
    kind,
    server: s.server,
    characterId: s.ownerId,
    characterName: s.ownerName,
    class: s.cls,
    discipline: s.disc,
    areaId: area?.id ?? null,
    areaName: area?.name ?? null,
    areaMode: area?.mode ?? null,
    x: pos?.x ?? null,
    y: pos?.y ?? null,
    h: pos?.z ?? null,
    heading: pos?.heading ?? null,
    hp: pos?.hp ?? null,
    hpMax: pos?.hpMax ?? null,
    status,
    lfrp,
    instance,
    logTs: pos?.atMs ?? null,
    raw: raw ?? null,
  };
}
export function sightingFromSession(sg: Sighting, s: SessionState, raw?: string): SightingOut | null {
  if (!s.ownerId || !s.server) return null;
  return {
    server: s.server,
    seenBy: s.ownerId,
    characterId: sg.id,
    characterName: sg.name,
    areaId: s.area?.id ?? null,
    x: sg.x,
    y: sg.y,
    h: sg.z,
    logTs: sg.atMs,
    raw: raw ?? null,
  };
}
export interface RegistryEntry {
  key: string;
  server: string;
  characterId: string;
  name: string;
  faction?: "imp" | "rep" | null;
  areaId: string | null;
  areaName: string | null;
  status: RPStatus | null;
  lfrp: boolean;
  instance?: number | null;
  x: number | null;
  y: number | null;
  h: number | null;
  lastActive: number;
}
/** Everyone who ever shared a character on a game server (offline ones included, last planet only). */
export async function fetchRegistry(baseUrl: string, server: string): Promise<RegistryEntry[]> {
  const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/registry?server=${encodeURIComponent(server)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { characters: RegistryEntry[] }).characters;
}
export function registryToPlayer(e: RegistryEntry): Player {
  const planet = e.areaId ? planetById(e.areaId) : undefined;
  return {
    key: e.key,
    id: e.characterId,
    name: e.name,
    server: e.server,
    cls: null,
    disc: null,
    faction: e.faction ?? null,
    planetId: planet?.id ?? e.areaId,
    areaName: e.areaName ?? planet?.name ?? "Unknown",
    x: e.x ?? 0,
    y: e.y ?? 0,
    z: e.h ?? 0,
    heading: 0,
    status: e.status ?? "invisible",
    lfrp: e.lfrp,
    instance: e.instance ?? null,
    hue: hueOf(e.characterId),
    lastActive: e.lastActive,
  };
}
export function livePlayerToPlayer(lp: LivePlayer): Player {
  const planet = lp.areaId ? planetById(lp.areaId) : undefined;
  return {
    key: lp.key,
    id: lp.characterId,
    name: lp.name,
    server: lp.server,
    cls: lp.cls ?? null,
    disc: lp.disc ?? null,
    faction: lp.faction ?? (lp.cls ? (CLASSES[lp.cls]?.faction ?? null) : null),
    planetId: planet?.id ?? lp.areaId,
    areaName: lp.areaName ?? planet?.name ?? "Unknown",
    x: lp.x,
    y: lp.y,
    z: lp.h,
    heading: 0,
    status: lp.status,
    lfrp: lp.lfrp,
    instance: lp.instance ?? null,
    hue: hueOf(lp.characterId),
    lastActive: lp.lastActive,
  };
}
