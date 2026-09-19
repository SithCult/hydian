import { useApp } from "../store";
import { openPrivacyPolicy } from "./privacy";

export async function handleHelpAction(action: string): Promise<void> {
  if (action === "help-privacy") return openPrivacyPolicy();
  if (action !== "help-about" && action !== "help-update") return;
  const app = useApp.getState();
  if (app.modal?.kind === "notice") {
    app.toast("Complete the welcome steps first.");
    return;
  }
  app.openModal({ kind: "settings", tab: "about" });
  if (action === "help-update") await app.checkUpdate();
}
