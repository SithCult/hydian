import { create } from "zustand";
import { toast as sonner } from "sonner";
import {
  detectPaths,
  resolveLogsDir,
  roster,
  scanHistory,
  Tail,
  SERVER_NAMES,
  type CharacterSnapshot,
  type EncounterSnapshot,
  type History,
  type Paths,
  type RosterEntry,
} from "./core/gamelink";
import type { SessionState } from "./core/parser";
import { setShowPhases } from "./data/maps";
import {
  Uplink,
  pingFromSession,
  sightingFromSession,
  livePlayerToPlayer,
  fetchRegistry,
  registryToPlayer,
} from "./core/uplink";
import { Backfill, type BackfillState } from "./core/backfill";
import { applyStartMinimized, autostartEnabled, initAutostart, setAutostart } from "./core/startup";
import { OverlayHost, snapshot as overlaySnapshot, type OverlaySettings, loadOverlaySettings } from "./core/overlay";
import { locate } from "./data/maps";
import { loadMet, type MetIndex } from "./core/met";
import { appVersion, checkForUpdate, CHECK_EVERY_MS, installUpdate, restartApp, type UpdateState } from "./core/update";
import {
  deleteEntry,
  deleteNote,
  loadJournal,
  loadNotes,
  newEntryId,
  noteKeyByName,
  readGameNotes,
  saveEntry,
  saveNote,
  type JournalEntry,
  type PersonNote,
} from "./core/notes";
import { PLANETS, planetById, planetForArea } from "./data/planets";
import { DEFAULT_STATUS, type CharStatus, type Player, type RPStatus } from "./model";
import { selectMe, selectPlayersOn } from "./selectors";
import { DEMO, demoState } from "./core/demo";

export type LinkStatus = "idle" | "scanning" | "live" | "nolog" | "error";
export type View = "map" | "registry" | "journal";
export type Modal =
  | { kind: "profile"; key: string }
  | { kind: "settings" }
  | { kind: "characters" }
  | { kind: "notice" }
  | { kind: "offboard" }
  | null;
/** Bump when the wording of the first-run notice changes in substance; it is shown again. */
export const NOTICE_VERSION = 2;

type ToastKind = "info" | "ok" | "warn";

export interface AppState {
  paths: Paths | null;
  pathsCustom: Partial<Paths>; // user overrides, persisted
  link: { status: LinkStatus; file: string | null; progress: [number, number]; error?: string; lines: number };
  rosterList: RosterEntry[];
  myChars: CharacterSnapshot[];
  encounters: EncounterSnapshot[];
  live: SessionState | null;
  liveAt: number;
  scanMs: number;
  clock: number; // coarse now (30 s), drives presence expiry

  server: string;
  planet: string; // planet slug
  view: View;
  followMe: boolean;
  showSeen: boolean; // show players sighted in my own log (local only)
  showPhases: boolean; // show story-phase floors on maps
  heat: boolean; // RP heat layer on the map (aggregated server data)
  serverUrl: string; // the official Hydian backend
  share: boolean; // send my own character's pings
  uplink: { status: string; queued: number; sent: number; lastError: string; installId: string };
  overlay: OverlaySettings; // in-game overlay window
  friends: Record<string, { name: string; server: string; since: number; fromGame?: boolean; via?: string }>; // my friend list (local; only the edge goes to the server); via = the own character whose in-game list has them
  journalFocus: string | null; // an entry id the journal opens on next (an entry started from a profile)
  unfriended: Record<string, true>; // friends from the in-game list the user removed here: never re-added
  notes: Record<string, PersonNote>; // private notes about people (local only)
  journal: JournalEntry[]; // RP journal (local only), newest first
  met: MetIndex; // who I have met, from my own logs (local only)
  autostart: boolean; // launch at login (OS-level; mirrored from the plugin)
  startMinimized: boolean; // when launched at login, stay in the tray
  backfillOn: boolean; // upload the movement history from every log on disk (shared characters only)
  backfill: BackfillState;
  livePlayers: Record<string, Player>; // registered players from the backend, by key
  registry: Record<string, { at: number; players: Player[]; error: string | null }>; // per game server: everyone who ever shared here
  activeKey: string | null; // `${server}:${id}` of my active character
  charStatus: Record<string, CharStatus>; // per character key; missing = invisible (opt-in sharing)
  modal: Modal;
  hoverKey: string | null;
  membersOpen: boolean;
  search: string;
  version: string;
  legend: boolean; // the map legend, until dismissed
  update: UpdateState;

