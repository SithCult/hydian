// "When is roleplay happening on this server": an anonymous weekday x hour grid from the Hydian server.
export interface Activity {
  server: string;
  days: number;
  players: number;
  minPlayers: number;
  tz: string;
  grid: number[][] | null;
}

const cache = new Map<string, { at: number; a: Activity }>();
export async function fetchActivity(baseUrl: string, server: string, days = 90): Promise<Activity> {
  const key = `${baseUrl}|${server}|${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.a;
  const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/activity?server=${encodeURIComponent(server)}&days=${days}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const a = (await r.json()) as Activity;
  cache.set(key, { at: Date.now(), a });
  return a;
}
/** Shift a UTC grid into the viewer's local time zone (whole hours only, good enough for a heat strip). */
export function toLocal(grid: number[][]): number[][] {
  const off = -new Date().getTimezoneOffset() / 60; // hours east of UTC
  const out: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++) {
      let lh = h + off,
        ld = d;
      if (lh >= 24) {
        lh -= 24;
        ld = (d + 1) % 7;
      } else if (lh < 0) {
        lh += 24;
        ld = (d + 6) % 7;
      }
      out[ld][Math.round(lh)] += grid[d][h];
    }
  return out;
}
