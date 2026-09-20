// Derived views of the store. Memoised on their inputs so zustand sees stable references (v5 uses
// useSyncExternalStore, and a selector that returns a fresh array on every call makes it loop).
import type { AppState } from "./store";
import type { CharacterSnapshot } from "./core/gamelink";
import type { SessionState } from "./core/parser";
import { PLANETS, planetForArea } from "./data/planets";
import { isPublicPlayer, hueOf, DEFAULT_STATUS, type CharStatus, type Player } from "./model";

function memo<A extends unknown[], R>(fn: (...a: A) => R) {
  let last: A | null = null,
    res: R;
  return (...a: A): R => {
    if (last && last.length === a.length && last.every((v, i) => v === a[i])) return res;
    last = a;
    res = fn(...a);
    return res;
  };
}

const meImpl = memo(
  (
    activeKey: string | null,
    myChars: CharacterSnapshot[],
    live: SessionState | null,
    charStatus: Record<string, CharStatus>,
    liveAt: number,
  ): Player | null => {
    const st = (activeKey && charStatus[activeKey]) || DEFAULT_STATUS;
    if (!activeKey) return null;
    const snap = myChars.find((c) => `${c.server}:${c.id}` === activeKey);
    const isLive = !!live?.ownerId && `${live.server}:${live.ownerId}` === activeKey;
    const area = isLive ? live!.area : (snap?.area ?? null);
    const pos = isLive ? (live!.pos ?? snap?.pos ?? null) : (snap?.pos ?? null);
    const [server, id] = activeKey.split(":");
    const name = isLive ? live!.ownerName! : (snap?.name ?? "?");
    const planet = planetForArea(area);
    return {
      key: activeKey,
      id,
      name,
      server,
      cls: isLive ? live!.cls : (snap?.cls ?? null),
      disc: isLive ? live!.disc : (snap?.disc ?? null),
      planetId: planet?.id ?? (planet ? `slug:${planet.slug}` : null),
      areaName: area?.name ?? "Unknown",
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
      z: pos?.z ?? 0,
      heading: pos?.heading ?? 0,
      status: st.status,
      lfrp: st.lfrp,
      instance: st.instance ?? null,
      hue: hueOf(id),
      lastActive: isLive ? (live!.pos?.atMs ?? liveAt) : (snap?.lastEventMs ?? snap?.lastSeen ?? 0),
      isMe: true,
    };
  },
);
/** My active character as a map player (live or last-known position). */
export const selectMe = (s: AppState) => meImpl(s.activeKey, s.myChars, s.live, s.charStatus, s.liveAt);
export const selectMyStatus = (s: AppState): CharStatus => (s.activeKey && s.charStatus[s.activeKey]) || DEFAULT_STATUS;

/** Own snapshots stay private; only a current live session can add an own public row. */
function publicPlayers(s: AppState, includeRegistry: boolean): Player[] {
  const byKey = new Map<string, Player>();
  if (includeRegistry) for (const r of Object.values(s.registry)) for (const p of r.players) byKey.set(p.key, p);
  for (const p of Object.values(s.livePlayers)) byKey.set(p.key, p);
  const ownKeys = new Set([
    ...s.myChars.map((c) => `${c.server}:${c.id}`),
    ...Object.keys(s.charStatus),
    ...s.uplink.removedCharacters,
  ]);
  if (s.activeKey) ownKeys.add(s.activeKey);
  for (const key of ownKeys) byKey.delete(key);
  const me = selectMe(s);
  if (
    me &&
    s.share &&
    s.live?.ownerId &&
    `${s.live.server}:${s.live.ownerId}` === me.key &&
    !s.uplink.removedCharacters.includes(me.key)
  )
    byKey.set(me.key, me);
  return [...byKey.values()].filter((p) => isPublicPlayer(p, s.clock));
}
const publicRegistry = memo((s: AppState) => publicPlayers(s, true));
const publicLive = memo((s: AppState) => publicPlayers(s, false));
const registeredImpl = memo((players: Player[], server: string) => players.filter((p) => p.server === server));
/** Current, opted-in presence, including the registry snapshot while the live connection catches up. */
export const selectRegistered = (s: AppState, server: string) => registeredImpl(publicRegistry(s), server);
const liveImpl = memo((players: Player[], server: string, activeKey: string | null) =>
  players.filter((p) => p.server === server && p.key !== activeKey),
);
export const selectLive = (s: AppState, server: string) => liveImpl(publicLive(s), server, s.activeKey);

const playersImpl = memo((players: Player[], server: string, planetSlug: string): Player[] => {
  const planet = PLANETS.find((p) => p.slug === planetSlug);
  if (!planet) return [];
  const pid = planet.id ?? `slug:${planet.slug}`;
  return players.filter((p) => p.server === server && p.planetId === pid);
});
export const selectPlayersOn = (s: AppState, server: string, planetSlug: string) =>
  playersImpl(publicLive(s), server, planetSlug);

const countsImpl = memo((players: Player[], server: string) => {
  const byServer: Record<string, number> = {},
    byPlanet: Record<string, number> = {};
  for (const p of players) {
    byServer[p.server] = (byServer[p.server] ?? 0) + 1;
    if (p.server === server && p.planetId) byPlanet[p.planetId] = (byPlanet[p.planetId] ?? 0) + 1;
  }
  return { byServer, byPlanet };
});
export const selectCounts = (s: AppState) => countsImpl(publicLive(s), s.server);
