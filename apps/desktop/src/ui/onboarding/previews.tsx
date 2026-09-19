// Rendered previews for the tour: the real components and styles, animated on a loop. Names are invented.
import { useEffect, useState, type CSSProperties } from "react";
import { STATUS_META, LFRP_COLOR, type RPStatus } from "../../model";
import { Avatar, Icons, Private } from "../bits";
import { ASSET_BASE } from "../../data/maps";

/** Cycles through `n` states every `ms`. */
function useCycle(n: number, ms: number) {
  const [i, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((v) => (v + 1) % n), ms);
    return () => clearInterval(id);
  }, [n, ms]);
  return i;
}

const hue = (n: number) => ({ "--h": n }) as CSSProperties;

// the Sith Academy on Korriban, the game's own tile, with people in its halls (positions on the floor plan)
const ACADEMY = ASSET_BASE + "maps/137438953622/map_int_sith_academy_floor01.webp";
export function MapPreview() {
  return (
    <div className="pv-map">
      <img className="pv-tile" src={ACADEMY} alt="" draggable={false} />
      <div className="pv-pin me" style={{ left: "52%", top: "50%", ...hue(200) }}>
        VA
      </div>
      <div className="pv-pin lfrp" style={{ left: "66%", top: "71%", ...hue(330) }}>
        RO
        <b>· LFRP</b>
      </div>
      <div className="pv-pin" style={{ left: "39%", top: "22%", ...hue(40) }}>
        TN
      </div>
      <div className="pv-pin" style={{ left: "88%", top: "43%", ...hue(120) }}>
        DV
      </div>
      <div className="pv-pin ghost" style={{ left: "21%", top: "69%" }}>
        KE
      </div>
      <div className="pv-floor">
        <span className="crumb">Korriban › </span>Sith Academy
      </div>
    </div>
  );
}

const ORDER: RPStatus[] = ["ic", "ooc", "invisible"];
export function StatusPreview() {
  const i = useCycle(ORDER.length, 1700);
  const status = ORDER[i];
  const lfrp = status === "ic";
  return (
    <div className="pop pv-pop">
      <div className="hd">
        <Avatar p={{ name: "Vashti Arano", hue: 200 }} status={status} bg="var(--bg-side)" />
        <div>
          <div className="nm">Vashti Arano</div>
          <div className="sv">Darth Malgus</div>
        </div>
      </div>
      {ORDER.map((k) => (
        <div
          key={k}
          className={`item ${status === k ? "on" : ""}`}
          style={{ "--sc": STATUS_META[k].color } as CSSProperties}
        >
          <span className="d" />
          <div>
            <div className="l">{STATUS_META[k].label}</div>
            <div className="h">{STATUS_META[k].hint}</div>
          </div>
        </div>
      ))}
      <div className="pv-lfrp" style={{ "--c": LFRP_COLOR } as CSSProperties}>
        <i className={lfrp ? "beacon on" : ""} />
        Looking for RP
        <span className={`sw sm ${lfrp ? "on" : ""}`} />
      </div>
    </div>
  );
}

const ROWS = [
  { name: "Tess Marrow", hue: 330, where: "Nar Shaddaa · Lower Promenade", status: "ic" as RPStatus, friend: true },
  { name: "Dorn Vashti", hue: 40, where: "Coruscant · Dealer's Den", status: "ic" as RPStatus, friend: false },
  { name: "Kel Arano", hue: 120, where: "Dromund Kaas · Nexus Room", status: "ooc" as RPStatus, friend: false },
];
export function RegistryPreview() {
  const i = useCycle(ROWS.length, 1400);
  return (
    <div className="pv-reg">
      {ROWS.map((r, n) => (
        <div key={r.name} className={`pv-row ${n === i ? "hover" : ""}`}>
          <Avatar p={r} status={r.status} bg="var(--bg-raised)" />
          <div className="who">
            <b>
              {r.name}
              {r.friend && (
                <span className="chip friend">
                  <i>{Icons.friendOn({ width: 11, height: 11 })}</i>Friend
                </span>
              )}
            </b>
            <span>{r.where}</span>
          </div>
          <span className="chip st" style={{ "--sc": STATUS_META[r.status].color } as CSSProperties}>
            <i className="d" />
            {STATUS_META[r.status].short}
          </span>
        </div>
      ))}
    </div>
  );
}

export function NotesPreview() {
  return (
    <div className="pv-notes">
      <div className="head">
        <span>Notes</span>
        <Private />
      </div>
      <div className="line h" style={{ animationDelay: "0.1s" }}>
        Slippery Slopes, Tuesday
      </div>
      <div className="line" style={{ animationDelay: "0.5s" }}>
        Runs the sabacc table by the bar. Owes Vashti 200 credits and knows it.
      </div>
      <div className="line" style={{ animationDelay: "0.9s" }}>
        Asked about the shipment to Hutta. Did not say why.
      </div>
      <div className="line dim" style={{ animationDelay: "1.3s" }}>
        <span className="crumb">from the game's friends list ·</span> "sabacc. do not lend"
      </div>
    </div>
  );
}

export function OverlayPreview() {
  const near = [
    { name: "Tess Marrow", status: "ic" as RPStatus, lfrp: true, m: 12 },
    { name: "Dorn Vashti", status: "ic" as RPStatus, lfrp: false, m: 38 },
    { name: "Kel Arano", status: "ooc" as RPStatus, lfrp: false, m: 140 },
  ];
  return (
    <div className="pv-game">
      <div className="ov locked pv-ov" style={{ "--ov-opacity": 0.92, "--ov-scale": 1 } as CSSProperties}>
        <div className="ov-card">
          <div className="ov-head">
            <span className="ov-planet">Nar Shaddaa</span>
            <span className="ov-me" style={{ "--sc": STATUS_META.ic.color } as CSSProperties}>
              <i className="d" />
              IC<em>inst 2</em>
            </span>
          </div>
          <div className="ov-where">Lower Promenade</div>
          <ul className="ov-list">
            {near.map((p) => (
              <li
                key={p.name}
                className={p.lfrp ? "lfrp" : ""}
                style={{ "--sc": STATUS_META[p.status].color } as CSSProperties}
              >
                <i className="d" />
                <span className="nm">{p.name}</span>
                {p.lfrp && <b className="ov-lfrp">LFRP</b>}
                <span className="m">{p.m} m</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
