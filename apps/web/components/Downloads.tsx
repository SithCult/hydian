"use client";
// Versioned downloads keep cached installers consistent with the displayed release.
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SITE } from "@/lib/site";
import s from "./Downloads.module.css";
import { AppleLogo, WindowsLogo } from "./OsLogos";
import { AppShot } from "./AppShot";
import { useDesktopOs, type DesktopOs } from "@/lib/platform";

type FileKey = "windows" | "macArm" | "macIntel";
interface Release {
  version: string;
  date: string;
  notes: string;
  files: Record<FileKey, { path: string; size: number }>;
}
const FILES: Record<FileKey, string> = {
  windows: "Hydian-Setup.exe",
  macArm: "Hydian-AppleSilicon.dmg",
  macIntel: "Hydian-Intel.dmg",
};

const mb = (n?: number) => (n ? `${(n / 1048576).toFixed(0)} MB` : "");

const CARDS: Record<DesktopOs, { logo: React.ReactNode; name: string; req: string; note: string }> = {
  windows: {
    logo: <WindowsLogo size={40} />,
    name: "Windows",
    req: "Windows 10 or 11, 64-bit",
    note: "",
  },
  mac: {
    logo: <AppleLogo size={40} />,
    name: "macOS",
    req: "macOS 12 Monterey or later",
    note: "",
  },
};

function Buttons({ os, rel, primary }: { os: DesktopOs; rel: Release | null; primary: boolean }) {
  const cls = primary ? "btn primary" : "btn";
  const href = (k: FileKey) => `${SITE.downloads}/${rel ? `v${rel.version}` : "latest"}/${FILES[k]}`;
  const size = (k: FileKey) => rel?.files?.[k] && <span className={s.size}>{mb(rel.files[k].size)}</span>;
  if (os === "windows")
    return (
      <a className={cls} href={href("windows")} download>
        <WindowsLogo /> Windows installer
        {size("windows")}
      </a>
    );
  return (
    <>
      <a className={cls} href={href("macArm")} download>
        <AppleLogo /> Apple Silicon
        {size("macArm")}
      </a>
      <a className="btn" href={href("macIntel")} download>
        <AppleLogo /> Intel{size("macIntel")}
      </a>
    </>
  );
}

export function Downloads() {
  const os = useDesktopOs();
  const [rel, setRel] = useState<Release | null>(null);
  useEffect(() => {
    fetch(`${SITE.downloads}/latest/releases.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r: Release | null) => {
        if (!r) return;
        setRel({
          ...r,
          date: new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        });
      })
      .catch(() => {});
  }, []);
  const other: DesktopOs = os === "windows" ? "mac" : "windows";
  const main = CARDS[os];
  return (
    <div className={s.wrap}>
      <motion.section
        className={s.primary}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className={s.logo}>{main.logo}</div>
        <p className="hud">Download for {main.name}</p>
        <h1>Hydian for {main.name}</h1>
        <p className={s.meta}>
          {rel ? (
            <>
              Version <b>{rel.version}</b> · {rel.date} · {main.req}
            </>
          ) : (
            <>{main.req}</>
          )}
        </p>
        <div className={s.buttons}>
          <Buttons os={os} rel={rel} primary />
        </div>
        {main.note && <p className={s.note}>{main.note}</p>}
      </motion.section>

      <motion.section
        className={s.others}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <p className="hud dim">Also available for</p>
        <div className={s.card}>
          <div className={s.cardLogo}>{CARDS[other].logo}</div>
          <div className={s.cardBody}>
            <h3>Hydian for {CARDS[other].name}</h3>
            <p>{CARDS[other].req}</p>
          </div>
          <div className={s.cardButtons}>
            <Buttons os={other} rel={rel} primary={false} />
          </div>
        </div>
      </motion.section>

      <AppShot tight />

      <section className={s.after}>
        <div>
          <p className="hud dim">After the install</p>
          <ol>
            <li>Hydian lists your characters as soon as you have played with combat logging on.</li>
            <li>Every character starts Invisible. Set the one you play to In Character.</li>
            <li>Open the map. Light a beacon if you are looking for a scene.</li>
          </ol>
        </div>
        <div>
          <p className="hud dim">Good to know</p>
          <ul>
            <li>Turn on combat logging in the game: Preferences, Combat Logging, Enable Combat Logging to File.</li>
            <li>
              Every release and its notes: <a href={SITE.releases}>GitHub releases</a>. Source:{" "}
              <a href={SITE.github}>github.com/SithCult/hydian</a>.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
