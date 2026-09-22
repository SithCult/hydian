"use client";
// What Windows shows the first time the installer runs, drawn rather than screenshotted so it stays sharp and
// matches the page. Appears once the download has started.
import { motion } from "motion/react";
import { SITE } from "@/lib/site";
import s from "./FirstRun.module.css";

function Dialog({ expanded }: { expanded?: boolean }) {
  return (
    <div className={s.dlg} aria-hidden>
      <div className={s.dlgBar}>
        <span className={s.dlgX}>✕</span>
      </div>
      <p className={s.dlgTitle}>Windows protected your PC</p>
      <p className={s.dlgBody}>
        Microsoft Defender SmartScreen prevented an unrecognised app from starting. Running this app might put your PC
        at risk.
      </p>
      {expanded ? (
        <dl className={s.dlgFacts}>
          <dt>App:</dt>
          <dd>Hydian-Setup.exe</dd>
        </dl>
      ) : (
        <p className={`${s.dlgLink} ${s.mark}`}>More info</p>
      )}
      <div className={s.dlgButtons}>
        {expanded && <span className={`${s.dlgBtn} ${s.mark}`}>Run anyway</span>}
        <span className={s.dlgBtn}>Don&apos;t run</span>
      </div>
    </div>
  );
}

export function FirstRun() {
  return (
    <motion.section
      className={s.wrap}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className={s.head}>
        <p className="hud">On the first launch</p>
        <h2>Windows will ask once.</h2>
        <p className={s.lead}>
          The installer carries a signature, so Windows can tell you who built it and prove the file has not been
          touched since. It still shows this prompt for any app it has not seen often yet, and it stops once enough
          people have installed Hydian.
        </p>
      </div>

      <ol className={s.steps}>
        <li>
          <span className={s.n}>1</span>
          <div>
            <b>More info</b>
            <p>The dialog opens small. That link shows you the file name and who signed it.</p>
          </div>
          <Dialog />
        </li>
        <li>
          <span className={s.n}>2</span>
          <div>
            <b>Run anyway</b>
            <p>
              The dialog now names the file: <b>Hydian-Setup.exe</b>. Install it as usual.
            </p>
          </div>
          <Dialog expanded />
        </li>
      </ol>

      <div className={s.source}>
        <div className={s.sourceGlow} aria-hidden />
        <div>
          <p className="hud">Nothing to take on trust</p>
          <h3>Every line of Hydian is public.</h3>
          <p>
            The app, the backend and this website are open source under the MIT licence. Read what it does with your log
            file, build it yourself, or send a change.
          </p>
        </div>
        <div className={s.sourceCta}>
          <a className="btn primary" href={SITE.github} target="_blank" rel="noopener noreferrer">
            Read the source
          </a>
          <a className="btn" href={SITE.releases} target="_blank" rel="noopener noreferrer">
            This release
          </a>
        </div>
      </div>
    </motion.section>
  );
}
