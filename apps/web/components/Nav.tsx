import Link from "next/link";
import { Mark } from "./Mark";
import s from "./Nav.module.css";

const LINKS = [
  ["/#why", "Why"],
  ["/#map", "Map"],
  ["/#features", "Features"],
  ["/#data", "Your data"],
  ["/#route", "Roadmap"],
  ["/#faq", "Questions"],
  ["/about", "About"],
] as const;

export function Nav() {
  return (
    <header className={s.top}>
      <Link className={s.brand} href="/">
        <Mark size={30} orbit="#fff" />
        <span>Hydian</span>
      </Link>
      <nav className={s.links}>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <Link className="btn primary small" href="/download">
        Download
      </Link>
    </header>
  );
}
