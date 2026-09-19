// One line at the top of the window while an update is on its way: what is happening, and Restart when it is ready.
import { useApp } from "../store";
import { Button } from "@/components/ui/button";

export function UpdateBar() {
  const update = useApp((s) => s.update);
  const restart = useApp((s) => s.restartToUpdate);
  const check = useApp((s) => s.checkUpdate);
  if (["idle", "checking", "up-to-date", "unavailable"].includes(update.phase)) return null;
  if (update.phase === "error" && update.operation === "check") return null;
  return (
    <div className={`update-bar ${update.phase}`}>
      {update.phase === "available" && <span>Hydian {update.version} is available.</span>}
      {update.phase === "downloading" && (
        <span>
          Downloading Hydian {update.version}
          {update.progress > 0 ? ` · ${Math.round(update.progress * 100)}%` : ""}
        </span>
      )}
      {update.phase === "ready" && (
        <>
          <span>Hydian {update.version} is ready.</span>
          <Button variant="secondary" size="xs" onClick={() => void restart()}>
            Restart to update
          </Button>
        </>
      )}
      {update.phase === "installing" && <span role="status">Installing the update. Hydian will restart…</span>}
      {update.phase === "error" && (
        <>
          <span role="status">The update couldn't be completed.</span>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => void (update.operation === "install" ? restart() : check())}
          >
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
