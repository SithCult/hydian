import { useEffect, useMemo, useRef, useState } from "react";
import { planetBySlug } from "../data/planets";
import { type Player } from "../model";
import { useApp } from "../store";
import { selectMe, selectPlayersOn } from "../selectors";
import { geom, mapToWorld, planetSurface, worldToMap, MAP_PX } from "./mapgen";
import { clearHeatCache, fetchHeat, heatTexture, HEAT_PX, type Heat } from "../core/heat";
import {
  floorStacks,
  hasRealMap,
  isFloor,
  locate,
  mapsFor,
  pickFloor,
  tileRect,
  SCALE,
  type LevelCluster,
  type MapTile,
} from "../data/maps";
import { Icons, PlanetIcon } from "./bits";
import { tileBacked, tileImage, tileListeners } from "./map/tiles";
import { drawPin, roundRect } from "./map/pins";
import { activeLevels, clusterAt, clusterOfPosition, hiddenBy, levelModel } from "./map/levels";
import { HoverCard, LevelControl, MapLegend, heatSummary, type HeatState } from "./map/Hud";
import { Tip } from "./Tip";
import { DEMO_ZOOM } from "../core/demo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface View {
  scale: number;
  tx: number;
  ty: number;
}
type Mode = "2d" | "3d";
const PITCH = 0.5; // classic 2:1 isometric
const ZOOM_MIN = 0.3,
  ZOOM_MAX = 90; // 90x lets you read a 16 m room at full tile resolution
const ZOOM_WHEEL = 0.0028; // exponential: factor = e^(-deltaY * ZOOM_WHEEL); one 100 px wheel notch = 1.32x
const ZOOM_TAU = 70; // ms time constant of the ease toward the target (short = snappy, still smooth)
const FLING_TAU = 180,
  FLING_MIN = 0.03; // pan inertia: decay time constant (ms) and stop speed (px/ms)

