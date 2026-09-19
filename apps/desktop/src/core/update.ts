// Updates download in the background and are verified before the user applies them with a restart.
import { isTauri } from "./fs";

export type UpdateState =
  | { phase: "idle" | "checking" | "up-to-date" | "unavailable" }
  | { phase: "available"; version: string; notes: string | null }
  | { phase: "downloading"; version: string; progress: number }
  | { phase: "ready" | "installing"; version: string }
  | { phase: "error"; operation: "check" | "download" | "install"; message: string; version?: string };

export const CHECK_EVERY_MS = 6 * 3600_000;

type Update = import("@tauri-apps/plugin-updater").Update;
let pending: Update | null = null;
let installed = false;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The running app's version ("0.1.0"), or "preview" in the browser. */
export async function appVersion(): Promise<string> {
  if (!isTauri()) return "preview";
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

/** Looks for a newer release. Resolves to the state to show; never throws. */
export async function checkForUpdate(): Promise<UpdateState> {
  if (!isTauri() || import.meta.env.DEV) return { phase: "unavailable" };
  const previous = pending;
  pending = null;
  installed = false;
  await previous?.close().catch(() => {});
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const u = await check({ timeout: 30_000 });
    if (!u) return { phase: "up-to-date" };
    pending = u;
    return { phase: "available", version: u.version, notes: u.body ?? null };
  } catch (e) {
    return { phase: "error", operation: "check", message: message(e) };
  }
}

/** Downloads and verifies the pending update. Installation waits for the user's restart. */
export async function downloadUpdate(onState: (s: UpdateState) => void) {
  const u = pending;
  if (!u) return;
  let total = 0,
    done = 0;
  onState({ phase: "downloading", version: u.version, progress: 0 });
  try {
    await u.download(
      (ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        else if (ev.event === "Progress") {
          done += ev.data.chunkLength;
          onState({ phase: "downloading", version: u.version, progress: total ? Math.min(done / total, 1) : 0 });
        }
      },
      { timeout: 5 * 60_000 },
    );
    // Finished is emitted before signature verification; only a resolved download is ready.
    onState({ phase: "ready", version: u.version });
  } catch (e) {
    onState({ phase: "error", operation: "download", version: u.version, message: message(e) });
  }
}

export async function restartApp(onState: (s: UpdateState) => void) {
  const u = pending;
  if (!u) return;
  onState({ phase: "installing", version: u.version });
  try {
    if (!installed) {
      await u.install();
      installed = true;
    }
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    onState({
      phase: "error",
      operation: "install",
      version: u.version,
      message: `${installed ? "Could not restart Hydian" : "Could not install the update"}: ${message(e)}`,
    });
  }
}
