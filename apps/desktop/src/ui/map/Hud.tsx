// Overlays on top of the canvas: legend, level picker and the hover card.
import type { CSSProperties } from "react";
import { STATUS_META, LFRP_COLOR, presenceOf, type Player } from "../../model";
import { locate, type LevelCluster } from "../../data/maps";
import { SERVER_NAMES } from "../../core/gamelink";
import { Avatar, Icons, ago } from "../bits";
import { STALE_POS_MS } from "./pins";
import { Tip } from "../Tip";

const swatch = (c: string, extra?: CSSProperties) => ({ "--c": c, ...extra }) as CSSProperties;

export type HeatState = "off" | "loading" | "ok" | "few" | "empty" | "error";

/** The heatmap toggle's tooltip: what it shows, or why it shows nothing here yet. */
export function heatSummary(state: HeatState): string {
  switch (state) {
    case "loading":
      return "Heatmap: loading";
    case "error":
      return "Heatmap: server unreachable";
    case "few":
    case "empty":
      return "Heatmap: not enough roleplay recorded here yet";
    default:
      return "Heatmap: where people roleplay on this server";
  }
}

export function MapLegend({
  heatState,
  open,
  onToggle,
}: {
  heatState: HeatState;
  open: boolean;
  onToggle: () => void;
}) {
  if (!open)
    return (
      <Tip label="Legend" side="right">
        <button className="map-legend-toggle" onClick={onToggle}>
          {Icons.help({ width: 14, height: 14 })}
        </button>
      </Tip>
    );
  const rows: [CSSProperties, string, string?][] = [
    [swatch(STATUS_META.ic.color), STATUS_META.ic.label],
    [swatch(STATUS_META.ooc.color), STATUS_META.ooc.label],
    [swatch(LFRP_COLOR), "Looking for RP", "beacon"],
    [swatch("transparent", { outline: "1px dashed #8b8f98" }), "Not on Hydian"],
  ];
  return (
    <div className="map-legend">
      <div className="lg-head">
        <span className="mono">Legend</span>
        <Tip label="Hide the legend">
          <button className="lg-close" onClick={onToggle}>
            {Icons.x({ width: 11, height: 11 })}
          </button>
        </Tip>
      </div>
      {rows.map(([style, label, cls]) => (
        <span key={label}>
          <i className={cls} style={style} />
          {label}
        </span>
      ))}
      {heatState === "ok" && (
        <span>
          <i style={swatch("#fb923c")} />
          Heatmap
        </span>
      )}
    </div>
  );
}

export function LevelControl({
  cluster,
  chosen,
  active,
  mode,
  onChoose,
}: {
  cluster: LevelCluster;
  chosen: string | undefined; // manual pick, if any
  active: string | null; // level shown this frame
  mode: "2d" | "3d";
  onChoose: (id: string | "auto") => void;
}) {
  const short = (s: string) => s.replace(/^.*› /, "");
  const dupes = new Map<string, number>();
  for (const t of cluster.levels) dupes.set(short(t.label), (dupes.get(short(t.label)) ?? 0) + 1);
  const seen = new Map<string, number>();
  const labelOf = new Map(
    cluster.levels.map((t) => {
      const s = short(t.label);
      const n = (seen.get(s) ?? 0) + 1;
      seen.set(s, n);
      return [t.id, (dupes.get(s) ?? 1) > 1 ? `${s} · ${n}` : s];
    }),
  );
  return (
    <div className="levels">
      <div className="lv-head">Level</div>
      {[...cluster.levels].reverse().map((t) => {
        const on = chosen ? chosen === t.id : active === t.id;
        return (
          <button
            key={t.id}
            className={`${on ? "on" : ""} ${!chosen && on ? "auto" : ""}`}
            onClick={() => onChoose(t.id)}
          >
            {labelOf.get(t.id)}
          </button>
        );
      })}
      {mode === "3d" && (
        <button className={`lv-auto ${!chosen ? "on" : ""}`} onClick={() => onChoose("auto")}>
          All levels
        </button>
      )}
      {mode === "2d" && chosen && (
        <button className="lv-auto" onClick={() => onChoose("auto")}>
          Back to my level
        </button>
      )}
    </div>
  );
}

export function HoverCard({ p, pos, planetId }: { p: Player; pos: [number, number]; planetId: string | null }) {
  const loc = !p.isSeen && p.z ? locate(planetId, p.x, p.y, p.z) : null;
  return (
    <div className="hover-card" style={{ left: pos[0], top: pos[1] }}>
      <div className="row">
        <Avatar p={p} status={p.isSeen ? undefined : p.status} bg="var(--bg-tooltip)" ghost={p.isSeen} />
        <div>
          <div className="nm">
            {p.name}
            {p.isMe ? " (you)" : ""} <span className="srv">{SERVER_NAMES[p.server] ?? p.server}</span>
          </div>
          {p.isSeen ? (
            <span className="cl" style={{ color: "var(--text-faint)" }}>
              Not on Hydian
            </span>
          ) : (
            <span className="cl">
              {p.lfrp && p.status !== "invisible" ? "Looking for RP" : STATUS_META[p.status].label}
              {p.instance ? ` · instance ${p.instance}` : ""}
            </span>
          )}
        </div>
      </div>
      {p.isSeen ? (
        <div className="stx">last seen {ago(p.lastActive)}</div>
      ) : (
        <>
          {loc && (
            <div className="stx" style={{ fontStyle: "normal", color: "var(--accent)" }}>
              {loc.path.join(" › ")}
            </div>
          )}
          <div className="stx">
            {STATUS_META[p.status].label} · {presenceOf(p.lastActive) === "active" ? "active now" : ago(p.lastActive)}
          </div>
          {Date.now() - p.lastActive > STALE_POS_MS && (
            <div className="stx" style={{ color: "var(--text-faint)" }}>
              Position from {ago(p.lastActive)}. The game only logs a position when something happens; any ability
              refreshes it.
            </div>
          )}
        </>
      )}
    </div>
  );
}
