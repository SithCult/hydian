import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri } from "../core/fs";
import { useApp } from "../store";

export function UpdateControls() {
  const version = useApp((s) => s.version);
  const update = useApp((s) => s.update);
  const check = useApp((s) => s.checkUpdate);
  const restart = useApp((s) => s.restartToUpdate);
  const browserPreview = !isTauri();
  const unavailable = browserPreview || import.meta.env.DEV || update.phase === "unavailable";
  const busy = ["checking", "available", "downloading", "installing"].includes(update.phase);
  const retryInstall = update.phase === "error" && update.operation === "install";
  const ready = update.phase === "ready" || retryInstall;
  const message = unavailable
    ? browserPreview
      ? "Browser preview · update checks are disabled."
      : "Development build · update checks are disabled."
    : update.phase === "checking"
      ? "Checking for updates…"
      : update.phase === "up-to-date"
        ? "You're on the latest version."
        : update.phase === "available"
          ? `Preparing Hydian ${update.version}…`
          : update.phase === "downloading"
            ? `Downloading Hydian ${update.version}${update.progress > 0 ? ` · ${Math.round(update.progress * 100)}%` : "…"}`
            : update.phase === "ready"
              ? `Hydian ${update.version} is ready. Restart to install it.`
              : update.phase === "installing"
                ? "Installing the update. Hydian will restart…"
                : update.phase === "error"
                  ? update.operation === "check"
                    ? "Couldn't check for updates. Please try again."
                    : update.operation === "download"
                      ? "The update couldn't be downloaded. Please try again."
                      : "The update couldn't be completed. Please try again."
                  : "Hydian also checks for updates automatically.";
  return (
    <div className="update-controls">
      <div className="update-controls-row">
        <span className="app-version">{version === "preview" ? "Browser preview" : `Hydian ${version || "…"}`}</span>
        {!unavailable && (
          <Button variant="secondary" size="xs" disabled={busy} onClick={() => void (ready ? restart() : check())}>
            {busy && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {update.phase === "checking"
              ? "Checking…"
              : update.phase === "installing"
                ? "Installing…"
                : update.phase === "downloading" || update.phase === "available"
                  ? "Downloading…"
                  : retryInstall
                    ? "Try again"
                    : ready
                      ? "Restart to update"
                      : update.phase === "error"
                        ? "Try again"
                        : "Check for updates"}
          </Button>
        )}
      </div>
      <p className={`update-feedback ${update.phase}`} role="status" aria-live="polite">
        {message}
      </p>
      {update.phase === "downloading" && (
        <progress aria-label="Update download" max={1} value={update.progress > 0 ? update.progress : undefined} />
      )}
    </div>
  );
}
