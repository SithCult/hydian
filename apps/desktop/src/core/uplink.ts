// Uplink: sends this install's pings (own character + sightings) to the Hydian server and
// subscribes to live presence for the selected game server. Pending uploads persist across
// restarts and retry with backoff until sharing is disabled.
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
const LS_REMOVED = "hydian:uplink:removed";

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
  private currentInstallId = uuid();
  get installId() {
    return this.currentInstallId;
  }
  private pings: PingOut[] = [];
  private sightings: SightingOut[] = [];
  private timer: number | null = null;
  private ws: WebSocket | null = null;
  private wsServer = "";
  private backoff = 5000;
  private writes = new Set<Promise<Response>>();
  private flushing: Promise<void> | null = null;
  private erasing = false;
  private sharingEpoch = 0;
  private erasure: Promise<{ characters: number; pings: number; sightings: number }> | null = null;
  private removed = new Set<string>();
  private characterRequests = new Map<string, Promise<void>>();
  get removedCharacters() {
    return [...this.removed];
  }
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
      this.removed = new Set(JSON.parse(localStorage.getItem(LS_REMOVED) ?? "[]"));
    } catch {
      /* ignore */
    }
    try {
      const q = JSON.parse(localStorage.getItem(LSQ) ?? "null");
      if (q && enabled) {
        this.pings = (q.pings ?? []).filter((p: PingOut) => !this.isRemoved(p.server, p.characterId));
        this.sightings = (q.sightings ?? []).filter((s: SightingOut) => this.canSendSighting(s));
      }
    } catch {
      /* ignore */
    }
    this.persist();
  }

  configure(baseUrl: string, enabled: boolean) {
    enabled = enabled && !this.erasing;
    const changed = baseUrl !== this.baseUrl || enabled !== this.enabled;
    if (changed) this.sharingEpoch++;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.enabled = enabled;
    if (!enabled) {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      this.pings = [];
      this.sightings = [];
      this.persist();
    }
    if (changed) {
      this.closeLive();
      if (this.wsServer) this.subscribe(this.wsServer);
    }
    this.status = this.enabled && this.baseUrl ? "idle" : "off";
    this.onState();
  }

  // ---------------------------------------------------------------- queueing
  push(p: PingOut) {
    if (!this.enabled || this.isRemoved(p.server, p.characterId)) return;
    this.pings.push(p);
    this.persist();
    this.schedule();
  }
  pushSighting(s: SightingOut) {
    if (!this.enabled || !this.canSendSighting(s)) return;
    this.sightings.push(s);
    this.persist();
    this.schedule();
  }
  discardCharacter(server: string, characterId: string) {
    this.pings = this.pings.filter((p) => p.server !== server || p.characterId !== characterId);
    this.sightings = this.sightings.filter(
      (s) => s.server !== server || (s.seenBy !== characterId && s.characterId !== characterId),
    );
    this.persist();
  }
  private isRemoved(server: string, characterId: string) {
    return this.removed.has(`${server}:${characterId}`);
  }
  private canSendSighting(s: SightingOut) {
    return !this.isRemoved(s.server, s.seenBy) && !this.isRemoved(s.server, s.characterId);
  }
  private persistRemoved() {
    try {
      localStorage.setItem(LS_REMOVED, JSON.stringify(this.removedCharacters));
    } catch {
      /* ignore */
    }
    this.onState();
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
  flush() {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushQueue().finally(() => {
      this.flushing = null;
      if (this.queued) this.schedule();
    });
    return this.flushing;
  }
  private async flushQueue() {
    if (!this.enabled || !this.baseUrl || this.queued === 0) return;
    const epoch = this.sharingEpoch;
    const pings = this.pings.slice(0, 200),
      sightings = this.sightings.slice(0, 500);
    this.status = "sending";
    this.onState();
    try {
      const r = await this.post("/v1/pings", { appVersion: APP_VERSION, pings, sightings });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { conflicts?: string[] };
      if (!this.enabled || epoch !== this.sharingEpoch) return;
      // a character another install is actively sharing: the server dropped those pings; say so once
      const conflicts = j.conflicts ?? [];
      if (conflicts.length && conflicts.join() !== this.lastConflicts) {
        this.lastConflicts = conflicts.join();
        this.onConflict?.(conflicts);
      }
      const sentPings = new Set(pings),
        sentSightings = new Set(sightings);
      this.pings = this.pings.filter((p) => !sentPings.has(p));
      this.sightings = this.sightings.filter((s) => !sentSightings.has(s));
      this.persist();
      this.sent += pings.length + sightings.length;
      this.backoff = 5000;
      this.lastError = "";
      this.status = this.ws?.readyState === 1 ? "live" : "idle";
      this.onState();
      if (this.queued) this.schedule(500);
    } catch (e) {
      if (!this.enabled || epoch !== this.sharingEpoch) return;
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
    pings = pings.filter((p) => !this.isRemoved(p.server, p.characterId));
    sightings = sightings.filter((s) => this.canSendSighting(s));
    if (!pings.length && !sightings.length) return;
    const r = await this.post("/v1/pings", { appVersion: APP_VERSION, historical, pings, sightings });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (!this.enabled) return;
    this.sent += pings.length + sightings.length;
    this.onState();
  }

  /** Friend edge to the server (the list itself is local). Best effort. */
  async friend(server: string, characterId: string, action: "add" | "remove") {
    if (!this.baseUrl || !this.enabled) return;
    try {
      await this.post("/v1/friends", { server, characterId, action });
    } catch {
      /* ignore */
    }
  }

  /** Optional survey; a failed submission does not fail deletion. */
  async feedback(kind: "offboarding" | "general", reasons: string[], rating: number | null, comment: string) {
    if (!this.baseUrl || this.erasing) return;
    try {
      await this.post("/v1/feedback", {
        appVersion: APP_VERSION,
        kind,
        reasons,
        rating,
        comment: comment || null,
      });
    } catch {
      /* ignore */
    }
  }

  private post(path: string, body: Record<string, unknown>) {
    return this.write(
      fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installId: this.installId, ...body }),
      }),
    );
  }

  private write(pending: Promise<Response>) {
    const request = pending.finally(() => this.writes.delete(request));
    this.writes.add(request);
    return request;
  }

  /** Suppression survives failure and restart; only an explicit restore can resume uploads. */
  deleteCharacter(server: string, characterId: string): Promise<void> {
    if (this.erasing) return Promise.reject(new Error("Data deletion is in progress."));
    const key = `${server}:${characterId}`;
    this.removed.add(key);
    this.discardCharacter(server, characterId);
    this.persistRemoved();
    return this.changeCharacter(server, characterId, "DELETE");
  }

  restoreCharacter(server: string, characterId: string): Promise<void> {
    return this.changeCharacter(server, characterId, "POST");
  }

  private changeCharacter(server: string, characterId: string, method: "DELETE" | "POST") {
    if (this.erasing) return Promise.reject(new Error("Data deletion is in progress."));
    const key = `${server}:${characterId}`;
    const previous = this.characterRequests.get(key) ?? Promise.resolve();
    const installId = this.installId;
    const baseUrl = this.baseUrl;
    const operation = previous
      .catch(() => {})
      .then(async () => {
        if (!baseUrl) throw new Error("No server configured.");
        if (method === "DELETE") {
          await Promise.allSettled(this.writes);
          await this.flushing;
        }
        const path = `/v1/me/characters/${encodeURIComponent(server)}/${encodeURIComponent(characterId)}`;
        const response = await this.write(
          fetch(`${baseUrl}${path}${method === "POST" ? "/restore" : ""}`, {
            method,
            headers: { "x-install-id": installId },
          }),
        );
        if (!response.ok) {
          if (response.status === 410) throw new Error("This device's previous sharing identity was deleted.");
          throw new Error(`HTTP ${response.status}`);
        }
        if (method === "POST") {
          this.discardCharacter(server, characterId);
          this.removed.delete(key);
          this.persistRemoved();
        }
      });
    this.characterRequests.set(key, operation);
    void operation
      .finally(() => {
        if (this.characterRequests.get(key) === operation) this.characterRequests.delete(key);
      })
      .catch(() => {});
    return operation;
  }

  /** Stop sharing before waiting for existing writes; a failed deletion can retry the same identity. */
  deleteMyData(): Promise<{ characters: number; pings: number; sightings: number }> {
    if (this.erasure) return this.erasure;
    this.erasing = true;
    this.configure(this.baseUrl, false);
    this.erasure = this.erase().finally(() => {
      this.erasing = false;
      this.erasure = null;
      this.onState();
    });
    return this.erasure;
  }

  private async erase() {
    if (!this.baseUrl) throw new Error("no server configured");
    await Promise.allSettled(this.characterRequests.values());
    // Aborting a request cannot undo a write already received by the server.
    await Promise.allSettled(this.writes);
    await this.flushing;
    const r = await fetch(`${this.baseUrl}/v1/me`, {
      method: "DELETE",
      headers: { "x-install-id": this.installId },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { characters: number; pings: number; sightings: number };
    this.currentInstallId = crypto.randomUUID();
    this.removed.clear();
    this.persistRemoved();
    this.sent = 0;
    this.lastConflicts = "";
    this.lastError = "";
    try {
      localStorage.setItem("hydian:installId", this.installId);
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
        if (this.ws !== ws) return;
        if (this.status !== "error") {
          this.status = "live";
          this.onState();
        }
      };
      ws.onmessage = (ev) => {
        if (this.ws !== ws) return;
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
/** Active players who have opted to share their character on a game server. */
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
