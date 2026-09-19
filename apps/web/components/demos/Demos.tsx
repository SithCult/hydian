"use client";
// Rendered demos of the app's pieces, in the site's own styling. Names are invented.
import { useEffect, useState, type CSSProperties } from "react";
import s from "./Demos.module.css";

const hue = (h: number) => ({ "--h": h }) as CSSProperties;

function useCycle(n: number, ms: number) {
  const [i, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((v) => (v + 1) % n), ms);
    return () => clearInterval(id);
  }, [n, ms]);
  return i;
}

const STATUS = [
  { key: "ic", label: "In Character", hint: "approach in character", c: "var(--ic)" },
  { key: "ooc", label: "Out of Character", hint: "on the map, not roleplaying", c: "var(--ooc)" },
  { key: "off", label: "Invisible", hint: "off the map", c: "#6d7286" },
];

export function StatusDemo() {
  const i = useCycle(STATUS.length, 1800);
  const lfrp = i === 0;
  return (
    <div className={`${s.card} ${s.status}`}>
      <div className={s.who}>
        <span className="avatar" style={hue(200)}>
          VA
          <i className="sd" style={{ "--c": STATUS[i].c } as CSSProperties} />
        </span>
        <div>
          <b>Vashti Arano</b>
          <span>Darth Malgus</span>
        </div>
      </div>
      {STATUS.map((o, n) => (
        <div key={o.key} className={`${s.opt} ${n === i ? s.on : ""}`}>
          <i style={{ "--c": o.c } as CSSProperties} />
          <b>{o.label}</b>
          <span>{o.hint}</span>
        </div>
      ))}
      <div className={s.lfrp}>
        <i className={lfrp ? s.beacon : s.dot} />
        Looking for RP
        <span className={`${s.sw} ${lfrp ? s.swOn : ""}`} />
      </div>
    </div>
  );
}

const ROWS = [
  { n: "Tess Marrow", h: 330, w: "Nar Shaddaa · Lower Promenade", st: "ic", friend: true },
  { n: "Dorn Vashti", h: 40, w: "Coruscant · Dealer's Den", st: "ic", friend: false },
  { n: "Kel Arano", h: 120, w: "Dromund Kaas · Nexus Room", st: "ooc", friend: false },
];
export function RegistryDemo() {
  const i = useCycle(ROWS.length, 1500);
  return (
    <div className={`${s.card} ${s.reg}`}>
      {ROWS.map((r, n) => (
        <div key={r.n} className={`${s.row} ${n === i ? s.hl : ""}`}>
          <span className="avatar" style={hue(r.h)}>
            {r.n
              .split(" ")
              .map((x) => x[0])
              .join("")}
            <i className="sd" style={{ "--c": r.st === "ic" ? "var(--ic)" : "var(--ooc)" } as CSSProperties} />
          </span>
          <div>
            <b>
              {r.n}
              {r.friend && <em className={s.chip}>Friend</em>}
            </b>
            <span>{r.w}</span>
          </div>
          <i className={s.st} style={{ "--c": r.st === "ic" ? "var(--ic)" : "var(--ooc)" } as CSSProperties}>
            {r.st.toUpperCase()}
          </i>
        </div>
      ))}
      <div className={`${s.row} ${s.ghostRow}`}>
        <span className="avatar ghost">?</span>
        <div>
          <b>Sivelk Vim</b>
          <span>seen 8 min ago · not on Hydian</span>
        </div>
      </div>
    </div>
  );
}

export function NotesDemo() {
  return (
    <div className={`${s.card} ${s.notes}`}>
      <div className={s.nhead}>
        Notes <span className={s.private}>Private</span>
      </div>
      <h4>Slippery Slopes, Tuesday</h4>
      <p>Runs the sabacc table by the bar. Owes Vashti 200 credits and knows it.</p>
      <p>Asked about the shipment to Hutta. Did not say why.</p>
      <p className={s.dim}>from the game&apos;s friends list · &ldquo;sabacc, do not lend&rdquo;</p>
    </div>
  );
}

export function OverlayDemo() {
  return (
    <div className={s.game}>
      <div className={s.ov}>
        <div className={s.ovHead}>
          <b>Nar Shaddaa</b>
          <span>
            <i className="d ic" />
            IC · inst 2
          </span>
        </div>
        <div className={s.ovWhere}>Lower Promenade</div>
        <ul>
          <li>
            <i className="d ic" />
            Tess Marrow<em>LFRP</em>
            <span>12 m</span>
          </li>
          <li>
            <i className="d ic" />
            Dorn Vashti<span>38 m</span>
          </li>
          <li>
            <i className="d ooc" />
            Kel Arano<span>140 m</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
