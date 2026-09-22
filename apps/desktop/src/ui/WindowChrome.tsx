// Windows keeps no title bar of its own: the window is undecorated and these are its buttons, sitting in the
// app's own top row. macOS keeps the system traffic lights (titleBarStyle "Overlay").
import { useEffect, useState } from "react";
import { isTauri } from "../core/fs";
import { OS } from "../core/platform";
import { Tip } from "./Tip";

type Win = Awaited<ReturnType<typeof win>>;

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden>
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export function WindowChrome() {
  const [max, setMax] = useState(false);
  const on = isTauri() && OS !== "mac";
  useEffect(() => {
    if (!on) return;
    let stop: (() => void) | undefined;
    let disposed = false;
    void win()
      .then(async (w) => {
        setMax(await w.isMaximized());
        const off = await w.onResized(() => void w.isMaximized().then(setMax));
        if (disposed) off();
        else stop = off;
      })
      .catch(() => {
        /* the buttons still work; only the maximised/restored glyph stays put */
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [on]);
  if (!on) return null;

  const act = (fn: (w: Win) => Promise<unknown>) => () => {
    void win()
      .then(fn)
      .catch(() => {
        /* nothing to fall back to: the window has no title bar of its own */
      });
  };
  return (
    <div className="win-chrome" data-tauri-drag-region>
      <Tip label="Minimise" side="bottom">
        <button className="wc" onClick={act((w) => w.minimize())} aria-label="Minimise">
          <I d="M0 5h10" />
        </button>
      </Tip>
      <Tip label={max ? "Restore" : "Maximise"} side="bottom">
        <button className="wc" onClick={act((w) => w.toggleMaximize())} aria-label={max ? "Restore" : "Maximise"}>
          {max ? <I d="M0.5 2.5h7v7h-7zM2.5 2.5V0.5h7v7h-2" /> : <I d="M0.5 0.5h9v9h-9z" />}
        </button>
      </Tip>
      <Tip label="Close to the tray" side="bottom">
        <button className="wc close" onClick={act((w) => w.close())} aria-label="Close">
          <I d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
        </button>
      </Tip>
    </div>
  );
}
