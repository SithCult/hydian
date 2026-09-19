import { SITE } from "@/lib/site";
import { GitHubLogo } from "./OsLogos";
import { PlatformDownloadLinks } from "./PlatformDownloadLinks";
import { Reveal } from "./Reveal";
import s from "./Sections.module.css";

export function DataReadout() {
  return (
    <section id="data" className={s.data}>
      <Reveal className="section-head">
        <div className="section-label">
          <span>E</span>
          <p>Your data</p>
        </div>
        <h2>Three things to know.</h2>
      </Reveal>
      <div className={s.rows}>
        <Reveal className={s.row}>
          <p className="hud">Hydian reads</p>
          <p>
            SWTOR combat logs for characters, positions and encounters, and game settings for character names, friends
            and notes.
          </p>
        </Reveal>
        <Reveal className={s.row} delay={0.06}>
          <p className="hud">Hydian sends</p>
          <p>
            Gameplay updates and log history for shared characters, nearby-player sightings and friend connections. Each
            character starts <em>Invisible</em>; its status controls public visibility.
          </p>
        </Reveal>
        <Reveal className={s.row} delay={0.12}>
          <p className="hud">Others see</p>
          <div>
            <div className={s.profile}>
              <span className="avatar" style={{ "--h": 200 } as React.CSSProperties}>
                VA
                <i className="sd" />
              </span>
              <div className={s.profileBody}>
                <b>Vashti Arano</b>
                <span>Darth Malgus</span>
                <span>Nar Shaddaa · Lower Promenade · inst 2</span>
              </div>
              <i className={s.profileStatus}>
                <em className="d ic" />
                In Character
              </i>
            </div>
            <p className={s.dataNote}>
              Shared characters appear with their status and in-game location. Your note text and journal stay on your
              device; friend connections are also stored by the service.
            </p>
          </div>
        </Reveal>
      </div>
      <Reveal className={s.dataFoot} delay={0.2}>
        Settings › Privacy lets you erase your installation&apos;s links to uploaded records. Read about uploads,
        retained gameplay samples and your controls: <a href="/privacy">Privacy</a>.
      </Reveal>
      <Reveal className={s.source} delay={0.25}>
        <div className={s.sourceMark}>
          <GitHubLogo size={28} />
        </div>
        <div className={s.sourceBody}>
          <h3>Do not take our word for it.</h3>
          <p>
            Everything on this page is in the code, and the code is public: what the app reads, what it sends, what the
            server keeps. Read it, open an issue, send a pull request.
          </p>
        </div>
        <div className={s.sourceActions}>
          <a className="btn primary small" href={SITE.github}>
            <GitHubLogo /> Read the source
          </a>
          <a className="btn small" href={`${SITE.github}/blob/main/CONTRIBUTING.md`}>
            Contribute
          </a>
        </div>
      </Reveal>
    </section>
  );
}

const ROUTE = [
  {
    title: "Now",
    items: [
      "Windows & macOS",
      "Live map, registry, overlay",
      "Friends, notes, journal",
      "Heat map & activity",
      "Automatic updates",
    ],
  },
  {
    title: "Next",
    items: ["More languages", "More planets, every interior"],
  },
  {
    title: "With enough support",
    later: true,
    items: [
      "Verified characters and optional accounts",
      "Guild registry",
      "Guild tools: rosters, events, recruitment",
      "Discord integration: who is in character, posted to your server",
    ],
  },
];

export function Route() {
  return (
    <section id="route" className={s.narrow}>
      <Reveal className="section-head">
        <div className="section-label">
          <span>F</span>
          <p>Hyperspace route</p>
        </div>
        <h2>Where this is going.</h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div className={s.route}>
          {ROUTE.map((n) => (
            <div key={n.title} className={`${s.node} ${n.later ? s.later : ""}`}>
              <i />
              <h3>{n.title}</h3>
              <ul>
                {n.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is this allowed?",
    a: (
      <>
        Hydian reads the combat log the game writes to your Documents folder. It is the same file the parsers read that
        raiders have used for a decade, <a href="https://ixparse.com/">StarParse</a> and{" "}
        <a href="https://parsely.io/">Parsely</a> among them, to measure their damage. Reading that file is part of the
        game. Hydian also reads game settings for characters, friends and notes, and checks process names for its
        overlay. It is an independent fan project.
      </>
    ),
  },
  {
    q: "What do other people see?",
    a: "For a character you set to In Character or Out of Character: its name, server, planet, position and status while you play. Class is sent along but never shown. There are no bios and no free text.",
  },
  {
    q: "What about people who are not on Hydian?",
    a: "When your log mentions someone nearby, targeting or grouping can add a dashed pin with a name and last-seen time. These observations come from your own log and can include players who are Invisible or use no Hydian app. Sightings also upload while your reporting character is shared; see Privacy for details.",
  },
  {
    q: "Does it run on a Mac?",
    a: "Yes. Apple Silicon and Intel, with the overlay, the menu-bar icon and the shortcuts, the same as on Windows.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Hydian is free and open source under the MIT licence.",
  },
];

export function Faq() {
  return (
    <section id="faq" className={s.narrow}>
      <Reveal className="section-head">
        <div className="section-label">
          <span>G</span>
          <p>FAQ</p>
        </div>
        <h2>Questions.</h2>
      </Reveal>
      <Reveal delay={0.1} className={s.faq}>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>
              <span>{f.q}</span>
              <i />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}

export function Download() {
  return (
    <Reveal>
      <section id="download" className={s.download}>
        <img
          className={s.dlPhoto}
          src="/photos/temple.webp"
          srcSet="/photos/temple-800.webp 800w, /photos/temple.webp 1600w"
          sizes="(max-width: 1000px) 100vw, 1000px"
          width={1600}
          height={900}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <div className={s.dlIcon}>
          <img src="/icon.webp" width={112} height={112} alt="" draggable={false} />
        </div>
        <h2 className={s.dlTitle}>Your next scene is already on the map.</h2>
        <p>Free, open source, no account. Windows and macOS.</p>
        <div className={s.cta}>
          <PlatformDownloadLinks />
          <a className={s.dlSource} href={SITE.github}>
            Source on GitHub
          </a>
        </div>
      </section>
    </Reveal>
  );
}

export function Footer() {
  return (
    <footer className={s.footer}>
      <p>
        Open source under the MIT licence, by <a href={SITE.github}>SithCult</a> ·{" "}
        <a href="/about">About &amp; contact</a> · <a href="/privacy">Privacy</a>
      </p>
      <p className="fine">{SITE.disclaimer}</p>
    </footer>
  );
}
