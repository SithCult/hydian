// Windows keeps no title bar of its own: the window is undecorated and these are its buttons, sitting in the
// app's own top row. macOS keeps the system traffic lights (titleBarStyle "Overlay").
import { useEffect, useState } from "react";
import { isTauri } from "../core/fs";
import { OS } from "../core/platform";

type Win = { minimize(): Promise<void>; toggleMaximize(): Promise<void>; close(): Promise<void> };

async function win(): Promise<
  Win & { isMaximized(): Promise<boolean>; onResized(cb: () => void): Promise<() => void> }
> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

const I = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden>
    <path d={d} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />
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

  const act = (fn: (w: Win) => Promise<void>) => () => void win().then(fn);
  return (
    <div className="win-chrome" data-tauri-drag-region>
      <button className="wc" onClick={act((w) => w.minimize())} aria-label="Minimise" title="Minimise">
        <I d="M0 5h10" />
      </button>
      <button
        className="wc"
        onClick={act((w) => w.toggleMaximize())}
        aria-label={max ? "Restore" : "Maximise"}
        title={max ? "Restore" : "Maximise"}
      >
        {max ? <I d="M0.5 2.5h7v7h-7zM2.5 2.5V0.5h7v7h-2" /> : <I d="M0.5 0.5h9v9h-9z" />}
      </button>
      <button className="wc close" onClick={act((w) => w.close())} aria-label="Close" title="Close">
        <I d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
      </button>
    </div>
  );
}
