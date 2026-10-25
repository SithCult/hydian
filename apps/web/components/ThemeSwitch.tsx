"use client";
import { useSide } from "@/lib/side";
import s from "./ThemeSwitch.module.css";

const THEMES = [
  ["republic", "Light side"],
  ["empire", "Dark side"],
] as const;

export function ThemeSwitch() {
  const { side, setSide } = useSide();
  return (
    <div className={s.wrap}>
      <span className={s.label}>Site theme</span>
      <div className={s.switch} role="radiogroup" aria-label="Site theme">
        {THEMES.map(([k, label]) => (
          <button
            key={k}
            role="radio"
            aria-checked={side === k}
            className={`${s[k]} ${side === k ? s.on : ""}`}
            onClick={() => setSide(k)}
          >
            <i aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
