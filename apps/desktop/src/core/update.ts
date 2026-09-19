// Updates: the app checks the release feed on start and every few hours, downloads a new version in the
// background, and offers a restart. Signed with the project's updater key (tauri.conf.json); the browser
// preview has no updater and reports "up to date".
import { isTauri } from "./fs";

export type UpdateState =
  | { phase: "idle"; version?: string }
  | { phase: "available"; version: string; notes: string | null }
  | { phase: "downloading"; version: string; progress: number }
  | { phase: "ready"; version: string }
  | { phase: "error"; message: string };

export const CHECK_EVERY_MS = 6 * 3600_000;

type Update = import("@tauri-apps/plugin-updater").Update;
let pending: Update | null = null;

/** The running app's version ("0.1.0"), or "preview" in the browser. */
export async function appVersion(): Promise<string> {
  if (!isTauri()) return "preview";
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

/** Looks for a newer release. Resolves to the state to show; never throws. */
export async function checkForUpdate(): Promise<UpdateState> {
  if (!isTauri() || import.meta.env.DEV) return { phase: "idle" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const u = await check();
    if (!u) return { phase: "idle" };
    pending = u;
    return { phase: "available", version: u.version, notes: u.body ?? null };
  } catch (e) {
    return { phase: "error", message: String(e) };
  }
}

/** Downloads and stages the pending update; `onState` follows the progress. Restart applies it. */
export async function installUpdate(onState: (s: UpdateState) => void) {
  const u = pending;
  if (!u) return;
  let total = 0,
    done = 0;
  try {
    await u.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0;
      else if (ev.event === "Progress") {
        done += ev.data.chunkLength;
        onState({ phase: "downloading", version: u.version, progress: total ? done / total : 0 });
      } else if (ev.event === "Finished") onState({ phase: "ready", version: u.version });
    });
  } catch (e) {
    onState({ phase: "error", message: String(e) });
  }
}

export async function restartApp() {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
