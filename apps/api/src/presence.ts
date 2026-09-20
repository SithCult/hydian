// Live presence, in memory: the latest ping per character wins, gone after STALE_MS without one.
import type { WebSocket } from "ws";
import type { Batch } from "./schemas.ts";
import { factionOf } from "./faction.ts";

export const STALE_MS = 45 * 60_000; // presence: gone after 45 min without a ping (client rule mirrored)

export interface Presence {
  key: string;
  server: string;
  characterId: string;
  name: string;
  cls: string | null;
  disc: string | null;
  areaId: string | null;
  areaName: string | null;
  x: number;
  y: number;
  h: number;
  status: string;
  lfrp: boolean;
  instance: number | null;
  lastActive: number;
  installId: string;
}

const presence = new Map<string, Presence>(); // key = server:characterId
const rooms = new Map<string, Set<WebSocket>>(); // server -> sockets

// What leaves the server about a live character: identity + where + status + faction. Class/discipline are
// stored but never served (only the faction derived from the class); the install id never leaves either.
const publicView = (p: Presence) => {
  const { installId: _i, cls, disc: _d, ...rest } = p;
  return { ...rest, faction: factionOf(cls) };
};

function broadcast(server: string, msg: unknown) {
  const s = rooms.get(server);
  if (!s) return;
  const data = JSON.stringify(msg);
  for (const ws of s) if (ws.readyState === 1) ws.send(data);
}

export const onlineCount = () => playersOn().length;

export const playersOn = (server?: string) => {
  const cut = Date.now() - STALE_MS;
  for (const [key, player] of presence) if (player.lastActive <= cut) leave(key);
  return [...presence.values()].filter((p) => !server || p.server === server).map(publicView);
};

/** Removes a character from the map (invisible, deleted, stale) and tells the room. */
export function leave(key: string) {
  const p = presence.get(key);
  if (!p) return;
  presence.delete(key);
  broadcast(p.server, { type: "leave", key });
}

export function leaveInstall(installId: string, characterKey?: string) {
  const normalized = installId.toLowerCase();
  for (const [key, player] of presence)
    if (player.installId.toLowerCase() === normalized && (!characterKey || characterKey === key)) leave(key);
}

/** Applies a stored batch to the live map. History and status-less pings never touch presence. */
export function applyBatch(b: Batch) {
  const now = Date.now();
  for (const p of b.pings) {
    if (b.historical || p.kind === "history" || !p.status) continue;
    const key = `${p.server}:${p.characterId}`;
    const prev = presence.get(key);
    if (p.status === "invisible") {
      leave(key);
      continue;
    }
    const cur: Presence = {
      key,
      server: p.server,
      characterId: p.characterId,
      name: p.characterName,
      cls: p.class ?? prev?.cls ?? null,
      disc: p.discipline ?? prev?.disc ?? null,
      areaId: p.areaId ?? prev?.areaId ?? null,
      areaName: p.areaName ?? prev?.areaName ?? null,
      x: p.x ?? prev?.x ?? 0,
      y: p.y ?? prev?.y ?? 0,
      h: p.h ?? prev?.h ?? 0,
      status: p.status,
      lfrp: p.lfrp,
      instance: p.instance ?? null,
      lastActive: Math.min(
        now,
        p.kind === "heartbeat" ? (prev?.lastActive ?? p.logTs ?? now) : Math.max(prev?.lastActive ?? 0, p.logTs ?? now),
      ),
      installId: b.installId,
    };
    if (cur.lastActive <= now - STALE_MS) {
      leave(key);
      continue;
    }
    presence.set(key, cur);
    broadcast(p.server, { type: "ping", player: publicView(cur) });
  }
}

/** Subscribes a socket to one server's room and sends it the current snapshot. */
export function join(server: string, socket: WebSocket) {
  const players = playersOn(server);
  (rooms.get(server) ?? rooms.set(server, new Set()).get(server)!).add(socket);
  socket.send(JSON.stringify({ type: "snapshot", players }));
  socket.on("close", () => {
    const room = rooms.get(server);
    room?.delete(socket);
    if (room && room.size === 0) rooms.delete(server);
  });
}

setInterval(() => {
  const cut = Date.now() - STALE_MS;
  for (const [k, p] of presence) if (p.lastActive < cut) leave(k);
}, 60_000).unref();
