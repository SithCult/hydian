import s from "./page.module.css";

export default function NotFound() {
  return (
    <main className={s.lost}>
      <p className="hud">404</p>
      <h1>Lost in hyperspace.</h1>
      <p className={s.lead}>There is no map for this coordinate.</p>
      <p>
        <a className="btn primary" href="/">
          <span className="k">Back to</span> hydian.org
        </a>
      </p>
    </main>
  );
}
