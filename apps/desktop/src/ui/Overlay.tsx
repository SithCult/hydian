import { useEffect, useState, type CSSProperties } from "react";
import { STATUS_META, LFRP_COLOR } from "../model";
import { modShift } from "../core/platform";
import {
  DEFAULT_OVERLAY,
  loadOverlaySettings,
  saveOverlayPosition,
  type OverlaySettings,
  type OverlaySnapshot,
} from "../core/overlay";

/**
 * The in-game overlay window. Rendered by the second Tauri window (index.html?overlay=1); everything it shows
 * arrives from the main window as events. Locked = click-through and chromeless; unlocked = a drag handle and
 * native resize so it can be placed, then locked again.
 */
export function Overlay() {
  const [snap, setSnap] = useState<OverlaySnapshot | null>(null);
  const [set, setSet] = useState<OverlaySettings>(() => loadOverlaySettings());

  useEffect(() => {
    document.documentElement.classList.add("overlay-page");
    let off: (() => void)[] = [];
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      off.push(await listen<OverlaySnapshot>("overlay:state", (e) => setSnap(e.payload)));
      off.push(await listen<OverlaySettings>("overlay:settings", (e) => setSet(e.payload)));
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      off.push(await w.onMoved(() => void saveOverlayPosition()));
      off.push(await w.onResized(() => void saveOverlayPosition()));
    })();
    return () => {
      off.forEach((f) => f());
      off = [];
    };
  }, []);

  const s = set ?? DEFAULT_OVERLAY;
  const rows = (snap?.players ?? []).slice(0, s.maxRows);
  const more = (snap?.players.length ?? 0) - rows.length;
  const style = { "--ov-opacity": s.opacity, "--ov-scale": s.scale } as CSSProperties;

  return (
    <div className={`ov ${s.locked ? "locked" : "unlocked"}`} style={style}>
      {!s.locked && (
        <div className="ov-handle" data-tauri-drag-region>
          ⠿ drag to move · resize at the edges · lock in Hydian or {modShift("L")}
        </div>
      )}
      <div className="ov-card">
        <div className="ov-head">
          <span className="ov-planet">{snap?.planet ?? "-"}</span>
          {snap?.me ? (
            <span className="ov-me" style={{ "--sc": STATUS_META[snap.me.status].color } as CSSProperties}>
              <i className="d" />
              {STATUS_META[snap.me.status].short}
              {snap.me.lfrp && (
                <b className="ov-lfrp" style={{ color: LFRP_COLOR }}>
                  LFRP
                </b>
              )}
              {snap.me.instance ? <em>inst {snap.me.instance}</em> : null}
            </span>
          ) : (
            <span className="ov-me dim">{snap?.link === "live" ? "no character" : "waiting for the game log"}</span>
          )}
        </div>
        {snap?.me?.where && <div className="ov-where">{snap.me.where}</div>}
        {rows.length === 0 ? (
          <div className="ov-empty">
            {snap?.seen ? `${snap.seen} nearby, not on Hydian` : "no one on Hydian nearby"}
          </div>
        ) : (
          <ul className="ov-list">
            {rows.map((p) => (
              <li
                key={p.key}
                className={p.lfrp ? "lfrp" : ""}
                style={{ "--sc": STATUS_META[p.status].color } as CSSProperties}
              >
                <i className="d" />
                <span className="nm">
                  {p.starred ? "♥ " : ""}
                  {p.name}
                </span>
                {p.lfrp && <b className="ov-lfrp">LFRP</b>}
                {p.instance ? <em>i{p.instance}</em> : null}
                <span className="m">
                  {p.m == null ? "" : p.m < 1000 ? `${Math.round(p.m)} m` : `${(p.m / 1000).toFixed(1)} km`}
                </span>
              </li>
            ))}
            {more > 0 || snap?.seen ? (
              <li className="ov-foot">
                {more > 0 ? `+${more} more` : ""}
                {more > 0 && snap?.seen ? " · " : ""}
                {snap?.seen ? `${snap.seen} not on Hydian` : ""}
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
