"use client";
// Scrollytelling: the copy scrolls, the demo panel on the right stays and morphs to the feature being read.
// The active step is the one whose centre is nearest the middle of the viewport, decided on scroll, so exactly
// one step is lit at any time.
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NotesDemo, OverlayDemo, RegistryDemo, StatusDemo } from "./demos/Demos";
import s from "./Showcase.module.css";

const FEATURES: { title: string; line: string; text: ReactNode; demo: ReactNode }[] = [
  {
    title: "Status",
    line: "Say what you are up to.",
    text: (
      <>
        <em>In Character</em>, <em>Out of Character</em> or <em>Invisible</em>, per character. Flip on{" "}
        <em>Looking for RP</em> and your pin sends out a beacon everyone on the planet can see. Set the instance you are
        in so people can actually find you.
      </>
    ),
    demo: <StatusDemo />,
  },
  {
    title: "Registry & friends",
    line: "Find players sharing right now.",
    text: (
      <>
        Active characters set to In Character or Out of Character, with their current location and status. Friend the
        people you play with and they sort to the top when sharing; your in-game friends come along on their own.
      </>
    ),
    demo: <RegistryDemo />,
  },
  {
    title: "Notes & journal",
    line: "Remember who owes you credits.",
    text: (
      <>
        Notes on the characters you meet, your in-game notes included, and a rich-text journal for your own
        character&apos;s story. Both are stored on your device and nowhere else.
      </>
    ),
    demo: <NotesDemo />,
  },
  {
    title: "In-game overlay",
    line: "A card over the game.",
    text: (
      <>
        Who is on Hydian near you, sorted by distance, with beacons, instance numbers and your floor. Transparent,
        click-through, locked with a shortcut. Hides when the game is not running.
      </>
    ),
    demo: <OverlayDemo />,
  },
];

export function Showcase() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLDivElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  // the thread on the left fills as the reader moves through the four
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 60%", "end 60%"] });
  const fill = useSpring(useTransform(scrollYProgress, [0, 1], ["0%", "100%"]), { stiffness: 140, damping: 30 });

  // The lit step is the one whose centre is nearest a line a little above the middle of the viewport (that is
  // where the eye reads). A new step only takes over once it is clearly nearer, so nothing flickers between two.
  const pick = useCallback(() => {
    const line = window.innerHeight * 0.45;
    const dist = steps.current.map((el) => {
      if (!el) return Infinity;
      const r = el.getBoundingClientRect();
      return Math.abs(r.top + r.height / 2 - line);
    });
    setActive((a) => {
      let best = a;
      dist.forEach((d, i) => {
        if (d < dist[best] - (i === a ? 0 : 40)) best = i;
      });
      return best;
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pick);
    };
    pick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [pick]);

  const jump = (i: number) => steps.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <section id="features" className={s.wrap}>
      <div className={s.steps}>
        <div className="section-label">
          <span>D</span>
          <p>Four things you do in it</p>
        </div>
        <div className={s.list} ref={list}>
          <motion.i className={s.thread} style={{ height: fill }} aria-hidden />
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => {
                steps.current[i] = el;
              }}
              className={`${s.step} ${active === i ? s.active : ""}`}
              onClick={() => jump(i)}
            >
              <span className={s.num} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className={s.body}>
                <h2>{f.title}</h2>
                <p className={s.line}>{f.line}</p>
                <p className={s.text}>{f.text}</p>
                <div className={s.mobileDemo}>{f.demo}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={s.stage}>
        <div className={s.panel}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className={s.demo}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {FEATURES[active].demo}
            </motion.div>
          </AnimatePresence>
          <div className={s.dots} aria-hidden>
            {FEATURES.map((f, i) => (
              <i key={f.title} className={i === active ? s.dotOn : ""} />
            ))}
          </div>
          <span className={s.counter} aria-hidden>
            {String(active + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}
