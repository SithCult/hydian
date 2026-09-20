"use client";
// A holoprojector rendering of the live map: rooms draw themselves, pins drift, the LFRP pin pings.
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useState } from "react";
import { SITE } from "@/lib/site";
import { Reveal } from "./Reveal";
import s from "./HoloMap.module.css";

// the game's own map tiles for the Sith Academy on Korriban, served by the Hydian tiles service. Pins sit in
// rooms and corridors of the floor they belong to; each floor has its own set.
const FLOORS = [
  { key: "1", label: "Sith Academy", tile: "maps/137438953622/map_int_sith_academy_floor01.webp" },
  { key: "2", label: "Sith Academy · Level 2", tile: "maps/137438953622/map_int_sith_academy_floor02.webp" },
] as const;

// [x, y] in the 720 x 540 stage, per floor
const SPOTS = [
  { me: [377, 273], a: [337, 79], b: [636, 247], lfrp: [281, 444] },
  { me: [489, 219], a: [194, 135], b: [665, 233], lfrp: [672, 430] },
] as const;

export function HoloMap() {
  const [floor, setFloor] = useState(0);
  const spots = SPOTS[floor];
  const at = ([x, y]: readonly [number, number]) => `translate(${x} ${y})`;
  const px = useMotionValue(0),
    py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 80, damping: 20 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 80, damping: 20 });
  return (
    <section id="map" className={s.wrap}>
      <Reveal className={s.holo}>
        <motion.div
          className={s.frame}
          style={{ rotateX: rx, rotateY: ry }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            px.set((e.clientX - r.left) / r.width - 0.5);
            py.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => {
            px.set(0);
            py.set(0);
          }}
        >
          <div className={s.head}>
            <span className="hud">Korriban · {FLOORS[floor].label}</span>
            <div className={s.levels} role="group" aria-label="Level">
              {FLOORS.map((f, i) => (
                <button key={f.key} className={i === floor ? s.on : ""} onClick={() => setFloor(i)}>
                  {f.key}
                </button>
              ))}
            </div>
          </div>
          <div className={s.stage}>
            {FLOORS.map((f, i) => (
              <motion.img
                key={f.key}
                src={`${SITE.tiles}${f.tile}`}
                alt=""
                className={s.tile}
                draggable={false}
                initial={false}
                animate={{ opacity: i === floor ? 1 : 0, scale: i === floor ? 1 : 1.03 }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              />
            ))}
            <svg className={s.map} viewBox="0 0 720 540" aria-label="A rendered preview of the live map">
              <g className={s.pins}>
                <g className={s.pin} style={{ "--h": 40 } as React.CSSProperties} transform={at(spots.a)}>
                  <circle r="12" />
                  <text>TN</text>
                </g>
                <g className={s.pin} style={{ "--h": 120 } as React.CSSProperties} transform={at(spots.b)}>
                  <circle r="12" />
                  <text>DV</text>
                </g>
                <g
                  className={`${s.pin} ${s.lfrp}`}
                  style={{ "--h": 330 } as React.CSSProperties}
                  transform={at(spots.lfrp)}
                >
                  <circle className={s.sonar} r="12" />
                  <circle className={`${s.sonar} ${s.s2}`} r="12" />
                  <circle r="12" />
                  <text>RO</text>
                  <text className={s.tag} y="30">
                    · LFRP
                  </text>
                </g>
                <g
                  className={`${s.pin} ${s.me}`}
                  style={{ "--h": 200 } as React.CSSProperties}
                  transform={at(spots.me)}
                >
                  <circle className={s.pulse} r="18" />
                  <circle r="14" />
                  <text>VA</text>
                  <text className={s.tag} y="32">
                    you
                  </text>
                </g>
              </g>
              <rect className={s.scan} x="0" y="0" width="720" height="2" />
            </svg>
          </div>
          <div className={`${s.callout} ${s.c1}`}>
            <span />
            floor from the log
          </div>
          <div className={`${s.callout} ${s.c2}`}>
            <span />
            looking for RP
          </div>
          <div className={s.foot}>
            <span>
              <i className="d ic" />
              In Character
            </span>
            <span>
              <i className="d ooc" />
              Out of Character
            </span>
            <span>
              <i className="d lfrp" />
              Looking for RP
            </span>
          </div>
        </motion.div>
      </Reveal>
      <Reveal className={s.copy} delay={0.15}>
        <div className="section-label">
          <span>C</span>
          <p>The map is the game&apos;s own</p>
        </div>
        <h2>The real maps. Every floor.</h2>
        <p>
          Planets, regions and every interior: the artwork the game itself shows, with the game&apos;s names. Your floor
          comes from the log, so the Academy&apos;s second level means the second one. Stacked floors switch with a key,
          or open up in the 3D view.
        </p>
      </Reveal>
    </section>
  );
}
