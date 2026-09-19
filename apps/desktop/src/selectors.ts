// Derived views of the store. Memoised on their inputs so zustand sees stable references (v5 uses
// useSyncExternalStore, and a selector that returns a fresh array on every call makes it loop).
import type { AppState } from "./store";
import type { CharacterSnapshot } from "./core/gamelink";
import type { SessionState } from "./core/parser";
import { PLANETS, planetForArea } from "./data/planets";
import { presenceOf, hueOf, DEFAULT_STATUS, type CharStatus, type Player, type RPStatus } from "./model";

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

/** Players my own log sighted in the current live area (targeting, group play). Local only. */
const seenImpl = memo((live: SessionState | null, liveAt: number): Player[] => {
  if (!live?.area || !live.server) return [];
  void liveAt;
  const planet = planetForArea(live.area);
  const pid = planet?.id ?? (planet ? `slug:${planet.slug}` : null);
  if (!pid) return [];
  return [...live.sightings.values()].map((sg) => ({
    key: `${live.server}:${sg.id}`,
    id: sg.id,
    name: sg.name,
    server: live.server!,
    cls: null,
    disc: null,
    planetId: pid,
    areaName: live.area!.name,
    x: sg.x,
    y: sg.y,
    z: sg.z,
    heading: 0,
    status: "ooc" as RPStatus,
    hue: (Number(sg.id.slice(-3)) * 11) % 360,
    lastActive: sg.atMs,
    isSeen: true,
  }));
});
export const selectSeen = (s: AppState) => seenImpl(s.live, s.liveAt);

const NO_PLAYERS: Player[] = []; // stable empty value: a fresh [] would defeat the memo and loop the store
const NO_KEYS = new Set<string>();
/** Everyone who ever shared a character on a server: a sighting of one of them is never shown. They decide. */
const registeredImpl = memo((players: Player[] | undefined): Set<string> =>
  players ? new Set(players.map((p) => p.key)) : NO_KEYS,
);
const playersImpl = memo(
  (
    me: Player | null,
    seen: Player[],
    live: Record<string, Player>,
    registered: Set<string>,
    server: string,
    planetSlug: string,
    now: number,
  ): Player[] => {
    const p = PLANETS.find((x) => x.slug === planetSlug);
    if (!p) return [];
    const pid = p.id ?? `slug:${p.slug}`;
    const out: Player[] = [];
    // presence rule: nobody is shown after PRESENCE.staleMs without a log event
    if (
      me &&
      me.server === server &&
      me.planetId === pid &&
      me.status !== "invisible" &&
      presenceOf(me.lastActive, now) !== "gone"
    )
      out.push(me);
    for (const lp of Object.values(live))
      if (
        lp.server === server &&
        lp.planetId === pid &&
        lp.key !== me?.key &&
        presenceOf(lp.lastActive, now) !== "gone"
      )
        out.push(lp);
    // sightings only for people who are not on Hydian: someone who shares a character chose what to show,
    // and Invisible means invisible, also to the logs of others
    for (const sg of seen)
      if (
        sg.server === server &&
        sg.planetId === pid &&
        sg.key !== me?.key &&
        !live[sg.key] &&
        !registered.has(sg.key) &&
        presenceOf(sg.lastActive, now) !== "gone"
      )
        out.push(sg);
    return out;
  },
);
export const selectPlayersOn = (s: AppState, server: string, planetSlug: string) =>
  playersImpl(
    selectMe(s),
    s.showSeen ? selectSeen(s) : NO_PLAYERS,
    s.livePlayers,
    registeredImpl(s.registry[server]?.players),
    server,
    planetSlug,
    s.clock,
  );

const countsImpl = memo((me: Player | null, live: Record<string, Player>, server: string) => {
  const byServer: Record<string, number> = {},
    byPlanet: Record<string, number> = {};
  const add = (p: Player) => {
    byServer[p.server] = (byServer[p.server] ?? 0) + 1;
    if (p.server === server && p.planetId) byPlanet[p.planetId] = (byPlanet[p.planetId] ?? 0) + 1;
  };
  for (const lp of Object.values(live)) if (lp.key !== me?.key) add(lp);
  if (me && me.status !== "invisible") add(me);
  return { byServer, byPlanet };
});
export const selectCounts = (s: AppState) => countsImpl(selectMe(s), s.livePlayers, s.server);
/** Registered players from the backend for a server (excluding me). */
const liveImpl = memo((live: Record<string, Player>, server: string, activeKey: string | null) =>
  Object.values(live).filter((p) => p.server === server && p.key !== activeKey),
);
export const selectLive = (s: AppState, server: string) => liveImpl(s.livePlayers, server, s.activeKey);