export function MapView() {
  const server = useApp((s) => s.server);
  const slug = useApp((s) => s.planet);
  const players = useApp((s) => selectPlayersOn(s, server, slug));
  const me = useApp(selectMe);
  const hoverKey = useApp((s) => s.hoverKey);
  const setHover = useApp((s) => s.setHover);
  const openModal = useApp((s) => s.openModal);
  const search = useApp((s) => s.search);
  const showPhases = useApp((s) => s.showPhases);
  const planet = planetBySlug(slug)!;
  const g = useMemo(() => geom(planet), [planet]);
  const heatOn = useApp((s) => s.heat);
  const legend = useApp((s) => s.legend);
  const setLegend = useApp((s) => s.setLegend);
  const setHeat = useApp((s) => s.setHeat);
  const serverUrl = useApp((s) => s.serverUrl);
  const heatRef = useRef<Heat | null>(null);
  const [heatState, setHeatState] = useState<HeatState>("off");
  useEffect(() => {
    heatRef.current = null;
    if (!heatOn || !planet?.id || !serverUrl) {
      setHeatState("off");
      return;
    }
    let live = true;
    setHeatState("loading");
    fetchHeat(serverUrl, server, planet.id)
      .then((h) => {
        if (!live) return;
        heatRef.current = h;
        setHeatState(h && h.cells.length ? "ok" : h && h.players < h.minPlayers ? "few" : "empty");
      })
      .catch(() => {
        if (live) setHeatState("error");
      });
    return () => {
      live = false;
    };
  }, [heatOn, planet?.id, server, serverUrl]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  // eased zoom: target scale + the view-space point that must stay under the anchor screen point
  const zoomAnim = useRef<{ target: number; ax: number; ay: number; px: number; py: number } | null>(null);
  const zoomTo = (target: number, ax: number, ay: number) => {
    const v = view.current;
    target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, target));
    zoomAnim.current = { target, ax, ay, px: (ax - v.tx) / v.scale, py: (ay - v.ty) / v.scale };
  };
  const playersRef = useRef(players);
  playersRef.current = players;
  // height (GOM units) used to pick which floor of a stack to draw: hovered player, else me
  const hovP = players.find((p) => p.key === hoverKey);
  const focusH = hovP && hovP.z ? hovP.z / 10 : me && players.some((p) => p.isMe) && me.z ? me.z / 10 : null;
  const focusRef = useRef<number | null>(focusH);
  focusRef.current = focusH;
  const myLoc = me && players.some((p) => p.isMe) ? locate(planet.id, me.x, me.y, me.z) : null;
  const myLocRef = useRef(myLoc);
  myLocRef.current = myLoc;
  // Follow me into buildings: when my floor changes, frame that floor; when I step back outside, pull out to
  // street level. Debounced so an elevator ride or a doorway flicker does not thrash the view.
  const followMe = useApp((s) => s.followMe);
  const lastFloorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!followMe || !me) return;
    const id = myLoc?.floor ? myLoc.tile.id : null;
    if (id === lastFloorRef.current) return;
    const timer = setTimeout(() => {
      const was = lastFloorRef.current;
      lastFloorRef.current = id;
      setLevelChoice({}); // a new floor of mine wins over a manual pick
      if (id && myLoc) viewFloor(myLoc.tile);
      else if (was) centerOn(me.x, me.y, 2.2);
      if (DEMO_ZOOM) centerOn(me.x, me.y, DEMO_ZOOM);
      invalidate();
    }, 1500);
    return () => clearTimeout(timer);
  }, [followMe, myLoc?.floor ? myLoc.tile.id : null, me?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewFloor = (t: MapTile) => {
    const [rx, ry, side] = tileRect(t);
    const el = wrapRef.current!;
    centerOn(rx + side / 2, ry + side / 2, (Math.min(el.clientWidth, el.clientHeight) * 0.6) / (side / g.mpp));
  };
  const hoverRef = useRef(hoverKey);
  hoverRef.current = hoverKey;
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  const hoverPosRef = useRef<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fitTick, setFitTick] = useState(0);
  // ---- 3D (isometric) mode: floors are drawn as planes at their real height
  const [mode, setModeState] = useState<Mode>("2d");
  const modeRef = useRef<Mode>("2d");
  const yawRef = useRef(Math.PI / 4);
  const [hk, setHk] = useState(2.5); // height exaggeration
  // Level control: per cluster of stacked floors, which one is shown. "auto" follows the focused character's
  // height (2D) / shows every level (3D); a tile id isolates that level in both modes.
  const [levelChoice, setLevelChoice] = useState<Record<string, string>>({});
  const levelChoiceRef = useRef(levelChoice);
  levelChoiceRef.current = levelChoice;
  const [viewCluster, setViewCluster] = useState<LevelCluster | null>(null);
  const viewClusterRef = useRef<LevelCluster | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const activeLevelRef = useRef<string | null>(null);
  const chooseLevel = (key: string, id: string | "auto") => {
    invalidate();
    setLevelChoice((c) => {
      const n = { ...c };
      if (id === "auto") delete n[key];
      else n[key] = id;
      return n;
    });
  };
  const cycleLevel = (dir: 1 | -1) => {
    const c = viewClusterRef.current;
    if (!c) return;
    const cur = levelChoiceRef.current[c.key] ?? activeLevelRef.current;
    const i = c.levels.findIndex((t) => t.id === cur);
    const next = c.levels[i < 0 ? (dir > 0 ? 0 : c.levels.length - 1) : (i + dir + c.levels.length) % c.levels.length];
    chooseLevel(c.key, next.id);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "]") cycleLevel(1);
      else if (e.key === "[") cycleLevel(-1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hkRef = useRef(2.5);
  hkRef.current = hk;
  const baseHRef = useRef(0); // ground plane height (log units)
  // 3D: drawn height per floor tile id (equal spacing per level within a cluster), refreshed every frame
  const levelHRef = useRef<Map<string, number>>(new Map());
  const levelStep = () => 3 * hkRef.current * SCALE; // log units between two levels of one cluster

  /** World (log units; H = height, null = ground) -> screen. Affine in both modes. */
  const proj = (X: number, Y: number, Hh: number | null): [number, number] => {
    const { scale, tx, ty } = view.current;
    const [u, v] = worldToMap(g, X, Y);
    if (modeRef.current === "2d") return [tx + u * scale, ty + v * scale];
    const yaw = yawRef.current,
      c = Math.cos(yaw),
      sn = Math.sin(yaw);
    const uc = u - MAP_PX / 2,
      vc = v - MAP_PX / 2;
    const u2 = uc * c - vc * sn + MAP_PX / 2,
      v2 = (uc * sn + vc * c) * PITCH + MAP_PX / 2;
    const h = ((Hh ?? baseHRef.current) - baseHRef.current) / g.mpp;
    return [tx + u2 * scale, ty + (v2 - h) * scale];
  };
  const toScreen = (x: number, y: number): [number, number] => proj(x, y, null);
  /** In 3D a pin sits on the plane of the floor it resolves to (or the ground); raw height would float above it. */
  const pinHeight = (p: Player): number | null => {
    if (modeRef.current !== "3d" || !p.z) return null;
    const loc = locate(planet.id, p.x, p.y, p.z);
    return loc && isFloor(loc.tile) ? (levelHRef.current.get(loc.tile.id) ?? null) : null;
  };
  // Paint on demand: a frame is drawn when state changed (dirty) or while something animates. Idle pulses
  // (my pin, LFRP beacons) run at 30 fps; a static map costs nothing. Keeps the tray-resident app cheap.
  const dirtyRef = useRef(true);
  const invalidate = () => {
    dirtyRef.current = true;
  };
  useEffect(() => {
    dirtyRef.current = true;
  }); // any re-render of the view = something to repaint
  useEffect(() => {
    tileListeners.add(invalidate);
    return () => {
      tileListeners.delete(invalidate);
    };
  }, []);
  const fit = () => {
    const el = wrapRef.current;
    if (!el) return;
    zoomAnim.current = null;
    const s = Math.min(el.clientWidth, el.clientHeight) / MAP_PX;
    view.current = { scale: s, tx: (el.clientWidth - MAP_PX * s) / 2, ty: (el.clientHeight - MAP_PX * s) / 2 };
    invalidate();
  };
  const centerOn = (x: number, y: number, scale?: number, Hh: number | null = null) => {
    const el = wrapRef.current;
    if (!el) return;
    zoomAnim.current = null;
    const s = scale ?? Math.max(view.current.scale, 2.2);
    view.current = { scale: s, tx: 0, ty: 0 };
    const [px, py] = proj(x, y, Hh);
    view.current = { scale: s, tx: el.clientWidth / 2 - px, ty: el.clientHeight / 2 - py };
    invalidate();
  };
  /** Ground plane for 3D: just below the focused character, else the median floor height. */
  const computeBase = () => {
    const meP = playersRef.current.find((p) => p.isMe);
    if (meP?.z) return meP.z - 6 * SCALE;
    const hs = (mapsFor(planet.id)?.maps ?? [])
      .filter(isFloor)
      .map((t) => t.height[0] * SCALE)
      .sort((a, b) => a - b);
    return hs.length ? hs[Math.floor(hs.length / 2)] - 6 * SCALE : 0;
  };
  const setMode = (m: Mode) => {
    modeRef.current = m;
    setModeState(m);
    if (m === "3d") {
      baseHRef.current = computeBase();
      const meP = playersRef.current.find((p) => p.isMe);
      if (meP) centerOn(meP.x, meP.y, Math.max(view.current.scale, 3.5), pinHeight(meP));
    }
  };

  useEffect(() => {
    fit();
    if (modeRef.current === "3d") baseHRef.current = computeBase();
    setFitTick((t) => t + 1);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- render loop
  useEffect(() => {
    const cv = cvRef.current!,
      el = wrapRef.current!;
    const ctx = cv.getContext("2d", { alpha: false })!;
    let raf = 0;
    const real = hasRealMap(planet.id);
    const surface = real ? null : planetSurface(planet);
    const pm = real ? mapsFor(planet.id)! : null;
    const tiles = pm
      ? pm.maps
          .filter((t) => !isFloor(t))
          .sort((a, b) => a.depth - b.depth || b.bounds[1] - b.bounds[0] - (a.bounds[1] - a.bounds[0]))
      : [];
    const stacks = pm ? floorStacks(pm) : [];
    const lm = levelModel(pm);
    /** The cluster under the view centre (else the one my character is in) drives the level control. */
    const updateViewCluster = (cx: number, cy: number, act: Map<string, MapTile | null>) => {
      const [wx, wy] = mapToWorld(
        g,
        (cx - view.current.tx) / view.current.scale,
        (cy - view.current.ty) / view.current.scale,
      );
      // my own building wins while the view is over it (the floor my height resolves to, so a small stack
      // nested inside a bigger one does not flip the control depending on where the centre lands)
      const meP = playersRef.current.find((p) => p.isMe);
      const mine = meP ? clusterOfPosition(lm, planet.id, meP.x, meP.y, meP.z) : undefined;
      const inMine =
        mine &&
        wx / SCALE >= mine.bounds[0] &&
        wx / SCALE <= mine.bounds[1] &&
        wy / SCALE >= mine.bounds[2] &&
        wy / SCALE <= mine.bounds[3];
      const hit = (inMine ? mine : undefined) ?? clusterAt(lm, wx, wy) ?? mine ?? null;
      if ((hit?.key ?? null) !== (viewClusterRef.current?.key ?? null)) {
        viewClusterRef.current = hit;
        setViewCluster(hit);
      }
      const a = hit ? (act.get(hit.key)?.id ?? null) : null;
      if (a !== activeLevelRef.current) {
        activeLevelRef.current = a;
        setActiveLevel(a);
      }
    };
    for (const t of tiles) tileImage(t.file); // interiors load lazily when they come into view
    const ro = new ResizeObserver(() => {
      const dpr = devicePixelRatio;
      cv.width = el.clientWidth * dpr;
      cv.height = el.clientHeight * dpr;
      dirtyRef.current = true;
    });
    ro.observe(el);
    let lastT = 0,
      lastPaint = 0;
    const draw = (t: number) => {
      const dpr = devicePixelRatio,
        W = el.clientWidth,
        H = el.clientHeight;
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      // pan inertia after a fling
      const fl = fling.current;
      if (fl) {
        view.current.tx += fl.vx * dt;
        view.current.ty += fl.vy * dt;
        const k = Math.exp(-dt / FLING_TAU);
        fl.vx *= k;
        fl.vy *= k;
        if (Math.hypot(fl.vx, fl.vy) < FLING_MIN) fling.current = null;
      }
      const interactive = !!zoomAnim.current || !!drag.current || !!fling.current;
      if (!interactive) {
        const ambient = playersRef.current.some((p) => p.isMe || (p.lfrp && p.status !== "invisible"));
        if (!dirtyRef.current && (!ambient || t - lastPaint < 32)) {
          raf = requestAnimationFrame(draw);
          return;
        }
      }
      dirtyRef.current = false;
      lastPaint = t;
      const za = zoomAnim.current;
      if (za) {
        const v = view.current;
        let s = v.scale + (za.target - v.scale) * (1 - Math.exp(-dt / ZOOM_TAU));
        if (Math.abs(za.target - s) < 0.002 * s) {
          s = za.target;
          zoomAnim.current = null;
        }
        // keep the anchored view-space point under the cursor / screen centre
        view.current = { scale: s, tx: za.ax - za.px * s, ty: za.ay - za.py * s };
      }
      if (cv.width !== W * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, W, H);
      const { scale, tx, ty } = view.current;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = interactive ? "low" : "high"; // cheap while moving, crisp once it settles
      if (surface) ctx.drawImage(surface, tx, ty, MAP_PX * scale, MAP_PX * scale);
      else if (modeRef.current === "3d" && pm) {
        ctx.fillStyle = "#0b1018";
        ctx.fillRect(0, 0, W, H);
        const base = baseHRef.current,
          yaw = yawRef.current,
          c = Math.cos(yaw),
          sn = Math.sin(yaw);
        const focusTile = myLocRef.current?.tile.id ?? null;
        const cornersOf = (t: MapTile, Hh: number): [number, number][] => {
          const [x0, x1, z0, z1] = t.bounds.map((v) => v * SCALE);
          return [proj(x0, z0, Hh), proj(x1, z0, Hh), proj(x1, z1, Hh), proj(x0, z1, Hh)];
        };
        const drawTile3D = (t: MapTile, Hh: number, alpha: number): boolean => {
          const [rx, ry, side] = tileRect(t);
          const cs = [
            proj(rx, ry, Hh),
            proj(rx + side, ry, Hh),
            proj(rx + side, ry + side, Hh),
            proj(rx, ry + side, Hh),
          ];
          const xs = cs.map((q) => q[0]),
            ys = cs.map((q) => q[1]);
          const w = Math.max(...xs) - Math.min(...xs);
          if (w < 26 || Math.max(...xs) < 0 || Math.max(...ys) < 0 || Math.min(...xs) > W || Math.min(...ys) > H)
            return false;
          const im = tileBacked(t);
          if (!im) return false;
          const S = (im as HTMLCanvasElement).width;
          const k = (side / (g.mpp * S)) * scale;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.transform(k * c, k * sn * PITCH, -k * sn, k * c * PITCH, cs[0][0], cs[0][1]);
          ctx.globalAlpha = alpha;
          ctx.drawImage(im, 0, 0, S, S);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.globalAlpha = 1;
          return true;
        };
        const path = (pts: [number, number][]) => {
          ctx.beginPath();
          pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          ctx.closePath();
        };
        const act3 = activeLevels(lm, levelChoiceRef.current, focusRef.current, true),
          hidden3 = hiddenBy(lm, act3);
        updateViewCluster(W / 2, H / 2, act3);
        // ground: planet map + regions
        for (const t of tiles) drawTile3D(t, base, t.depth === 0 ? 0.95 : 0.85);
        // floors near the ground plane, lowest first (painter's order)
        const step = levelStep(),
          levelH = new Map<string, number>();
        for (const [id, lvl] of lm.levelIdx) levelH.set(id, base + (lvl + 0.35) * step);
        levelHRef.current = levelH;
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const t of [...lm.floors].sort((a, b) => levelH.get(a.id)! - levelH.get(b.id)!)) {
          if (hidden3(t)) continue;
          const Hh = levelH.get(t.id)!;
          const focused = t.id === focusTile;
          const cs = cornersOf(t, Hh);
          const wpx = Math.max(...cs.map((q) => q[0])) - Math.min(...cs.map((q) => q[0]));
          if (wpx < 24) continue;
          // drop lines to the ground, then the plane, then its outline
          if (Hh > base + 0.5 * step) {
            ctx.strokeStyle = focused ? "rgba(143,220,255,.45)" : "rgba(191,233,255,.16)";
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
              const [x0, x1, z0, z1] = t.bounds.map((v) => v * SCALE);
              const X = i === 0 || i === 3 ? x0 : x1,
                Z = i < 2 ? z0 : z1;
              const gpt = proj(X, Z, base);
              ctx.beginPath();
              ctx.moveTo(cs[i][0], cs[i][1]);
              ctx.lineTo(gpt[0], gpt[1]);
              ctx.stroke();
            }
          }
          const drawn = drawTile3D(t, Hh, focused ? 1 : 0.92);
          path(cs);
          if (focused) {
            ctx.fillStyle = "rgba(143,220,255,.10)";
            ctx.fill();
          }
          ctx.strokeStyle = focused ? "#8fdcff" : drawn ? "rgba(191,233,255,.45)" : "rgba(191,233,255,.25)";
          ctx.lineWidth = focused ? 2 : 1;
          ctx.stroke();
          if (wpx > 150 || focused) {
            const [lx, ly] = cs[3];
            const label = t.label;
            const tw = ctx.measureText(label).width + 12;
            ctx.fillStyle = focused ? "rgba(143,220,255,.92)" : "rgba(6,9,26,.85)";
            roundRect(ctx, lx + 6, ly - 9, tw, 18, 4);
            ctx.fill();
            ctx.fillStyle = focused ? "#0b1220" : "#cfd8e3";
            ctx.fillText(label, lx + 12, ly);
          }
        }
        ctx.textAlign = "center";
      } else {
        // subtle backdrop grid behind the real map
        ctx.fillStyle = "#0e1420";
        ctx.fillRect(0, 0, W, H);
        const zoomT = Math.max(0, Math.min(1, (scale - 1.3) / 1.2)); // regions fade in as you zoom
        const drawTile = (t: MapTile, alpha: number, minPx = 0) => {
          const [rx, ry, side] = tileRect(t);
          const [u, v] = worldToMap(g, rx, ry);
          const sx = tx + u * scale,
            sy = ty + v * scale,
            ss = (side / g.mpp) * scale;
          if (ss < minPx || sx + ss < 0 || sy + ss < 0 || sx > W || sy > H) return;
          const im = tileBacked(t);
          if (!im) return;
          ctx.globalAlpha = alpha;
          if (alpha > 0) ctx.drawImage(im, sx, sy, ss, ss);
        };
        for (const t of tiles) drawTile(t, t.depth === 0 ? 1 : zoomT);
        // interior floors: one per footprint, chosen by the focused character's height; one level per cluster
        const focus = focusRef.current;
        const act2 = activeLevels(lm, levelChoiceRef.current, focus, false),
          hidden2 = hiddenBy(lm, act2);
        updateViewCluster(W / 2, H / 2, act2);
        for (const stack of stacks) {
          const t = pickFloor(stack, focus);
          if (hidden2(t)) continue;
          const [, , side] = tileRect(t);
          const ss = (side / g.mpp) * scale;
          drawTile(t, Math.max(0, Math.min(1, (ss - 120) / 120)), 120);
        }
        ctx.globalAlpha = 1;
      }
      // metre grid when zoomed in (procedural maps only; real maps carry their own detail)
      const pxPerM = scale / g.mpp;
      if (surface && pxPerM > 0.08) {
        const step = pxPerM > 0.5 ? 100 : 500;
        ctx.strokeStyle = "rgba(255,255,255,.05)";
        ctx.lineWidth = 1;
        const [wx0, wy0] = mapToWorld(g, (0 - tx) / scale, (H - ty) / scale),
          [wx1, wy1] = mapToWorld(g, (W - tx) / scale, (0 - ty) / scale);
        for (let x = Math.floor(wx0 / step) * step; x < wx1; x += step) {
          const [sx] = toScreen(x, 0);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, H);
          ctx.stroke();
        }
        for (let y = Math.floor(wy0 / step) * step; y < wy1; y += step) {
          const [, sy] = toScreen(0, y);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(W, sy);
          ctx.stroke();
        }
      }
      // heat layer: one map-space texture drawn with the map's own affine transform (2D and 3D alike)
      const heat = heatRef.current;
      if (heat && heat.cells.length) {
        const tex = heatTexture(heat, (x, y) => worldToMap(g, x, y), g.mpp, MAP_PX);
        // where the texture's origin and its two axes land on screen
        const [o, px, py] = (
          [
            [0, 0],
            [MAP_PX, 0],
            [0, MAP_PX],
          ] as const
        ).map(([u, v]) => toScreen(...mapToWorld(g, u, v)));
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.transform(
          (px[0] - o[0]) / HEAT_PX,
          (px[1] - o[1]) / HEAT_PX,
          (py[0] - o[0]) / HEAT_PX,
          (py[1] - o[1]) / HEAT_PX,
          o[0],
          o[1],
        );
        ctx.globalAlpha = 0.9;
        ctx.drawImage(tex, 0, 0);
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      // pins: others first, then me, then the hovered one on top
      const list = playersRef.current,
        hk = hoverRef.current;
      const q = search.trim().toLowerCase();
      const showName = list.length <= 18 || scale > 2.2;
      const iso = modeRef.current === "3d";
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const pin = (p: Player, hovered: boolean) => {
        const [sx, sy] = proj(p.x, p.y, pinHeight(p));
        if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) return;
        drawPin(ctx, p, sx, sy, { hovered, dim: !!q && !p.name.toLowerCase().includes(q), showName, iso, t });
      };
      let hov: Player | null = null;
      for (const p of list) {
        if (p.key === hk) hov = p;
        else if (!p.isMe) pin(p, false);
      }
      for (const p of list) if (p.isMe && p.key !== hk) pin(p, false);
      if (hov) pin(hov, true);
      // the hover card anchors to the pin (hovered on the map or in a list) and follows it through pans/zooms
      if (hov) {
        const [hx, hy] = proj(hov.x, hov.y, pinHeight(hov));
        const prev = hoverPosRef.current;
        if (!prev || Math.abs(prev[0] - hx) > 0.5 || Math.abs(prev[1] - hy) > 0.5) {
          hoverPosRef.current = [hx, hy];
          setHoverPos([hx, hy]);
        }
      } else if (hoverPosRef.current) {
        hoverPosRef.current = null;
        setHoverPos(null);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [planet, g, search, fitTick, showPhases]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- interaction
  const pick = (mx: number, my: number): Player | null => {
    let best: Player | null = null,
      bd = 14;
    for (const p of playersRef.current) {
      const [sx, sy] = proj(p.x, p.y, pinHeight(p));
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    rotate: boolean;
    vx: number;
    vy: number;
    at: number;
  } | null>(null);
  const fling = useRef<{ vx: number; vy: number } | null>(null);
  const onDown = (e: React.MouseEvent) => {
    invalidate();
    fling.current = null;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      rotate: modeRef.current === "3d" && (e.button === 2 || e.shiftKey),
      vx: 0,
      vy: 0,
      at: performance.now(),
    };
    setDragging(true);
  };
  const onMove = (e: React.MouseEvent) => {
    const rect = cvRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    invalidate();
    if (drag.current) {
      const dx = e.clientX - drag.current.x,
        dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      if (drag.current.rotate) {
        yawRef.current += dx * 0.006; // rotate the camera
      } else {
        view.current.tx += dx;
        view.current.ty += dy;
        if (zoomAnim.current) {
          zoomAnim.current.ax += dx;
          zoomAnim.current.ay += dy;
        }
        const now = performance.now(),
          ms = Math.max(1, now - drag.current.at);
        drag.current.vx = 0.6 * drag.current.vx + 0.4 * (dx / ms);
        drag.current.vy = 0.6 * drag.current.vy + 0.4 * (dy / ms);
        drag.current.at = now;
      }
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    }
    const p = drag.current ? null : pick(mx, my);
    setHover(p?.key ?? null);
  };
  const onUp = (e: React.MouseEvent) => {
    const d = drag.current,
      moved = d?.moved;
    drag.current = null;
    setDragging(false);
    // a quick release keeps the map gliding; a held pointer stops dead
    if (d && moved && !d.rotate && performance.now() - d.at < 60 && Math.hypot(d.vx, d.vy) > 0.15)
      fling.current = { vx: d.vx, vy: d.vy };
    if (!moved) {
      const rect = cvRef.current!.getBoundingClientRect();
      const p = pick(e.clientX - rect.left, e.clientY - rect.top);
      if (p) openModal({ kind: "profile", key: p.key });
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    invalidate();
    const rect = cvRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    // normalise: wheel lines/pages -> pixels; trackpad pinch arrives as ctrl+wheel with small deltas
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const base = zoomAnim.current?.target ?? view.current.scale;
    zoomTo(base * Math.exp(-dy * ZOOM_WHEEL * (e.ctrlKey ? 2.5 : 1)), mx, my);
  };
  const zoom = (f: number) => {
    const el = wrapRef.current!;
    zoomTo((zoomAnim.current?.target ?? view.current.scale) * f, el.clientWidth / 2, el.clientHeight / 2);
  };

  const hovered = players.find((p) => p.key === hoverKey);
  const meHere = me && players.some((p) => p.isMe);

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={cvRef}
        className={dragging ? "grabbing" : ""}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => {
          drag.current = null;
          setDragging(false);
          setHover(null);
          invalidate();
        }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {players.length === 0 && (
        <div className="map-empty">
          <div>
            <b>Quiet on {planet.name}</b>Heatmap and history show where people usually are.
          </div>
        </div>
      )}
      <div className="map-info">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PlanetIcon slug={planet.slug} size={28} faction={planet.faction} />
          <b>{planet.name}</b>
        </div>
        <div style={{ marginTop: 6, color: "var(--text-muted)" }}>
          {players.length} on the map{meHere ? " · you are here" : ""}
        </div>
        {myLoc && (
          <div className="loc">
            <span className="crumb">
              {myLoc.path.slice(0, -1).join(" › ")}
              {myLoc.path.length > 1 ? " › " : ""}
            </span>
            <b>{myLoc.label}</b>
            {myLoc.floor && (
              <Button variant="secondary" size="xs" onClick={() => viewFloor(myLoc.tile)}>
                View floor
              </Button>
            )}
          </div>
        )}
        {mode === "3d" && (
          <div className="iso">
            <label>
              Level spacing{" "}
              <Slider
                className="inline-flex w-[120px] align-middle"
                min={1}
                max={6}
                step={0.5}
                value={[hk]}
                onValueChange={([v]) => setHk(v)}
              />{" "}
              {3 * hk} m
            </label>
            <span className="k">
              right-drag or shift-drag to rotate · stacked floors are spaced evenly, not by real height
            </span>
          </div>
        )}
      </div>
      {viewCluster && (
        <LevelControl
          cluster={viewCluster}
          chosen={levelChoice[viewCluster.key]}
          active={activeLevel}
          mode={mode}
          onChoose={(id) => chooseLevel(viewCluster.key, id)}
        />
      )}
      <div className="map-tools">
        <Tip label="Zoom in" side="left">
          <button onClick={() => zoom(1.7)}>+</button>
        </Tip>
        <Tip label="Zoom out" side="left">
          <button onClick={() => zoom(1 / 1.7)}>−</button>
        </Tip>
        <Tip label="Fit the whole planet" side="left">
          <button onClick={fit}>{Icons.fit()}</button>
        </Tip>
        <Tip label={meHere ? "Center on my character" : "Your character is not on this planet"} side="left">
          <span className="tip-wrap">
            <button
              className={meHere ? "on" : ""}
              disabled={!meHere}
              onClick={() => me && centerOn(me.x, me.y, undefined, pinHeight(me))}
            >
              {Icons.locate()}
            </button>
          </span>
        </Tip>
        {planet.id && (
          <Tip label={heatSummary(heatState)} side="left">
            <button
              className={heatOn ? "on" : ""}
              onClick={() => {
                clearHeatCache();
                setHeat(!heatOn);
              }}
            >
              {heatState === "loading" ? "…" : Icons.flame({ width: 16, height: 16 })}
            </button>
          </Tip>
        )}
        {hasRealMap(planet.id) && (
          <Tip label={mode === "3d" ? "Back to the flat map" : "Isometric view of stacked floors"} side="left">
            <button
              className={mode === "3d" ? "on" : ""}
              onClick={() => setMode(mode === "3d" ? "2d" : "3d")}
              style={{ fontSize: 12 }}
            >
              3D
            </button>
          </Tip>
        )}
      </div>
      <MapLegend heatState={heatState} open={legend} onToggle={() => setLegend(!legend)} />
      {hovered && hoverPos && <HoverCard p={hovered} pos={hoverPos} planetId={planet.id} />}
    </div>
  );
}
