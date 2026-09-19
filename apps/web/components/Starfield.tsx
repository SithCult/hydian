"use client";
// Three depths of stars drifting slowly, tilted by the pointer and sliding with the scroll (the near ones more).
// One canvas behind everything.
import { useEffect, useRef } from "react";

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    type Star = { x: number; y: number; z: number; r: number; tw: number };
    let stars: Star[] = [];
    let W = 0,
      H = 0,
      mx = 0,
      my = 0,
      tx = 0,
      ty = 0,
      sc = 0, // smoothed scroll position
      raf = 0;
    const dpr = () => Math.min(2, devicePixelRatio || 1);
    const seed = () => {
      W = cv.width = innerWidth * dpr();
      H = cv.height = innerHeight * dpr();
      stars = Array.from({ length: Math.round((innerWidth * innerHeight) / 5000) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.3 + Math.random() ** 2 * 0.7,
        r: 0.4 + Math.random() * 1.1,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#f6e3b4";
    let t0 = performance.now();
    const draw = (t: number) => {
      // a hidden tab or a route change can leave a gap of seconds between frames: never let one frame jump far
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      tx += (mx - tx) * 0.04;
      ty += (my - ty) * 0.04;
      sc += (scrollY - sc) * 0.08;
      ctx.clearRect(0, 0, W, H);
      const col = accent();
      const shift = (reduced ? 0 : sc) * 0.18 * dpr(); // a fifth of the page's speed at the nearest depth
      for (const s of stars) {
        s.y -= (reduced ? 0 : 6) * s.z * dt * dpr();
        if (s.y < 0) s.y += H;
        const px = s.x + tx * s.z * 40 * dpr(),
          py = (((s.y - shift * s.z + ty * s.z * 40 * dpr()) % H) + H) % H;
        ctx.globalAlpha = 0.25 + 0.6 * s.z * (0.6 + 0.4 * Math.sin(t / 900 + s.tw));
        ctx.fillStyle = s.z > 0.85 ? col : "#dfe6ff";
        ctx.beginPath();
        ctx.arc(px, py, s.r * s.z * dpr(), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    };
    seed();
    addEventListener("resize", seed);
    addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", seed);
      removeEventListener("pointermove", onMove);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
    />
  );
}