  boot(): Promise<void>;
  setPaths(p: Partial<Paths>): Promise<void>;
  resetPaths(): Promise<void>;
  rescan(): Promise<void>;
  selectServer(id: string): void;
  selectPlanet(slug: string): void;
  setView(v: View): void;
  setFollowMe(v: boolean): void;
  setShowSeen(v: boolean): void;
  setShowPhases(v: boolean): void;
  setHeat(v: boolean): void;
  acknowledgeNotice(): void;
  /** Offboarding: optional survey, then the deletion. Resolves with the server's counts, throws on failure. */
  deleteMyData(survey?: {
    reasons: string[];
    rating: number | null;
    comment: string;
  }): Promise<{ characters: number; pings: number; sightings: number }>;
  loadRegistry(server: string, force?: boolean): Promise<void>;
  setShare(v: boolean): void;
  setBackfill(v: boolean): void;
  setAutostart(v: boolean): Promise<void>;
  setOverlay(patch: Partial<OverlaySettings>): void;
  toggleFriend(key: string, name: string, server: string): void;
  /** Friends from the in-game friends list (read from its comments file, never written): added here once resolvable. */
  syncGameFriends(): void;
  /** A journal entry about this person, opened in the journal. */
  startEntryWith(p: Player): void;
  /** The note for a character; an imported name-keyed note is re-keyed to the id the first time we see it. */
  noteFor(key: string, name: string, server: string): PersonNote | undefined;
  putNote(n: PersonNote): Promise<void>;
  removeNote(key: string): Promise<void>;
  importGameNotes(): Promise<number>;
  putEntry(e: JournalEntry): Promise<void>;
  removeEntry(id: string): Promise<void>;
  setStartMinimized(v: boolean): void;
  setActive(key: string | null): void;
  setStatus(s: RPStatus): void;
  setLfrp(v: boolean): void;
  setInstance(v: number | null): void;
  openModal(m: Modal): void;
  setHover(k: string | null): void;
  toggleMembers(): void;
  setSearch(s: string): void;
  toast(text: string, kind?: ToastKind): void;
  checkUpdate(): Promise<void>;
  setLegend(v: boolean): void;
  restartToUpdate(): Promise<void>;
  tick(t: number): void;
}

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem("hydian:" + k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem("hydian:" + k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
};

let tail: Tail | null = null;
export const DEFAULT_SERVER_URL = "https://api-production-2fef.up.railway.app"; // hosted instance (Railway, project "hydian")
let uplink: Uplink | null = null;
let backfill: Backfill | null = null;
let overlayHost: OverlayHost | null = null;
let gameNames: { server: string; name: string; owner: string }[] = []; // names on my in-game friends lists, per server, and whose list
/** Push the planet-local view to the overlay whenever it could have changed (cheap: it diffs by content). */
function pushOverlay(get: () => AppState) {
  if (!overlayHost || !overlayHost.current.on) return;
  const s = get();
  const me = selectMe(s);
  const planetSlug = me?.planetId ? (planetForArea({ id: me.planetId, name: "" })?.slug ?? s.planet) : s.planet;
  const server = me?.server ?? s.server;
  const players = selectPlayersOn(s, server, planetSlug);
  const planet = planetBySlugSafe(planetSlug);
  const loc = (p: Player) => (p.z ? locate(p.planetId, p.x, p.y, p.z) : null);
  void overlayHost.push(overlaySnapshot(server, planet, me, players, loc, s.link.status, s.friends));
}
function planetBySlugSafe(slug: string) {
  const p = PLANETS.find((x) => x.slug === slug);
  return p ? p.name : null;
}
function startBackfill(get: () => AppState) {
  const dir = get().paths?.logsDir;
  // the run also builds the local "met" index, which needs no server; the uploads inside are gated per file
  if (backfill && dir && get().backfillOn) void backfill.run(dir);
}
let lastSent: { x: number; y: number } | null = null;
const MOVE_MIN = 50; // log units (5 m) before a move ping
/** Status of the character currently in the live log; invisible (default) means: send nothing. */
function liveStatus(get: () => AppState): CharStatus {
  const s = get().live;
  if (!s?.ownerId || !s.server) return DEFAULT_STATUS;
  return get().charStatus[`${s.server}:${s.ownerId}`] ?? DEFAULT_STATUS;
}
function pushUplinkState(set: (p: Partial<AppState>) => void) {
  if (!uplink) return;
  set({
    uplink: {
      status: uplink.status,
      queued: uplink.queued,
      sent: uplink.sent,
      lastError: uplink.lastError,
      installId: uplink.installId,
    },
  });
}
let booted = false;
let primedOnce = false; // first follow-me jump after catch-up

export const useApp = create<AppState>((set, get) => ({
  paths: null,
  pathsCustom: LS.get("paths", {}),
  link: { status: "idle", file: null, progress: [0, 0], lines: 0 },
  rosterList: [],
  myChars: [],
  encounters: [],
  live: null,
  liveAt: 0,
  scanMs: 0,
  clock: Date.now(),

  server: LS.get("server", "he4000"),
  planet: (() => {
    const v = LS.get("planet", "nar-shaddaa");
    return PLANETS.some((p) => p.slug === v) ? v : "nar-shaddaa";
  })(),
  view: "map",
  followMe: true,
  showSeen: LS.get("showSeen", true),
  showPhases: LS.get("showPhases", false),
  heat: LS.get("heat", false),
  registry: {},
  serverUrl: DEFAULT_SERVER_URL,
  share: true,
  uplink: { status: "off", queued: 0, sent: 0, lastError: "", installId: "" },
  overlay: loadOverlaySettings(),
  friends: LS.get("friends", LS.get("follows", {})), // "follows" was the old name of the same list
  unfriended: LS.get("unfriended", {}),
  journalFocus: null,
  notes: {},
  journal: [],
  met: loadMet(),
  autostart: false,
  startMinimized: LS.get("startMinimized", true),
  backfillOn: LS.get("backfillOn", true),
  backfill: { running: false, total: 0, done: 0, skipped: 0, pings: 0, sightings: 0, file: "", error: "" },
  livePlayers: {},
  activeKey: LS.get("activeKey", null),
  charStatus: LS.get("charStatus", {}),
  modal: null,
  hoverKey: null,
  membersOpen: innerWidth > 1180, // on a narrow window the panel floats over the map, so it starts closed
  search: "",
  version: "",
  legend: LS.get("legend", true),
  update: { phase: "idle" },

  async boot() {
    if (DEMO) set(demoState());
    if (booted) return;
    booted = true;
    if (!DEMO && LS.get("noticeSeen", 0) < NOTICE_VERSION) set({ modal: { kind: "notice" } });
    void initAutostart().then(async (err) => {
      if (err) get().toast(`Launch at startup not registered: ${err}`, "warn");
      set({ autostart: await autostartEnabled() });
    });
    void applyStartMinimized(get().startMinimized);
    void appVersion().then((version) => set({ version }));
    // updates: first look shortly after start, then every few hours while the app sits in the tray
    setTimeout(() => void get().checkUpdate(), 15_000);
    setInterval(() => void get().checkUpdate(), CHECK_EVERY_MS);
    if (!DEMO) {
      void loadNotes().then((notes) => set({ notes }));
      void loadJournal().then((journal) => set({ journal }));
    }
    overlayHost = new OverlayHost();
    overlayHost.onSettings = (overlay) => {
      set({ overlay });
      pushOverlay(get);
    };
    void overlayHost.init().then(() => pushOverlay(get));
    setInterval(() => pushOverlay(get), 2_000);
    setShowPhases(get().showPhases);
    uplink = new Uplink(get().serverUrl, get().share);
    uplink.onState = () => pushUplinkState(set);
    uplink.onConflict = (ids) => {
      const names = ids.map((id) => get().myChars.find((c) => c.id === id)?.name ?? id).join(", ");
      get().toast(
        `${names}: already shared from another device. This one takes over after a day of silence there.`,
        "warn",
      );
    };
    uplink.onLive = (msg) => {
      const before = get().livePlayers,
        live = { ...before };
      if (msg.type === "snapshot") {
        for (const k of Object.keys(live)) delete live[k];
        for (const p of msg.players) live[p.key] = livePlayerToPlayer(p);
      } else if (msg.type === "ping") live[msg.player.key] = livePlayerToPlayer(msg.player);
      else if (msg.type === "leave") delete live[msg.key];
      set({ livePlayers: live });
      // friends: tell me when they show up or start looking for RP
      const friends = get().friends;
      for (const [k, p] of Object.entries(live)) {
        if (!friends[k]) continue;
        const was = before[k];
        const planet = p.planetId
          ? (planetForArea({ id: p.planetId, name: p.areaName })?.name ?? p.areaName)
          : p.areaName;
        if (!was) get().toast(`${p.name} is on Hydian: ${planet}`, "ok");
        else if (p.lfrp && !was.lfrp) get().toast(`${p.name} is looking for RP on ${planet}`, "ok");
      }
    };
    uplink.subscribe(get().server);
    pushUplinkState(set);
    void get().loadRegistry(get().server);
    setInterval(() => void get().loadRegistry(get().server), 60_000);
    backfill = new Backfill(
      uplink,
      (server, id) => (get().charStatus[`${server}:${id}`]?.status ?? "invisible") !== "invisible",
    );
    backfill.onState = () => set({ backfill: { ...backfill!.state } });
    backfill.onMet = (met) => set({ met: { ...met } });
    setTimeout(() => startBackfill(get), 20_000); // after the live link has settled
    // heartbeat while the game link is live (keeps presence alive through quiet RP)
    setInterval(() => {
      const s = get().live;
      if (!s?.ownerId || !uplink) return;
      const st = liveStatus(get);
      if (st.status === "invisible") return;
      if (Date.now() - (s.pos?.atMs ?? 0) > 45 * 60_000) return;
      const p = pingFromSession("heartbeat", s, st.status, st.lfrp, undefined, st.instance ?? null);
      if (p) {
        uplink.push(p);
        pushUplinkState(set);
      }
    }, 30_000);
    if (DEMO) return;
    try {
      const custom = { ...get().pathsCustom };
      const detected = await detectPaths();
      if (custom.logsDir) {
        const r = await resolveLogsDir(custom.logsDir);
        if (r.note) get().toast(r.note, "warn");
        if (r.dir === detected.logsDir) delete custom.logsDir;
        else custom.logsDir = r.dir;
      }
      const paths = { ...detected, ...custom };
      set({ paths, pathsCustom: custom });
      LS.set("paths", custom);
      await get().rescan();
    } catch (e) {
      set({ link: { ...get().link, status: "error", error: String(e) } });
    }
  },

  async setPaths(p) {
    if (p.logsDir) {
      const r = await resolveLogsDir(p.logsDir);
      if (r.note) get().toast(r.note, "warn");
      if (r.dir === (await detectPaths()).logsDir) {
        const { logsDir: _drop, ...rest } = get().pathsCustom;
        set({ pathsCustom: rest });
        p = { ...p, logsDir: r.dir };
      } else p = { ...p, logsDir: r.dir };
    }
    const pathsCustom = { ...get().pathsCustom, ...p };
    set({ pathsCustom, paths: { ...(get().paths ?? (await detectPaths())), ...p } });
    LS.set("paths", pathsCustom);
    startBackfill(get);
    await get().rescan();
  },
  async resetPaths() {
    set({ pathsCustom: {}, paths: await detectPaths() });
    LS.set("paths", {});
    await get().rescan();
  },

  async rescan() {
    const { paths } = get();
    if (!paths) return;
    tail?.stop();
    tail = null;
    set({ link: { status: "scanning", file: null, progress: [0, 0], lines: 0 }, live: null });
    const t0 = performance.now();
    let ros: RosterEntry[], hist: History;
    try {
      [ros, hist] = await Promise.all([
        roster(paths.settingsDir),
        scanHistory(paths.logsDir, {}, (d, t) => set({ link: { ...get().link, progress: [d, t] } })),
      ]);
    } catch (e) {
      set({ link: { ...get().link, status: "error", error: String((e as Error)?.message ?? e) } });
      return;
    }
    set({
      rosterList: ros,
      myChars: hist.characters,
      encounters: hist.encounters,
      scanMs: Math.round(performance.now() - t0),
    });
    void get()
      .importGameNotes()
      .then((n) => {
        if (n) get().toast(`Imported ${n} note${n === 1 ? "" : "s"} from your in-game friends list`, "ok");
      })
      .catch(() => {
        /* optional */
      });
    if (!get().activeKey && hist.characters.length) {
      const c = hist.characters.sort((a, b) => b.lastSeen - a.lastSeen)[0];
      set({ activeKey: `${c.server}:${c.id}` });
    }
    tail = new Tail(paths.logsDir, {
      onFile: (name) => set({ link: { ...get().link, status: "live", file: name } }),
      onNoLog: () => set({ link: { ...get().link, status: "nolog", file: null } }),
      onOwner: (s, raw) => {
        const key = `${s.server ?? get().server}:${s.ownerId}`;
        set({ activeKey: key, live: { ...s } });
        LS.set("activeKey", key);
        if (tail?.primed && uplink) {
          const st = liveStatus(get);
          if (st.status !== "invisible") {
            const p = pingFromSession("login", s, st.status, st.lfrp, raw, st.instance ?? null);
            if (p) uplink.push(p);
          }
        }
        if (tail?.primed) get().toast(`Linked: ${s.ownerName} on ${SERVER_NAMES[s.server ?? ""] ?? s.server}`, "ok");
        if (s.server && get().followMe) get().selectServer(s.server);
      },
      onArea: (area, s, raw) => {
        set({ live: { ...s } });
        // a zone change invalidates a hand-set instance number
        if (tail?.primed && s.server && s.ownerId) {
          const key = `${s.server}:${s.ownerId}`;
          const cur = get().charStatus[key];
          if (cur?.instance) {
            const charStatus = { ...get().charStatus, [key]: { ...cur, instance: null } };
            set({ charStatus });
            LS.set("charStatus", charStatus);
          }
        }
        if (tail?.primed && uplink) {
          const st = liveStatus(get);
          if (st.status !== "invisible") {
            const p = pingFromSession("area", s, st.status, st.lfrp, raw, st.instance ?? null);
            if (p) {
              uplink.push(p);
              lastSent = s.pos ? { x: s.pos.x, y: s.pos.y } : null;
            }
          }
        }
        const p = planetForArea(area);
        if (p && get().followMe) {
          get().selectPlanet(p.slug);
          if (tail?.primed) get().toast(`Arrived: ${area.name}${area.mode ? " · " + area.mode : ""}`);
        }
      },
      onPos: (pos, s, raw) => {
        if (!tail?.primed || !uplink) return;
        const st = liveStatus(get);
        if (st.status === "invisible") return;
        if (lastSent && Math.hypot(pos.x - lastSent.x, pos.y - lastSent.y) < MOVE_MIN) return;
        const p = pingFromSession("move", s, st.status, st.lfrp, raw, st.instance ?? null);
        if (p) {
          uplink.push(p);
          lastSent = { x: pos.x, y: pos.y };
        }
      },
      onSighting: (sg, isNew, s, raw) => {
        if (tail?.primed && isNew && s.server) {
          const key = `${s.server}:${sg.id}`,
            f = get().friends[key];
          if (f) get().toast(`${f.name} is nearby: ${s.area?.name ?? "same area"}`, "ok");
        }
        if (!tail?.primed || !uplink || !get().share || liveStatus(get).status === "invisible") return;
        const o = sightingFromSession(sg, s, raw);
        if (o && isNew) uplink.pushSighting(o);
      },
      onTick: (s) => {
        set({ live: { ...s }, liveAt: Date.now(), link: { ...get().link, lines: s.lines } });
        if (tail?.primed && get().followMe && s.area) {
          const p = planetForArea(s.area);
          if (p && get().planet !== p.slug && !primedOnce) {
            primedOnce = true;
            get().selectPlanet(p.slug);
          }
        }
      },
      onError: (e) => set({ link: { ...get().link, status: "error", error: String(e) } }),
    });
    tail.start();
  },

  selectServer(id) {
    set({ server: id });
    LS.set("server", id);
    uplink?.subscribe(id);
    void get().loadRegistry(id);
  },
  selectPlanet(slug) {
    set({ planet: slug, view: "map" });
    LS.set("planet", slug);
  },
  setView(view) {
    set({ view });
  },
  setFollowMe(followMe) {
    set({ followMe });
  },
  setShowSeen(showSeen) {
    set({ showSeen });
    LS.set("showSeen", showSeen);
  },
  setShowPhases(showPhases) {
    setShowPhases(showPhases);
    set({ showPhases });
    LS.set("showPhases", showPhases);
  },
  setHeat(heat) {
    set({ heat });
    LS.set("heat", heat);
  },
  setLegend(legend) {
    set({ legend });
    LS.set("legend", legend);
  },
  async checkUpdate() {
    if (get().update.phase !== "idle" && get().update.phase !== "error") return;
    const state = await checkForUpdate();
    set({ update: state });
    if (state.phase === "available") await installUpdate((update) => set({ update }));
  },
  async restartToUpdate() {
    await restartApp();
  },
  acknowledgeNotice() {
    LS.set("noticeSeen", NOTICE_VERSION);
    set({ modal: null });
  },
  async deleteMyData(survey) {
    if (!uplink) throw new Error("not connected");
    if (survey && (survey.reasons.length || survey.rating || survey.comment))
      await uplink.feedback("offboarding", survey.reasons, survey.rating, survey.comment);
    const r = await uplink.deleteMyData();
    // every character goes back to Invisible; nothing is sent again until the user opts in anew
    const charStatus: Record<string, CharStatus> = {};
    set({ charStatus, livePlayers: {}, registry: {} });
    LS.set("charStatus", charStatus);
    return r;
  },
  async loadRegistry(server, force = false) {
    const cur = get().registry[server];
    if (!force && cur && Date.now() - cur.at < 60_000) return;
    if (!get().serverUrl) return;
    try {
      const list = await fetchRegistry(get().serverUrl, server);
      set({
        registry: { ...get().registry, [server]: { at: Date.now(), players: list.map(registryToPlayer), error: null } },
      });
      get().syncGameFriends();
    } catch (e) {
      set({
        registry: {
          ...get().registry,
          [server]: { at: Date.now(), players: cur?.players ?? [], error: String((e as Error).message ?? e) },
        },
      });
    }
  },
  setActive(activeKey) {
    set({ activeKey });
    LS.set("activeKey", activeKey);
  },
  setStatus(status) {
    const key = get().activeKey;
    if (!key) return;
    const cur = get().charStatus[key] ?? DEFAULT_STATUS;
    const charStatus = { ...get().charStatus, [key]: { ...cur, status } };
    set({ charStatus });
    LS.set("charStatus", charStatus);
    if (cur.status === "invisible" && status !== "invisible") {
      const [srv, id] = key.split(":");
      backfill?.release(srv, id);
      startBackfill(get);
    }
    const s = get().live;
    if (s?.ownerId && uplink && `${s.server}:${s.ownerId}` === key) {
      const p = pingFromSession("status", s, status, charStatus[key].lfrp, undefined, charStatus[key].instance ?? null);
      if (p) {
        uplink.push(p);
        pushUplinkState(set);
      }
    }
  },
  setLfrp(lfrp) {
    const key = get().activeKey;
    if (!key) return;
    const cur = get().charStatus[key] ?? DEFAULT_STATUS;
    const charStatus = { ...get().charStatus, [key]: { ...cur, lfrp } };
    set({ charStatus });
    LS.set("charStatus", charStatus);
    const s = get().live;
    if (cur.status !== "invisible" && s?.ownerId && uplink && `${s.server}:${s.ownerId}` === key) {
      const p = pingFromSession("status", s, cur.status, lfrp, undefined, cur.instance ?? null);
      if (p) {
        uplink.push(p);
        pushUplinkState(set);
      }
    }
  },
  setInstance(instance) {
    const key = get().activeKey;
    if (!key) return;
    const cur = get().charStatus[key] ?? DEFAULT_STATUS;
    const charStatus = { ...get().charStatus, [key]: { ...cur, instance } };
    set({ charStatus });
    LS.set("charStatus", charStatus);
    const s = get().live;
    if (cur.status !== "invisible" && s?.ownerId && uplink && `${s.server}:${s.ownerId}` === key) {
      const p = pingFromSession("status", s, cur.status, cur.lfrp, undefined, instance);
      if (p) {
        uplink.push(p);
        pushUplinkState(set);
      }
    }
  },
  setShare(share) {
    set({ share });
    LS.set("share", share);
    uplink?.configure(get().serverUrl, share);
    uplink?.subscribe(get().server);
    if (share) startBackfill(get);
  },
  async setAutostart(autostart) {
    try {
      await setAutostart(autostart);
    } catch (e) {
      get().toast(`Could not change launch at startup: ${String((e as Error).message ?? e)}`, "warn");
    }
    set({ autostart: await autostartEnabled() });
  },
  setStartMinimized(startMinimized) {
    set({ startMinimized });
    LS.set("startMinimized", startMinimized);
  },
  setOverlay(patch) {
    void overlayHost?.set(patch);
  },
  toggleFriend(key, name, server) {
    const friends = { ...get().friends };
    const adding = !friends[key];
    if (adding) friends[key] = { name, server, since: Date.now() };
    else {
      if (friends[key].fromGame) {
        const unfriended = { ...get().unfriended, [key]: true as const };
        set({ unfriended });
        LS.set("unfriended", unfriended);
      }
      delete friends[key];
    }
    set({ friends });
    LS.set("friends", friends);
    const id = key.split(":")[1];
    if (id && !id.startsWith("@")) void uplink?.friend(server, id, adding ? "add" : "remove");
  },
  noteFor(key, name, server) {
    const notes = get().notes;
    if (notes[key]) return notes[key];
    const byName = notes[noteKeyByName(server, name)];
    if (byName && !key.includes("@")) {
      const moved = { ...byName, key };
      void get().putNote(moved);
      void deleteNote(byName.key);
      const n = { ...notes };
      delete n[byName.key];
      n[key] = moved;
      set({ notes: n });
      return moved;
    }
    return byName;
  },
  async putNote(n) {
    set({ notes: { ...get().notes, [n.key]: n } });
    await saveNote(n);
  },
  async removeNote(key) {
    const n = { ...get().notes };
    delete n[key];
    set({ notes: n });
    await deleteNote(key);
  },
  syncGameFriends() {
    if (!gameNames.length) return;
    const { friends: cur, unfriended, met, livePlayers, registry, server } = get();
    const friends = { ...cur };
    const added: string[] = [];
    for (const g of gameNames) {
      const lower = g.name.toLowerCase();
      const key =
        Object.keys(livePlayers).find(
          (k) => k.startsWith(g.server + ":") && livePlayers[k].name.toLowerCase() === lower,
        ) ??
        (registry[g.server]?.players ?? []).find((p) => p.name.toLowerCase() === lower)?.key ??
        Object.entries(met).find(
          ([k, m]) => m.server === g.server && m.name.toLowerCase() === lower && k.startsWith(g.server + ":"),
        )?.[0];
      if (!key || friends[key] || unfriended[key]) continue;
      friends[key] = { name: g.name, server: g.server, since: Date.now(), fromGame: true, via: g.owner };
      added.push(key);
    }
    if (!added.length) return;
    set({ friends });
    LS.set("friends", friends);
    for (const key of added) {
      const [srv, id] = key.split(":");
      if (id && !id.startsWith("@")) void uplink?.friend(srv, id, "add");
    }
    const here = added.filter((k) => k.startsWith(server + ":")).length;
    if (here) get().toast(`${here} friend${here === 1 ? "" : "s"} from your in-game list`, "ok");
  },
  startEntryWith(p) {
    const me = selectMe(get());
    const planet = p.planetId ? planetById(p.planetId) : undefined;
    const loc = !p.isSeen && p.z ? locate(p.planetId, p.x, p.y, p.z) : null;
    const e: JournalEntry = {
      id: newEntryId(),
      title: "",
      at: Date.now(),
      updated: Date.now(),
      doc: null,
      text: "",
      planetId: me?.planetId ?? planet?.id ?? null,
      where: loc ? loc.path.join(" › ") : (planet?.name ?? null),
      people: [{ key: p.key, name: p.name, server: p.server }],
      tags: [],
    };
    void get().putEntry(e);
    set({ journalFocus: e.id, view: "journal", modal: null });
  },
  async importGameNotes() {
    const dir = get().paths?.settingsDir;
    if (!dir) return 0;
    const game = await readGameNotes(dir);
    // every name with a comment is on that character's in-game friends list
    const seenNames = new Set<string>();
    gameNames = game.filter((g) => {
      const k = `${g.server}:${g.name.toLowerCase()}`;
      if (seenNames.has(k)) return false;
      seenNames.add(k);
      return true;
    });
    const notes = { ...get().notes };
    const met = get().met;
    let added = 0;
    const idFor = (server: string, name: string) =>
      Object.entries(met).find(
        ([k, m]) => m.server === server && m.name.toLowerCase() === name.toLowerCase() && k.startsWith(server + ":"),
      )?.[0];
    for (const g of game) {
      const key = idFor(g.server, g.name) ?? noteKeyByName(g.server, g.name);
      const existing = notes[key] ?? notes[noteKeyByName(g.server, g.name)];
      if (existing) {
        // the game note changed since the import and the user never edited ours: refresh the imported copy
        if (existing.imported && existing.doc === null && existing.imported.text !== g.text) {
          const n = { ...existing, text: g.text, imported: { ...existing.imported, text: g.text, at: Date.now() } };
          notes[n.key] = n;
          await saveNote(n);
        }
        continue;
      }
      const n: PersonNote = {
        key,
        name: g.name,
        server: g.server,
        doc: null,
        text: g.text,
        updated: Date.now(),
        imported: { from: g.owner, at: Date.now(), text: g.text },
      };
      notes[key] = n;
      await saveNote(n);
      added++;
    }
    set({ notes });
    get().syncGameFriends();
    return added;
  },
  async putEntry(e) {
    const list = get().journal.filter((x) => x.id !== e.id);
    set({ journal: [e, ...list].sort((a, b) => b.at - a.at) });
    await saveEntry(e);
  },
  async removeEntry(id) {
    set({ journal: get().journal.filter((x) => x.id !== id) });
    await deleteEntry(id);
  },
  setBackfill(backfillOn) {
    set({ backfillOn });
    LS.set("backfillOn", backfillOn);
    if (backfillOn) startBackfill(get);
    else backfill?.cancel();
  },
  openModal(modal) {
    set({ modal });
  },
  setHover(hoverKey) {
    if (get().hoverKey !== hoverKey) set({ hoverKey });
  },
  toggleMembers() {
    set({ membersOpen: !get().membersOpen });
  },
  setSearch(search) {
    set({ search });
  },
  toast(text, kind = "info") {
    if (kind === "ok") sonner.success(text);
    else if (kind === "warn") sonner.warning(text);
    else sonner(text);
  },
  tick(t) {
    if (t - get().clock > 30_000) set({ clock: t });
  }, // coarse clock for presence fades
}));
