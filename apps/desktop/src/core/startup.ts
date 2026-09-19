// Launch-at-login + tray behaviour. The app is meant to stay open like a chat client: it registers itself
// to start with the OS (once, on first run; the user can turn it off), starts hidden in the tray when the
// OS launched it, and closing the window only hides it (Quit lives in the tray menu).
import { isTauri } from "./fs";

const LS_INIT = "hydian:autostartInit:v2";

export async function autostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const m = await import("@tauri-apps/plugin-autostart");
    return await m.isEnabled();
  } catch {
    return false;
  }
}
export async function setAutostart(on: boolean): Promise<void> {
  if (!isTauri()) return;
  if (on) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("autostart_enable");
  } else {
    const { disable } = await import("@tauri-apps/plugin-autostart");
    await disable();
  }
}
/** First run: register for launch at login (default on). Later runs leave the user's choice alone. */
export async function initAutostart(): Promise<string | null> {
  if (!isTauri() || import.meta.env.DEV) return null;
  try {
    if (localStorage.getItem(LS_INIT)) return null;
  } catch {
    return null;
  }
  try {
    await setAutostart(true);
    localStorage.setItem(LS_INIT, "1");
    return null;
  } catch (e) {
    return String((e as Error)?.message ?? e);
  } // retried next start; the Settings switch works regardless
}
/** When the OS launched us, Rust hides the window; show it again unless the user wants a silent start. */
export async function applyStartMinimized(startMinimized: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    if (!(await invoke<boolean>("launched_minimized"))) return;
    if (startMinimized) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    await w.show();
    await w.setFocus();
  } catch {
    /* ignore */
  }
}
