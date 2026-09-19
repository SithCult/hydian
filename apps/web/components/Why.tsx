// Why it exists, as a picture: other games hand addons everything; this one writes a log line, and Hydian turns
// the line into the map. The log line types itself out and the outputs light up, on a loop.
import { Reveal } from "./Reveal";
import s from "./Why.module.css";

const LINE = "[22:41:07] [@Vashti Arano] [Nar Shaddaa: Lower Promenade] (-953, -919)";

export function Why() {
  return (
    <section id="why" className={s.wrap}>
      <Reveal className="section-head">
        <div className="section-label">
          <span>B</span>
          <p>Why it exists</p>
        </div>
        <h2>Roleplayers in other games have addons. We have a text file.</h2>
        <p className={s.lead}>
          In World of Warcraft an addon can show you who is in character and where, because the game lets addons in. The
          Old Republic lets nothing in. The one thing it gives you is a combat log on your own hard drive. Hydian reads
          that log and turns it into what an addon would have shown you.
        </p>
      </Reveal>
      <div className={s.grid}>
        <Reveal className={s.other}>
          <p className="hud dim">Other games</p>
          <div className={s.socket} aria-hidden>
            <div className={s.window}>
              <i />
              <i />
              <i />
            </div>
            <div className={s.plugs}>
              <span>profiles</span>
              <span>status</span>
              <span>who is IC</span>
            </div>
          </div>
          <p>Elsewhere, addons plug straight into the game and get told everything.</p>
        </Reveal>

        <Reveal className={s.here} delay={0.1}>
          <p className="hud">The Old Republic</p>
          <div className={s.pipe} aria-hidden>
            <div className={s.log}>
              <span className={s.file}>combat_2026-09-19.txt</span>
              <code className={s.typed}>{LINE}</code>
            </div>
            <div className={s.arrow}>
              <i />
              <i />
              <i />
            </div>
            <div className={s.outs}>
              <span className={s.o1}>live map</span>
              <span className={s.o2}>registry</span>
              <span className={s.o3}>overlay</span>
            </div>
          </div>
          <p>Here, the game writes one line per event. Hydian reads it and builds the rest.</p>
        </Reveal>
      </div>
      <Reveal className={s.foot} delay={0.2}>
        One thing the log never says is your server instance, so you set that by hand. Everything it does say, you get.
      </Reveal>
    </section>
  );
}
