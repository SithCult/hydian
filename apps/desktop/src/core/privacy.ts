import { useApp } from "../store";

export const PRIVACY_POLICY_URL = "https://hydian.org/privacy";

export async function openPrivacyPolicy() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_privacy_policy");
  } catch {
    useApp.getState().toast("Could not open the privacy policy. Visit hydian.org/privacy in your browser.", "warn");
  }
}
