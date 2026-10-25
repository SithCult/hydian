"use client";
import { useSide } from "@/lib/side";
import s from "./ThemeSwitch.module.css";

// A quiet footer link that flips the site between gold and crimson: an easter egg rather than a setting.
export function ThemeSwitch() {
  const { side, setSide } = useSide();
  const gold = side === "republic";
  return (
    <button className={s.switch} onClick={() => setSide(gold ? "empire" : "republic")}>
      {gold ? "Try crimson" : "Back to gold"}
    </button>
  );
}
