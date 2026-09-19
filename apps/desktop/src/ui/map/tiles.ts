// Map tile images: a shared cache, and an opaque backing for tiles that sit on top of other tiles.
import { assetUrl, type MapTile } from "../../data/maps";

const imgCache = new Map<string, HTMLImageElement>();
/** Views that want a repaint when a tile (or its backing) finishes loading. */
export const tileListeners = new Set<() => void>();
const repaint = () => tileListeners.forEach((f) => f());

export function tileImage(file: string): HTMLImageElement {
  let im = imgCache.get(file);
  if (!im) {
    im = new Image();
    im.crossOrigin = "anonymous";
    im.decoding = "async";
    im.onload = repaint;
    im.src = assetUrl(file);
    imgCache.set(file, im);
  }
  return im;
}

// A tile drawn over another tile (region over world, room over region) gets an opaque backing under its
// artwork: the game only ever shows one map at a time, and the two drawings of the same place differ by a
// few texels, which reads as a misaligned double image when both are visible. The backing follows the tile's
// own alpha (thresholded, slightly dilated) so glows and courtyards still show what lies beneath.
const BACKING = "#0e1420";
const backedCache = new Map<string, HTMLCanvasElement>();
const backingQueue = new Set<string>();
const idle = (fn: () => void) =>
  "requestIdleCallback" in window
    ? (
        window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }
      ).requestIdleCallback(fn, { timeout: 250 })
    : setTimeout(fn, 16);

/** The tile ready to draw (backed where needed), or null while its image is still loading. */
export function tileBacked(t: MapTile): CanvasImageSource | null {
  const im = tileImage(t.file);
  if (!im.complete || !im.naturalWidth) return null;
  if (t.depth === 0 && t.kind === "world") return im;
  const hit = backedCache.get(t.file);
  if (hit) return hit;
  // building the backing reads 1M pixels (~20 ms): do it off the frame and repaint when it lands
  if (!backingQueue.has(t.file)) {
    backingQueue.add(t.file);
    idle(() => {
      buildBacking(t, im);
      backingQueue.delete(t.file);
      repaint();
    });
  }
  return im;
}

function buildBacking(t: MapTile, im: HTMLImageElement) {
  const S = im.naturalWidth,
    cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  c.drawImage(im, 0, 0);
  const d = c.getImageData(0, 0, S, S),
    a = d.data;
  for (let i = 3; i < a.length; i += 4) {
    const v = (a[i] - 40) * 2.5;
    a[i] = v <= 0 ? 0 : v >= 255 ? 255 : v;
    a[i - 3] = 14;
    a[i - 2] = 20;
    a[i - 1] = 32;
  }
  const mask = document.createElement("canvas");
  mask.width = mask.height = S;
  mask.getContext("2d")!.putImageData(d, 0, 0);
  c.clearRect(0, 0, S, S);
  c.fillStyle = BACKING;
  const k = 1.02,
    o = (S * (k - 1)) / 2;
  c.drawImage(mask, -o, -o, S * k, S * k); // dilated backing
  c.drawImage(mask, 0, 0);
  c.drawImage(im, 0, 0);
  backedCache.set(t.file, cv);
}
