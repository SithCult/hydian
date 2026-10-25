"use client";
import { useSide } from "@/lib/side";
import s from "./ThemeSwitch.module.css";

const THEMES = [
  ["republic", "Gold"],
  ["empire", "Crimson"],
] as const;

// A quiet pair of dots at the end of the footer: a small easter egg rather than a setting.
export function ThemeSwitch() {
  const { side, setSide } = useSide();
  return (
    <span className={s.switch} role="radiogroup" aria-label="Site colour">
      {THEMES.map(([k, label]) => (
        <button
          key={k}
          role="radio"
          aria-checked={side === k}
          aria-label={label}
          title={label}
          className={`${s[k]} ${side === k ? s.on : ""}`}
          onClick={() => setSide(k)}
        />
      ))}
    </span>
  );
}
