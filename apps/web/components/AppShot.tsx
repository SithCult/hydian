"use client";
// The app as it runs: a real capture, framed like a window. On the home page it rises into the hero and lies
// down flat as you scroll, the way product pages do; on the download page it just sits in the flow.
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import s from "./AppShot.module.css";

export function AppShot({ caption, tight }: { caption?: string; tight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start center"] });
  const tilt = useSpring(useTransform(scrollYProgress, [0, 1], [reduced || tight ? 0 : 10, 0]), {
    stiffness: 120,
    damping: 26,
  });
  const lift = useSpring(useTransform(scrollYProgress, [0, 1], [reduced || tight ? 0 : 36, 0]), {
    stiffness: 120,
    damping: 26,
  });
  return (
    <div ref={ref} className={`${s.wrap} ${tight ? s.tight : s.hero}`}>
      {!tight && <div className={s.glow} aria-hidden />}
      <motion.div
        className={s.frame}
        style={{ rotateX: tilt, y: lift }}
        onClick={() => !tight && ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        role={tight ? undefined : "button"}
        tabIndex={tight ? undefined : 0}
        onKeyDown={(e) => {
          if (!tight && (e.key === "Enter" || e.key === " "))
            ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <Image
          src="/app.webp"
          alt="Hydian on Darth Malgus: the Lower Promenade of Nar Shaddaa with two scenes in progress, friends, beacons and the members panel"
          width={2880}
          height={1800}
          sizes="(max-width: 1200px) 100vw, 1160px"
          priority
        />
      </motion.div>
      {caption && <p className={s.caption}>{caption}</p>}
    </div>
  );
}
