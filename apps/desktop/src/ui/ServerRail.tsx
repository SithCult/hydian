import type { CSSProperties } from "react";
import { CircleArrowDown, LoaderCircle, TriangleAlert, Wrench } from "lucide-react";
import { SERVERS } from "../data/servers";
import { useApp } from "../store";
import { selectCounts } from "../selectors";
import { Icons } from "./bits";
import { Tip } from "./Tip";

const VIEWS = [
  ["map", "Map", Icons.map],
  ["registry", "Registry", Icons.users],
  ["journal", "Journal", Icons.book],
] as const;

export function ServerRail() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const server = useApp((s) => s.server);
  const selectServer = useApp((s) => s.selectServer);
  const openModal = useApp((s) => s.openModal);
  const update = useApp((s) => s.update);
  const updateBusy = update.phase === "available" || update.phase === "downloading" || update.phase === "installing";
  const updateError = update.phase === "error" && update.operation !== "check";
  const showUpdate = updateBusy || update.phase === "ready" || updateError;
  const updateLabel = updateError
    ? "Update needs attention"
    : update.phase === "ready"
      ? `Hydian ${update.version} is ready to install`
      : update.phase === "installing"
        ? "Installing update…"
        : "Downloading update…";
  const counts = useApp(selectCounts);
  const myServers = new Set(useApp((s) => s.myChars).map((c) => c.server));

  let lastRegion = "";
  return (
    <nav className="rail" data-tauri-drag-region>
      {VIEWS.map(([id, label, icon]) => (
        <Tip key={id} label={label} side="right">
          <button className={`rail-btn rail-view ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
            {icon({ width: 20, height: 20 })}
          </button>
        </Tip>
      ))}
      <div className="rail-sep" />
      {SERVERS.map((s) => {
        const n = counts.byServer[s.id] ?? 0;
        const region = s.region !== lastRegion ? s.region : null;
        lastRegion = s.region;
        return (
          <div key={s.id} style={{ display: "contents" }}>
            {region && <div className="rail-region">{region}</div>}
            <Tip label={s.name} side="right">
              <button
                className={`rail-btn ${server === s.id ? "active" : ""}`}
                style={{ "--srv": `hsl(${s.hue} 55% 42%)` } as CSSProperties}
                onClick={() => selectServer(s.id)}
              >
                <span className="pill" />
                {s.short}
                {n > 0 && <span className={`badge ${myServers.has(s.id) ? "" : "soft"}`}>{n}</span>}
              </button>
            </Tip>
          </div>
        );
      })}
      <div className="rail-spacer" />
      {showUpdate && (
        <Tip label={updateLabel} side="right">
          <button
            className={`rail-btn rail-update ${updateError ? "warning" : ""}`}
            aria-label={updateLabel}
            onClick={() => openModal({ kind: "settings", tab: "about" })}
          >
            {updateBusy ? (
              <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : updateError ? (
              <TriangleAlert size={20} aria-hidden="true" />
            ) : (
              <CircleArrowDown size={20} aria-hidden="true" />
            )}
          </button>
        </Tip>
      )}
      <Tip label="Tools" side="right">
        <button
          className={`rail-btn rail-view ${view === "tools" ? "active" : ""}`}
          aria-label="Tools"
          onClick={() => setView("tools")}
        >
          <Wrench width={20} height={20} />
        </button>
      </Tip>
      <Tip label="Settings" side="right">
        <button className="rail-btn" aria-label="Settings" onClick={() => openModal({ kind: "settings" })}>
          {Icons.gear({ width: 20, height: 20 })}
        </button>
      </Tip>
    </nav>
  );
}
