"use client";
// The screen after the download starts: what the first launch looks like, and what to do with the app.
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SITE } from "@/lib/site";
import { useDesktopOs } from "@/lib/platform";
import { FirstRun } from "./FirstRun";
import s from "./Started.module.css";

const FILES = { windows: "Hydian-Setup.exe", macArm: "Hydian-AppleSilicon.dmg", macIntel: "Hydian-Intel.dmg" };
/** Which build was taken, so this screen names the file the person now has. ?f= comes from the button. */
const fileKey = (os: "windows" | "mac", q: string | null): keyof typeof FILES =>
  os === "windows" ? "windows" : q === "macIntel" ? "macIntel" : "macArm";

const up = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] as const },
});

export function Started() {
  const os = useDesktopOs();
  const [version, setVersion] = useState<string | null>(null);
  const [key, setKey] = useState<keyof typeof FILES | null>(null);
  useEffect(() => setKey(fileKey(os, new URLSearchParams(location.search).get("f"))), [os]);
  useEffect(() => {
    fetch(`${SITE.downloads}/latest/releases.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r: { version?: string } | null) => r?.version && setVersion(r.version))
      .catch(() => {});
  }, []);
  const file = FILES[key ?? fileKey(os, null)];
  const again = `${SITE.downloads}/latest/${file}`;

  return (
    <div className={s.wrap}>
      <motion.header className={s.head} {...up(0)}>
        <span className={s.tick} aria-hidden>
          <svg viewBox="0 0 24 24" width="30" height="30">
            <path
              d="M4 12.5l5.2 5.2L20 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="hud">Download started</p>
        <h1>Hydian is on its way.</h1>
        <p className={s.lead}>
          {file}
          {version ? ` · version ${version}` : ""}. Check your downloads folder.{" "}
          <a href={again} download>
            Start it again
          </a>{" "}
          if nothing happened.
        </p>
      </motion.header>

      {os === "windows" ? (
        <motion.div {...up(0.1)}>
          <FirstRun />
        </motion.div>
      ) : (
        <motion.section className={s.mac} {...up(0.1)}>
          <p className="hud">On macOS</p>
          <h2>Open the disk image, drag Hydian to Applications.</h2>
          <p>
            The first launch can ask you to confirm an app from outside the App Store: right-click Hydian, then Open.
            macOS remembers the answer.
          </p>
        </motion.section>
      )}

      <motion.section className={s.next} {...up(0.18)}>
        <p className="hud dim">Once it is installed</p>
        <ol>
          <li>
            <b>Turn on combat logging in the game.</b> Preferences, Combat Logging, Enable Combat Logging to File. That
            file is what Hydian reads.
          </li>
          <li>
            <b>Play for a minute.</b> Your characters show up on their own; every one of them starts Invisible.
          </li>
          <li>
            <b>Set the character you play to In Character.</b> Then open the map and light a beacon if you are looking
            for a scene.
          </li>
        </ol>
        <div className={s.nextCta}>
          <a className="btn" href="/">
            Back to hydian.org
          </a>
          <a className="btn" href="/privacy">
            What leaves your device
          </a>
        </div>
      </motion.section>
    </div>
  );
}
