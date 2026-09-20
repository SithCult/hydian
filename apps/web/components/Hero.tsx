"use client";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { SITE } from "@/lib/site";
import { PlatformDownloadLinks } from "./PlatformDownloadLinks";
import { useEffect } from "react";
import s from "./Hero.module.css";

const ease = [0.2, 0.8, 0.2, 1] as const;
const up = (delay: number) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease },
});

export function Hero() {
  // the icon leans toward the pointer; springs keep it heavy and smooth
  const px = useMotionValue(0),
    py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), { stiffness: 60, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), { stiffness: 60, damping: 18 });
  const glintX = useTransform(px, [-0.5, 0.5], ["120%", "-20%"]);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / innerWidth - 0.5);
      py.set(e.clientY / innerHeight - 0.5);
    };
    addEventListener("pointermove", onMove);
    return () => removeEventListener("pointermove", onMove);
  }, [px, py]);

  return (
    <section className={s.hero}>
      <div className={s.grain} aria-hidden />
      <div className={s.copy}>
        <motion.h1 {...up(0.1)}>
          See where <span className={s.accent}>roleplay</span> is happening.
        </motion.h1>
        <motion.p className={s.lead} {...up(0.22)}>
          Roleplay in The Old Republic went into closed circles because there was no way to find people out in the
          world. Hydian shows every roleplayer who shares their position on the game&apos;s own maps, down to the floor
          of the cantina. Open source, no account.
        </motion.p>
        <motion.div className={s.cta} {...up(0.34)}>
          <PlatformDownloadLinks />
        </motion.div>
        <motion.a className={s.source} href={SITE.github} target="_blank" rel="noopener noreferrer" {...up(0.44)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Open source on GitHub
        </motion.a>
      </div>

      <motion.div
        className={s.stage}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease }}
      >
        <div className={s.halo} />
        <div className={`${s.ring} ${s.r1}`} />
        <div className={`${s.ring} ${s.r2}`} />
        <div className={`${s.ring} ${s.r3}`} />
        <motion.div className={s.icon} style={{ rotateX: rx, rotateY: ry }}>
          <img src="/icon.webp" width={320} height={320} alt="" draggable={false} />
          <motion.i className={s.glint} style={{ backgroundPositionX: glintX }} />
        </motion.div>
      </motion.div>
    </section>
  );
}
