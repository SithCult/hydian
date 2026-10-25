import { create } from "zustand";
import { toast as sonner } from "sonner";
import {
  detectPaths,
  gameLinkFailure,
  type GameLinkIssue,
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
import { newSession, type SessionState } from "./core/parser";
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
import { applyStartMinimized, autostartEnabled, initAutostart, setAutostart, setTrayVisible } from "./core/startup";
import { isTauri } from "./core/fs";
import { IS_MAC } from "./core/platform";
import { OverlayHost, snapshot as overlaySnapshot, type OverlaySettings, loadOverlaySettings } from "./core/overlay";
import { locate } from "./data/maps";
import { loadMet, type MetIndex } from "./core/met";
import {
  appVersion,
  checkForUpdate,
  CHECK_EVERY_MS,
  downloadUpdate,
  restartApp,
  type UpdateState,
} from "./core/update";
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
import { isPublicPlayer, DEFAULT_STATUS, type CharStatus, type Player, type RPStatus } from "./model";
import { selectMe, selectPlayersOn } from "./selectors";
import { DEMO, demoState } from "./core/demo";

export type LinkStatus = "idle" | "scanning" | "live" | "nolog" | "error";
export type View = "map" | "registry" | "journal" | "tools";
export type ToolId = "chat-colors";
export type SettingsTab = "game" | "overlay" | "startup" | "map" | "privacy" | "about";
export type Modal =
  | { kind: "profile"; key: string }
  | { kind: "settings"; tab?: SettingsTab }
  | { kind: "characters" }
  | { kind: "notice" }
  | { kind: "offboard" }
  | null;
/** Bump when the wording of the first-run notice changes in substance; it is shown again. */
export const NOTICE_VERSION = 3;

type ToastKind = "info" | "ok" | "warn";

export interface AppState {
  paths: Paths | null;
  pathsCustom: Partial<Paths>; // user overrides, persisted
  link: {
    status: LinkStatus;
    file: string | null;
    progress: [number, number];
    error?: string;
    issue?: GameLinkIssue;
    lines: number;
  };
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
  tool: ToolId; // the open tool in the Tools view
  followMe: boolean;
  showPhases: boolean; // show story-phase floors on maps
  heat: boolean; // RP heat layer on the map (aggregated server data)
  serverUrl: string; // the official Hydian backend
  share: boolean; // send my own character's pings
  uplink: {
    status: string;
    queued: number;
    sent: number;
    lastError: string;
    installId: string;
    removedCharacters: string[];
  };
  overlay: OverlaySettings; // in-game overlay window
  friends: Record<string, { name: string; server: string; since: number; fromGame?: boolean; via?: string }>; // my friend list (local; only the edge goes to the server); via = the own character whose in-game list has them
  journalFocus: string | null; // an entry id the journal opens on next (an entry started from a profile)
  unfriended: Record<string, true>; // friends from the in-game list the user removed here: never re-added
  notes: Record<string, PersonNote>; // private notes about people (local only)
  journal: JournalEntry[]; // RP journal (local only), newest first
  met: MetIndex; // who I have met, from my own logs (local only)
  autostart: boolean; // launch at login (OS-level; mirrored from the plugin)
  startMinimized: boolean; // when launched at login, keep the main window hidden
  trayIconVisible: boolean;
  trayIconChanging: boolean;
  backfillOn: boolean; // upload the movement history from every log on disk (shared characters only)
  backfill: BackfillState;
  livePlayers: Record<string, Player>; // registered players from the backend, by key
  registry: Record<string, { at: number; players: Player[]; error: string | null }>; // current public presence per game server
  activeKey: string | null; // `${server}:${id}` of my active character
  characterActions: Record<string, "removing" | "sharing">;
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
  setTool(t: ToolId): void;
  setFollowMe(v: boolean): void;
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
  setTrayIconVisible(v: boolean): Promise<void>;
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
  setStatus(s: RPStatus): Promise<void>;
  removeCharacter(key: string): Promise<void>;
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
let linkOperation = 0;
export const DEFAULT_SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "https://api.hydian.org";
let uplink: Uplink | null = null;
let backfill: Backfill | null = null;
let erasingData = false;
let presenceRevision = 0;
const registryRequests = new Map<string, number>();
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
  if (erasingData) return;
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
      removedCharacters: uplink.removedCharacters,
    },
  });
}
function withoutPublicCharacter(s: AppState, key: string) {
  const livePlayers = { ...s.livePlayers };
  delete livePlayers[key];
  const registry = Object.fromEntries(
    Object.entries(s.registry).map(([server, entry]) => [
      server,
      { ...entry, players: entry.players.filter((p) => p.key !== key) },
    ]),
  );
  return { livePlayers, registry };
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
  tool: "chat-colors",
  followMe: true,
  showPhases: LS.get("showPhases", false),
  heat: LS.get("heat", false),
  registry: {},
  serverUrl: DEFAULT_SERVER_URL,
  share: LS.get("share", true),
  uplink: { status: "off", queued: 0, sent: 0, lastError: "", installId: "", removedCharacters: [] },
  overlay: loadOverlaySettings(),
  friends: LS.get("friends", LS.get("follows", {})), // "follows" was the old name of the same list
  unfriended: LS.get("unfriended", {}),
  journalFocus: null,
  notes: {},
  journal: [],
  met: loadMet(),
  autostart: false,
  startMinimized: LS.get("startMinimized", true),
  trayIconVisible: true,
  trayIconChanging: false,
  backfillOn: LS.get("backfillOn", true),
  backfill: { running: false, total: 0, done: 0, skipped: 0, pings: 0, sightings: 0, file: "", error: "" },
  livePlayers: {},
  activeKey: LS.get("activeKey", null),
  characterActions: {},
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
    void get().setTrayIconVisible(LS.get<boolean>("trayIconVisible", true) !== false);
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
      presenceRevision++;
      const before = get().livePlayers,
        live = { ...before };
      if (msg.type === "snapshot") {
        for (const k of Object.keys(live)) delete live[k];
        for (const p of msg.players) {
          const player = livePlayerToPlayer(p);
          if (isPublicPlayer(player)) live[p.key] = player;
        }
      } else if (msg.type === "ping") {
        const player = livePlayerToPlayer(msg.player);
        if (isPublicPlayer(player)) live[msg.player.key] = player;
        else delete live[msg.player.key];
      } else if (msg.type === "leave") delete live[msg.key];
      const registry = { ...get().registry };
      if (msg.type === "leave") {
        for (const [server, entry] of Object.entries(registry))
          registry[server] = { ...entry, players: entry.players.filter((p) => p.key !== msg.key) };
      } else if (msg.type === "snapshot") {
        // This snapshot is authoritative for the subscribed server, including disappearances.
        const server = get().server;
        registry[server] = { at: Date.now(), players: Object.values(live), error: null };
      }
      set({ livePlayers: live, registry });
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
    let metSync = 0;
    backfill.onMet = (met) => {
      set({ met: { ...met } });
      // names from the in-game lists resolve to ids as the logs are read; look again now and then
      if (Date.now() - metSync > 2_000) {
        metSync = Date.now();
        get().syncGameFriends();
      }
    };
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
    const operation = ++linkOperation;
    try {
      const custom = { ...get().pathsCustom };
      const detected = await detectPaths();
      if (operation !== linkOperation) return;
      if (custom.logsDir) {
        const r = await resolveLogsDir(custom.logsDir);
        if (operation !== linkOperation) return;
        if (r.note) get().toast(r.note, "warn");
        if (r.dir === detected.logsDir) delete custom.logsDir;
        else custom.logsDir = r.dir;
      }
      const paths = { ...detected, ...custom };
      set({ paths, pathsCustom: custom });
      LS.set("paths", custom);
      await get().rescan();
    } catch (e) {
      if (operation !== linkOperation) return;
      set({ link: { ...get().link, ...gameLinkFailure(e) } });
    }
  },

  async setPaths(p) {
    const operation = ++linkOperation;
    tail?.stop();
    tail = null;
    set({ link: { status: "scanning", file: null, progress: [0, 0], lines: 0 }, live: null });
    try {
      const resolved = p.logsDir ? await resolveLogsDir(p.logsDir) : null;
      if (operation !== linkOperation) return;
      const existing = get().paths;
      const detected = !p.logsDir && existing ? existing : await detectPaths();
      if (operation !== linkOperation) return;
      const pathsCustom = { ...get().pathsCustom, ...p };
      if (resolved) {
        if (resolved.note) get().toast(resolved.note, "warn");
        if (resolved.dir === detected.logsDir) delete pathsCustom.logsDir;
        else pathsCustom.logsDir = resolved.dir;
      }
      set({ pathsCustom, paths: { ...detected, ...pathsCustom } });
      LS.set("paths", pathsCustom);
      startBackfill(get);
      await get().rescan();
    } catch (e) {
      if (operation !== linkOperation) return;
      set({ link: { ...get().link, ...gameLinkFailure(e) } });
    }
  },
  async resetPaths() {
    set({ pathsCustom: {} });
    LS.set("paths", {});
    await get().rescan();
  },

  async rescan() {
    const operation = ++linkOperation;
    let paths: Paths | null = null;
    tail?.stop();
    tail = null;
    set({ link: { status: "scanning", file: null, progress: [0, 0], lines: 0 }, live: null });
    const t0 = performance.now();
    let ros = get().rosterList,
      hist: History = { characters: get().myChars, encounters: get().encounters };
    try {
      const custom = get().pathsCustom;
      paths =
        custom.logsDir && custom.settingsDir
          ? { ...custom, logsDir: custom.logsDir, settingsDir: custom.settingsDir }
          : { ...(await detectPaths()), ...custom };
      if (operation !== linkOperation) return;
      set({ paths });
      const [rosterResult, historyResult] = await Promise.allSettled([
        roster(paths.settingsDir),
        scanHistory(paths.logsDir, {}, (d, t) => {
          if (operation === linkOperation) set({ link: { ...get().link, progress: [d, t] } });
        }),
      ]);
      if (operation !== linkOperation) return;
      if (rosterResult.status === "fulfilled") ros = rosterResult.value;
      if (historyResult.status === "rejected") throw historyResult.reason;
      hist = historyResult.value;
    } catch (e) {
      if (operation !== linkOperation) return;
      set({ link: { ...get().link, ...gameLinkFailure(e) } });
    }
    if (!paths) return;
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
      onFile: (name) => {
        if (operation !== linkOperation) return;
        set({ link: { ...get().link, status: "live", file: name, error: undefined, issue: undefined } });
      },
      onNoLog: () => {
        if (operation !== linkOperation) return;
        set({ live: null, link: { ...get().link, status: "nolog", file: null, error: undefined, issue: undefined } });
      },
      onOwner: (s, raw) => {
        if (operation !== linkOperation) return;
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
        if (operation !== linkOperation) return;
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
        if (operation !== linkOperation) return;
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
        if (operation !== linkOperation) return;
        if (!tail?.primed || !uplink || !get().share || liveStatus(get).status === "invisible") return;
        const o = sightingFromSession(sg, s, raw);
        if (o && isNew) uplink.pushSighting(o);
      },
      onTick: (s) => {
        if (operation !== linkOperation) return;
        set({ live: { ...s }, liveAt: Date.now(), link: { ...get().link, lines: s.lines } });
        if (tail?.primed && get().followMe && s.area) {
          const p = planetForArea(s.area);
          if (p && get().planet !== p.slug && !primedOnce) {
            primedOnce = true;
            get().selectPlanet(p.slug);
          }
        }
      },
      onError: (e) => {
        if (operation !== linkOperation) return;
        set({ live: null, link: { ...get().link, ...gameLinkFailure(e) } });
      },
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
  setTool(tool) {
    set({ tool, view: "tools" });
  },
  setFollowMe(followMe) {
    set({ followMe });
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
    const update = get().update;
    if (
      update.phase === "checking" ||
      update.phase === "available" ||
      update.phase === "downloading" ||
      update.phase === "ready" ||
      update.phase === "installing" ||
      (update.phase === "error" && update.operation === "install")
    )
      return;
    set({ update: { phase: "checking" } });
    const state = await checkForUpdate();
    set({ update: state });
    if (state.phase === "available") await downloadUpdate((update) => set({ update }));
  },
  async restartToUpdate() {
    const update = get().update;
    if (update.phase !== "ready" && !(update.phase === "error" && update.operation === "install")) return;
    await restartApp((update) => set({ update }));
  },
  acknowledgeNotice() {
    LS.set("noticeSeen", NOTICE_VERSION);
    set({ modal: null });
  },
  async deleteMyData(survey) {
    if (!uplink) throw new Error("not connected");
    if (erasingData) throw new Error("deletion already in progress");
    erasingData = true;
    presenceRevision++;
    const charStatus: Record<string, CharStatus> = {};
    set({ share: false, charStatus, livePlayers: {}, registry: {} });
    LS.set("share", false);
    LS.set("charStatus", charStatus);
    uplink.configure(get().serverUrl, false);
    try {
      await backfill?.cancel();
      if (survey && (survey.reasons.length || survey.rating || survey.comment))
        await uplink.feedback("offboarding", survey.reasons, survey.rating, survey.comment);
      const r = await uplink.deleteMyData();
      backfill?.reset();
      return r;
    } finally {
      erasingData = false;
    }
  },
  async loadRegistry(server, force = false) {
    const cur = get().registry[server];
    if (!force && cur && Date.now() - cur.at < 60_000) return;
    if (!get().serverUrl) return;
    const revision = presenceRevision;
    const request = (registryRequests.get(server) ?? 0) + 1;
    registryRequests.set(server, request);
    try {
      const list = await fetchRegistry(get().serverUrl, server);
      // A slower response must not undo a newer refresh, live leave or privacy choice.
      if (revision !== presenceRevision || registryRequests.get(server) !== request) return;
      set({
        registry: {
          ...get().registry,
          [server]: {
            at: Date.now(),
            players: list.map(registryToPlayer).filter((p) => isPublicPlayer(p)),
            error: null,
          },
        },
      });
      get().syncGameFriends();
    } catch (e) {
      if (revision !== presenceRevision || registryRequests.get(server) !== request) return;
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
  async removeCharacter(key) {
    if (!uplink) throw new Error("Hydian is not connected yet. Please try again.");
    if (erasingData || get().characterActions[key]) throw new Error("A privacy change is already in progress.");
    const character = get().myChars.find((c) => `${c.server}:${c.id}` === key);
    if (!character) throw new Error("Choose one of your characters to remove.");
    const cur = get().charStatus[key] ?? DEFAULT_STATUS;
    presenceRevision++;
    const charStatus = { ...get().charStatus, [key]: { ...cur, status: "invisible" as const, lfrp: false } };
    set({
      charStatus,
      ...withoutPublicCharacter(get(), key),
      characterActions: { ...get().characterActions, [key]: "removing" },
    });
    LS.set("charStatus", charStatus);
    pushOverlay(get);
    try {
      await uplink.deleteCharacter(character.server, character.id);
      get().toast(`${character.name} was removed from Hydian for this device.`, "ok");
    } finally {
      const characterActions = { ...get().characterActions };
      delete characterActions[key];
      set({ characterActions });
      pushUplinkState(set);
    }
  },
  async setStatus(status) {
    if (erasingData) return;
    const key = get().activeKey;
    if (!key || get().characterActions[key]) return;
    const cur = get().charStatus[key] ?? DEFAULT_STATUS;
    if (cur.status === status) return;
    const [server, id] = key.split(":");
    // Only an explicit choice to share may lift a character's removal block.
    if (status !== "invisible" && uplink?.removedCharacters.includes(key)) {
      set({ characterActions: { ...get().characterActions, [key]: "sharing" } });
      try {
        await uplink.restoreCharacter(server, id);
      } catch {
        get().toast("Could not resume sharing. Your character is still hidden. Please try again.", "warn");
        return;
      } finally {
        const characterActions = { ...get().characterActions };
        delete characterActions[key];
        set({ characterActions });
      }
      if (erasingData) return;
    }
    presenceRevision++;
    const charStatus = { ...get().charStatus, [key]: { ...cur, status } };
    set({ charStatus, ...(status === "invisible" ? withoutPublicCharacter(get(), key) : {}) });
    LS.set("charStatus", charStatus);
    if (status === "invisible") uplink?.discardCharacter(server, id);
    if (cur.status === "invisible" && status !== "invisible") {
      if (!get().share) get().setShare(true);
      backfill?.release(server, id);
      startBackfill(get);
    }
    const live = get().live;
    const character = get().myChars.find((c) => `${c.server}:${c.id}` === key);
    const session =
      live?.ownerId && `${live.server}:${live.ownerId}` === key
        ? live
        : status === "invisible" && character
          ? {
              ...newSession(),
              ownerId: character.id,
              ownerName: character.name,
              server: character.server,
              cls: character.cls,
              disc: character.disc,
              area: character.area,
              pos: character.pos,
            }
          : null;
    if (session && uplink) {
      const p = pingFromSession(
        "status",
        session,
        status,
        charStatus[key].lfrp,
        undefined,
        charStatus[key].instance ?? null,
      );
      if (p) {
        uplink.push(p);
        pushUplinkState(set);
        if (status === "invisible") await uplink.flush();
      }
    }
    pushOverlay(get);
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
    if (share && erasingData) return;
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
  async setTrayIconVisible(trayIconVisible) {
    if (!IS_MAC || !isTauri() || get().trayIconChanging) return;
    set({ trayIconChanging: true });
    try {
      await setTrayVisible(trayIconVisible);
      set({ trayIconVisible });
      LS.set("trayIconVisible", trayIconVisible);
    } catch {
      get().toast("Could not change the menu-bar icon. Please try again.", "warn");
    } finally {
      set({ trayIconChanging: false });
    }
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
    const { friends: cur, unfriended, met, livePlayers, registry } = get();
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
    // people on Hydian resolve through the registry of their server, not only the one on screen
    for (const srv of new Set(gameNames.map((g) => g.server))) void get().loadRegistry(srv);
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
