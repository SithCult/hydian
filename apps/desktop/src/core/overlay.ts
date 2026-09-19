// In-game overlay: a second, transparent, always-on-top window that shows who is around while you play.
// The main window owns all state and pushes a small snapshot to the overlay over Tauri events; the overlay
// window itself never touches the log or the network. Position/size/lock live in localStorage, which both
// windows share (same origin), and are restored on the monitor they were saved on.
import { isTauri } from "./fs";
import { presenceOf, type Player, type RPStatus } from "../model";
import type { Location } from "../data/maps";

export interface OverlayPlayer {
  key: string;
  name: string;
  status: RPStatus;
  lfrp: boolean;
  instance: number | null;
  isSeen: boolean;
  isMe: boolean;
  m: number | null;
  where: string | null;
  starred: boolean;
}
export interface OverlaySnapshot {
  planet: string | null;
  server: string;
  me: { name: string; status: RPStatus; lfrp: boolean; instance: number | null; where: string | null } | null;
  players: OverlayPlayer[]; // sorted by distance to me, me excluded
  seen: number; // "not on Hydian" nearby
  link: string; // game link status
}
export interface OverlaySettings {
  on: boolean;
  locked: boolean;
  opacity: number;
  scale: number;
  autoHide: boolean;
  maxRows: number;
}
export const DEFAULT_OVERLAY: OverlaySettings = {
  on: false,
  locked: true,
  opacity: 0.92,
  scale: 1,
  autoHide: true,
  maxRows: 8,
};
export const OVERLAY_HOTKEYS = { toggle: "CommandOrControl+Shift+O", lock: "CommandOrControl+Shift+L" } as const;
const LS_SET = "hydian:overlay:settings",
  LS_POS = "hydian:overlay:pos";

