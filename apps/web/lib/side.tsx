"use client";
// Republic or Empire: recolours the whole site through the data-side attribute. Remembered per browser.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Side } from "./site";

const KEY = "hydian:side";
const Ctx = createContext<{ side: Side; setSide: (s: Side) => void }>({ side: "republic", setSide: () => {} });

export function SideProvider({ children }: { children: ReactNode }) {
  const [side, set] = useState<Side>("republic");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "empire" || saved === "republic") set(saved);
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.side = side;
  }, [side]);
  const setSide = (s: Side) => {
    set(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ side, setSide }}>{children}</Ctx.Provider>;
}

export const useSide = () => useContext(Ctx);
