"use client";
// Why it exists, as a conversation: a newcomer and a regular explain it to each other in the game's own chat, the
// way it actually gets explained in cantinas every week. Lines arrive one by one as the window scrolls into view.
import { motion } from "motion/react";
import { Reveal } from "./Reveal";
import s from "./Why.module.css";

type Line = { who: string; kind: "say" | "emote"; text: string };

const CHAT: Line[] = [
  { who: "Ysolde Marr", kind: "say", text: "In my old game an addon showed who was in character. Where is that here?" },
  { who: "Talyn Ressk", kind: "say", text: "There isn't one. This game doesn't let addons in." },
  { who: "Ysolde Marr", kind: "say", text: "Then how did you find all these people?" },
  {
    who: "Talyn Ressk",
    kind: "say",
    text: "The game writes a text file on your computer. Where you are, what you're up to, line by line.",
  },
  {
    who: "Talyn Ressk",
    kind: "say",
    text: "Hydian reads it and puts everyone who shares on a map. That's how I saw you.",
  },
  { who: "Ysolde Marr", kind: "emote", text: "pulls up a stool and opens Hydian." },
];

export function Why() {
  return (
    <section id="why" className={s.wrap}>
      <div className={s.cols}>
        <Reveal className={s.copy}>
          <div className="section-label">
            <span>B</span>
            <p>Why it exists</p>
          </div>
          <h2>Roleplayers in other games have addons. We have a text file.</h2>
          <p className={s.lead}>
            It&apos;s the question every newcomer asks. Here is the answer, the way it usually gets told: over a drink,
            in the game.
          </p>
          <p className={s.small}>
            The file never says which instance you&apos;re in, so you set that yourself. Everything else, Hydian reads
            for you.
          </p>
        </Reveal>

        <Reveal className={s.chat} delay={0.1}>
          <div className={s.tabs} aria-hidden>
            <span className={s.on}>Voss</span>
            <span>Guild</span>
            <span>Whispers</span>
          </div>
          <ol className={s.log}>
            {CHAT.map((l, i) => (
              <motion.li
                key={i}
                className={l.kind === "emote" ? s.emote : s.say}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.9, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {l.kind === "emote" ? (
                  <>
                    <span className={s.who}>{l.who}</span> {l.text}
                  </>
                ) : (
                  <>
                    <span className={s.who}>{l.who}</span> says: {l.text}
                  </>
                )}
              </motion.li>
            ))}
          </ol>
          <div className={s.input} aria-hidden>
            <span>/say</span>
            <i />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
