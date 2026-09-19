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
    </section>
  );
}
