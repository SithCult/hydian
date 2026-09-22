// Read-only file access abstraction.
// The Tauri commands accept combat logs and the per-character settings files
// (PlayerGUIState, LocalSocialSettings), including in manually chosen folders.
// The local browser bridge also restricts reads to its detected SWTOR roots and
// only accepts requests from the local preview.
import { IS_MAC, SEP } from "./platform";

export interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
}
export interface Roots {
  documents: string;
  localData: string;
}

export interface GameFS {
  roots(): Promise<Roots>;
  /** `filter` limits the (expensive) per-file stat to matching names; others come back with size/mtime 0. */
  readDir(path: string, filter?: RegExp): Promise<DirEntry[]>;
  stat(path: string): Promise<{ size: number; mtime: number }>;
  read(path: string, offset: number, length: number): Promise<Uint8Array>;
}

export function fileErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? fileErrorCode(error.cause) : undefined;
}

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const join = (...parts: string[]) => parts.join(SEP).replace(/[\\/]+/g, SEP);

// ---------------------------------------------------------------- dev bridge
async function bridgeRequest(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    const fallback = `Local game-file access failed (HTTP ${response.status})`;
    const body = await response.json().catch(() => ({ error: fallback }));
    throw new Error(typeof body?.error === "string" ? body.error : fallback, { cause: body });
  }
  return response;
}

const bridge: GameFS = {
  async roots() {
    return (await bridgeRequest("/bridge/roots")).json();
  },
  async readDir(path, filter) {
    const q = filter ? `&filter=${encodeURIComponent(filter.source)}` : "";
    return (await bridgeRequest(`/bridge/readDir?path=${encodeURIComponent(path)}${q}`)).json();
  },
  async stat(path) {
    return (await bridgeRequest(`/bridge/stat?path=${encodeURIComponent(path)}`)).json();
  },
  async read(path, offset, length) {
    const r = await bridgeRequest(`/bridge/read?path=${encodeURIComponent(path)}&offset=${offset}&length=${length}`);
    return new Uint8Array(await r.arrayBuffer());
  },
};

// ---------------------------------------------------------------- tauri
// Three read-only commands in src-tauri/src/lib.rs. fs_read returns raw bytes (no JSON), so
// tailing a 300 KB chunk costs one IPC round-trip.
async function makeTauri(): Promise<GameFS> {
  const { invoke } = await import("@tauri-apps/api/core");
  const pathApi = await import("@tauri-apps/api/path");
  async function invokeFile<T>(command: string, args: Record<string, unknown>): Promise<T> {
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
      throw new Error(message, { cause: error });
    }
  }
  return {
    async roots() {
      if (IS_MAC) {
        const bottle = await crossoverRoots(await pathApi.homeDir(), (p) =>
          invokeFile<DirEntry[]>("fs_read_dir", { path: p }),
        );
        if (bottle) return bottle;
      }
      return {
        documents: join(await pathApi.documentDir(), "Star Wars - The Old Republic"),
        localData: join(await pathApi.localDataDir(), "SWTOR"),
      };
    },
    async readDir(path, filter) {
      const entries = await invokeFile<DirEntry[]>("fs_read_dir", { path });
      if (!filter) return entries;
      for (const e of entries) {
        if (e.isDir || !filter.test(e.name)) continue;
        try {
          const st = await invokeFile<{ size: number; mtime: number }>("fs_stat", { path: join(path, e.name) });
          e.size = st.size;
          e.mtime = st.mtime;
        } catch {
          /* leave zeros */
        }
      }
      return entries;
    },
    async stat(path) {
      return invokeFile<{ size: number; mtime: number }>("fs_stat", { path });
    },
    async read(path, offset, length) {
      const buf = await invokeFile<ArrayBuffer>("fs_read", { path, offset, length });
      return new Uint8Array(buf);
    },
  };
}

// There is no Mac client: on a Mac the game runs under CrossOver (or Whisky), and its Windows-side Documents
// and AppData folders live inside the bottle. Take the first bottle that already has combat logs.
const BOTTLE_ROOTS = [
  "Library/Application Support/CrossOver/Bottles",
  "Library/Containers/com.isaacmarovitz.Whisky/Bottles",
];
async function crossoverRoots(home: string, ls: (p: string) => Promise<DirEntry[]>): Promise<Roots | null> {
  const dirs = async (p: string) => {
    try {
      return (await ls(p)).filter((e) => e.isDir).map((e) => join(p, e.name));
    } catch {
      return [];
    }
  };
  for (const root of BOTTLE_ROOTS)
    for (const bottle of await dirs(join(home, root)))
      for (const user of await dirs(join(bottle, "drive_c/users"))) {
        const documents = join(user, "Documents/Star Wars - The Old Republic");
        if ((await dirs(documents)).some((d) => d.endsWith("CombatLogs")))
          return { documents, localData: join(user, "AppData/Local/SWTOR") };
      }
  return null;
}

let instance: Promise<GameFS> | null = null;
export function gameFS(): Promise<GameFS> {
  if (!instance) instance = isTauri() ? makeTauri() : Promise.resolve(bridge);
  return instance;
}

// Combat logs are cp1252 (verified: "Àzulèà" is stored as C0 7A 75 6C E8 E0).
export const decoder = new TextDecoder("windows-1252");

/** Native folder picker (desktop only). Returns null in the browser preview or when cancelled. */
export async function pickFolder(title: string, defaultPath?: string): Promise<string | null> {
  if (!isTauri()) return null;
  const dialog = await import("@tauri-apps/plugin-dialog");
  const r = await dialog.open({ directory: true, multiple: false, title, defaultPath });
  return typeof r === "string" ? r : null;
}