export function loadOverlaySettings(): OverlaySettings {
  try {
    return { ...DEFAULT_OVERLAY, ...(JSON.parse(localStorage.getItem(LS_SET) ?? "{}") as Partial<OverlaySettings>) };
  } catch {
    return { ...DEFAULT_OVERLAY };
  }
}
export function saveOverlaySettings(s: OverlaySettings) {
  try {
    localStorage.setItem(LS_SET, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Build what the overlay shows from the main window's player list (planet-local, metres from me). */
export function snapshot(
  server: string,
  planet: string | null,
  me: Player | null,
  players: Player[],
  locate: (p: Player) => Location | null,
  link: string,
  follows: Record<string, unknown> = {},
): OverlaySnapshot {
  const now = Date.now();
  const dist = (p: Player) => (me && me.planetId === p.planetId ? Math.hypot(p.x - me.x, p.y - me.y) / 10 : null); // log units → metres
  const list = players
    .filter((p) => !p.isMe && presenceOf(p.lastActive, now) !== "gone")
    .map((p) => ({
      key: p.key,
      name: p.name,
      status: p.status,
      lfrp: !!p.lfrp && p.status !== "invisible",
      instance: p.instance ?? null,
      isSeen: !!p.isSeen,
      isMe: false,
      m: dist(p),
      where: p.isSeen ? null : (locate(p)?.label ?? null),
      starred: !!follows[p.key],
    }))
    .sort((a, b) => Number(b.starred) - Number(a.starred) || (a.m ?? 1e9) - (b.m ?? 1e9));
  return {
    planet,
    server,
    me: me
      ? {
          name: me.name,
          status: me.status,
          lfrp: !!me.lfrp && me.status !== "invisible",
          instance: me.instance ?? null,
          where: locate(me)?.label ?? null,
        }
      : null,
    players: list.filter((p) => !p.isSeen || p.starred),
    seen: list.filter((p) => p.isSeen && !p.starred).length,
    link, // followed people show even when not on Hydian
  };
}

// ---------------------------------------------------------------- main-window side
export class OverlayHost {
  private win: import("@tauri-apps/api/webviewWindow").WebviewWindow | null = null;
  private gameRunning = true;
  private settings = loadOverlaySettings();
  private last = "";
  onSettings: (s: OverlaySettings) => void = () => {};

  async init() {
    if (!isTauri()) return;
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { listen } = await import("@tauri-apps/api/event");
    this.win = await WebviewWindow.getByLabel("overlay");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      this.gameRunning = await invoke<boolean>("is_game_running");
    } catch {
      /* assume running */
    }
    await listen<{ running: boolean }>("game", (e) => {
      this.gameRunning = e.payload.running;
      void this.apply();
    });
    await listen("overlay:toggle", () => void this.set({ on: !this.settings.on }));
    await this.restorePosition();
    await this.registerHotkeys();
    await this.apply();
  }
  get current() {
    return this.settings;
  }

  async set(patch: Partial<OverlaySettings>) {
    this.settings = { ...this.settings, ...patch };
    saveOverlaySettings(this.settings);
    this.onSettings(this.settings);
    await this.apply();
    await this.emit("overlay:settings", this.settings);
  }

  /** Show/hide + click-through according to settings and whether the game is up. */
  private async apply() {
    const w = this.win;
    if (!w) return;
    const visible = this.settings.on && (!this.settings.autoHide || this.gameRunning);
    try {
      if (visible) {
        await w.show();
        await w.setAlwaysOnTop(true);
      } else await w.hide();
      await w.setIgnoreCursorEvents(this.settings.locked);
      await w.setResizable(!this.settings.locked);
    } catch {
      /* window gone */
    }
  }

  async push(snap: OverlaySnapshot) {
    const s = JSON.stringify(snap);
    if (s === this.last) return;
    this.last = s;
    await this.emit("overlay:state", snap);
  }
  private async emit(name: string, payload: unknown) {
    if (!this.win) return;
    try {
      const { emitTo } = await import("@tauri-apps/api/event");
      await emitTo("overlay", name, payload);
    } catch {
      /* ignore */
    }
  }

  private async restorePosition() {
    const w = this.win;
    if (!w) return;
    try {
      const { PhysicalPosition, PhysicalSize, availableMonitors, primaryMonitor } =
        await import("@tauri-apps/api/window");
      const saved = JSON.parse(localStorage.getItem(LS_POS) ?? "null") as {
        x: number;
        y: number;
        w: number;
        h: number;
      } | null;
      const monitors = await availableMonitors();
      const inside =
        saved &&
        monitors.some(
          (m) =>
            saved.x >= m.position.x - 20 &&
            saved.y >= m.position.y - 20 &&
            saved.x < m.position.x + m.size.width &&
            saved.y < m.position.y + m.size.height,
        );
      if (saved && inside) {
        await w.setSize(new PhysicalSize(saved.w, saved.h));
        await w.setPosition(new PhysicalPosition(saved.x, saved.y));
        return;
      }
      // default: bottom-right of the primary monitor, clear of the taskbar
      const pm = (await primaryMonitor()) ?? monitors[0];
      if (!pm) return;
      const size = await w.outerSize();
      await w.setPosition(
        new PhysicalPosition(
          pm.position.x + pm.size.width - size.width - 24,
          pm.position.y + pm.size.height - size.height - 80,
        ),
      );
    } catch {
      /* ignore */
    }
  }

  private async registerHotkeys() {
    try {
      const gs = await import("@tauri-apps/plugin-global-shortcut");
      await gs.unregisterAll();
      await gs.register(OVERLAY_HOTKEYS.toggle, (e) => {
        if (e.state === "Pressed") void this.set({ on: !this.settings.on });
      });
      await gs.register(OVERLAY_HOTKEYS.lock, (e) => {
        if (e.state === "Pressed") void this.set({ locked: !this.settings.locked });
      });
    } catch {
      /* shortcuts taken by another app: the Settings buttons still work */
    }
  }
}

/** Overlay-window side: remember where the user put it (called after a drag/resize). */
export async function saveOverlayPosition() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    const p = await w.outerPosition(),
      s = await w.outerSize();
    localStorage.setItem(LS_POS, JSON.stringify({ x: p.x, y: p.y, w: s.width, h: s.height }));
  } catch {
    /* ignore */
  }
}
