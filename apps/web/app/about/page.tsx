import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { Plaque } from "@/components/Plaque";
import { SITE } from "@/lib/site";
import s from "../page.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "Why Hydian exists, who makes it and how to reach us.",
  alternates: { canonical: "/about" },
};

const CONTACT = [
  ["General", "hello@hydian.org"],
  ["Legal", "legal@hydian.org"],
  ["Security", "security@hydian.org"],
];

export default function About() {
  return (
    <main className={s.page}>
      <Reveal>
        <p className="hud">About</p>
        <h1>Bringing roleplay back into the open world.</h1>
        <p className={s.lead}>
          We have played this game since the beta and care about it deeply. Its worlds were built for stories, and for
          years people told them out there: on the Promenade, in the cantinas, on the steps of the Academy, with whoever
          happened to walk past.
        </p>
      </Reveal>
      <Reveal delay={0.1} className={s.prose}>
        <h2>Why</h2>
        <p>
          Roleplay in The Old Republic has moved into closed circles: guild channels, strongholds, Discord servers,
          groups of friends who already know each other. Nothing wrong with any of that; we play there too. But it did
          not happen because people stopped wanting to play with strangers. The game gives you no way to find them.
          Outside the few known hotspots, another roleplayer can be on the same planet, in the same building, and you
          would never know.
        </p>
        <p>
          Hydian exists to fix that one missing piece. It shows who is out there and where, on the game&apos;s own maps,
          so a walk through Kaas City can turn into a scene again and a new player can find people on their first
          evening. Our aim is simple: make the open world the place where roleplay happens.
        </p>

        <h2>Who</h2>
        <p>
          Hydian is made by <a href={SITE.github}>SithCult</a>, Star Wars fans who roleplay in The Old Republic. The
          code is open source under the MIT licence.
        </p>
        <div className={s.photos}>
          <figure>
            <img
              src="/photos/plaza.webp"
              srcSet="/photos/plaza-800.webp 800w, /photos/plaza.webp 1600w"
              sizes="(max-width: 720px) 100vw, 720px"
              width={1600}
              height={900}
              alt="Guild members walking across a plaza on Dromund Kaas, nameplates showing"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Dromund Kaas, guild night.</figcaption>
          </figure>
          <figure>
            <img
              src="/photos/ilum-overview.webp"
              width={800}
              height={600}
              alt="Dozens of characters lined up in the snow on Ilum, seen from a balcony"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Ilum, years ago. The screenshot is as old as the memory.</figcaption>
          </figure>
        </div>
        <p>
          Hydian is a fan project, not affiliated with Electronic Arts, BioWare, Broadsword or Lucasfilm. Star Wars: The
          Old Republic and related marks belong to their owners.
        </p>

        <h2>Contact</h2>
        <div className={s.contact}>
          {CONTACT.map(([k, mail]) => (
            <div key={mail}>
              <span className="hud">{k}</span>
              <a href={`mailto:${mail}`}>{mail}</a>
            </div>
          ))}
        </div>

        <h2>Privacy</h2>
        <p>
          What the app reads, what it sends and how to delete it: <a href="/privacy">the privacy page</a>.
        </p>
      </Reveal>
      <Reveal delay={0.1} className={s.prose}>
        <h2>How it is made</h2>
        <Plaque />
      </Reveal>
    </main>
  );
}
