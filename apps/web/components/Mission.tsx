import { Reveal } from "@/components/Reveal";
import s from "./Mission.module.css";

/** The mission: roleplay back out in the world, where the game was built for it. */
export function Mission() {
  return (
    <section id="mission" className={s.wrap}>
      <Reveal className={s.copy}>
        <div className="section-label">
          <span>A</span>
          <p>The mission</p>
        </div>
        <h2>We love open world roleplay.</h2>
        <p className={s.lead}>
          We have played The Old Republic since the beta. Its cantinas, promenades and temples were built for stories,
          and for years that is where they happened: with whoever walked past.
        </p>
        <p>
          Roleplay has since moved into closed circles: strongholds, guild channels, Discord servers, groups who already
          know each other. Nothing wrong with any of that. But outside a few hotspots there is no way to know another
          roleplayer is standing in the same building, so the world itself went quiet.
        </p>
        <p className={s.last}>Hydian gives you that one missing thing, so the open world can be busy again.</p>
      </Reveal>
      <Reveal className={s.photo} delay={0.1}>
        <img
          src="/photos/cave.webp"
          srcSet="/photos/cave-900.webp 900w, /photos/cave.webp 1800w"
          sizes="(max-width: 1160px) 100vw, 1160px"
          width={1800}
          height={787}
          alt="A circle of roleplayers gathered in a cave, in game"
          loading="lazy"
          decoding="async"
        />
        <span className={s.cap}>Out in the world, where it started.</span>
      </Reveal>
    </section>
  );
}
