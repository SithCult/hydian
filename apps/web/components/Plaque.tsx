import s from "./Plaque.module.css";

/** A mounted plaque: how the software is made, engraved rather than written. */
export function Plaque() {
  return (
    <figure className={s.wrap}>
      <div className={s.plate} role="img" aria-label="Made by humans. Crafted with AI.">
        <i className={`${s.screw} ${s.tl}`} />
        <i className={`${s.screw} ${s.tr}`} />
        <i className={`${s.screw} ${s.bl}`} />
        <i className={`${s.screw} ${s.br}`} />
        <div className={s.frame}>
          <p className={s.kicker}>Hydian</p>
          <p className={s.title}>
            Made by humans.
            <br />
            Crafted with AI.
          </p>
          <p className={s.body}>
            We were developers before the AI boom and still hold our work to that standard. AI tools help us build
            faster; the design, the decisions and the final word are ours. Every feature in Hydian was planned, reviewed
            and tested by a person. We firmly stand against soulless AI slop.
          </p>
          <div className={s.foot}>
            <span className={s.stamps}>
              <span className={s.stamp} style={{ maskImage: "url(/badges/co-created-mono.svg)" }} />
              <span className={s.stamp} style={{ maskImage: "url(/badges/human-in-the-loop-mono.svg)" }} />
            </span>
            <span className={s.est}>SithCult · open source, MIT</span>
          </div>
        </div>
      </div>
      <figcaption className={s.cap}>
        The stamps are the Co-created with AI and Human in the Loop badges from{" "}
        <a href="https://madebyhuman.iamjarl.com/">Made by Human</a>, MIT licensed.
      </figcaption>
    </figure>
  );
}
