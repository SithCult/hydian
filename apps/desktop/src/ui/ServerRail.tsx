import type { CSSProperties } from "react";
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
      <Tip label="Settings" side="right">
        <button className="rail-btn" onClick={() => openModal({ kind: "settings" })}>
          {Icons.gear({ width: 20, height: 20 })}
        </button>
      </Tip>
    </nav>
  );
}
