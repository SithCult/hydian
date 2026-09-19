// Aggregated, anonymous statistics: where and when roleplay happens on a server.
//
// Only live pings sent while IN CHARACTER count: the map answers "where is roleplay happening", not "where do
// people stand around" - history (no status) and sightings (other players, status unknown) are deliberately
// left out. Nothing is served below MIN_PLAYERS distinct characters, and a payload carries counts only: no
// names, ids or timestamps.
import type { FastifyInstance } from "fastify";
import { pool } from "../db.ts";
import { TtlCache } from "../cache.ts";
import { SERVER_RE, ID_RE, clampDays } from "../schemas.ts";
import { ADMIN_KEY } from "../config.ts";

const CELL = 40; // log units per heat cell
const MAX_CELLS = 4000;
const MIN_PLAYERS = 10; // an area shows data only once this many different characters were IC there in the window
const TTL = 5 * 60_000;

const emptyGrid = () => Array.from({ length: 7 }, () => Array<number>(24).fill(0));

export default async function heat(app: FastifyInstance) {
  // Cells of CELL log units per server + area over a trailing window. A cell is dropped unless it aggregates
  // several people, or one person over several days (a habit, not a location fix).
  const heatCache = new TtlCache<unknown>(TTL);
  app.get<{ Querystring: { server?: string; area?: string; days?: string } }>("/v1/heat", async (req, reply) => {
    const server = req.query.server ?? "",
      area = req.query.area ?? "";
    const days = clampDays(req.query.days, 365);
    if (!SERVER_RE.test(server) || !ID_RE.test(area))
      return reply.code(400).send({ error: "server and area required" });
    const key = `${server}:${area}:${days}`;
    const hit = heatCache.get(key);
    if (hit) return hit;
    const n = await pool.query(
      `SELECT count(DISTINCT character_id) AS players FROM pings
       WHERE server = $1 AND area_id = $2 AND x IS NOT NULL AND status = 'ic' AND kind <> 'history' AND log_ts > now() - ($3 || ' days')::interval`,
      [server, area, String(days)],
    );
    const players = Number(n.rows[0]?.players ?? 0);
    const body = { server, area, days, cell: CELL, players, minPlayers: MIN_PLAYERS, cells: [] as number[][] };
    if (players < MIN_PLAYERS) return heatCache.set(key, body);
    const r = await pool.query(
      `WITH pts AS (
         SELECT character_id, x, y, log_ts FROM pings
         WHERE server = $1 AND area_id = $2 AND x IS NOT NULL AND status = 'ic' AND kind <> 'history' AND log_ts > now() - ($3 || ' days')::interval),
       cells AS (
         SELECT floor(x / $4) AS cx, floor(y / $4) AS cz, count(DISTINCT character_id) AS people, count(DISTINCT log_ts::date) AS days, count(*) AS samples
         FROM pts GROUP BY 1, 2)
       SELECT cx, cz, people, days, samples FROM cells WHERE people >= 2 OR days >= 3 ORDER BY samples DESC LIMIT $5`,
      [server, area, String(days), CELL, MAX_CELLS],
    );
    body.cells = r.rows.map((c) => [Number(c.cx), Number(c.cz), Number(c.people), Number(c.days), Number(c.samples)]);
    return heatCache.set(key, body);
  });

  // 7 x 24 grid (ISO weekday x hour, UTC) of distinct (character, day) In-Character presences.
  const actCache = new TtlCache<unknown>(TTL);
  app.get<{ Querystring: { server?: string; days?: string } }>("/v1/activity", async (req, reply) => {
    const server = req.query.server ?? "";
    const days = clampDays(req.query.days, 90);
    if (!SERVER_RE.test(server)) return reply.code(400).send({ error: "server required" });
    const key = `${server}:${days}`;
    const hit = actCache.get(key);
    if (hit) return hit;
    const r = await pool.query(
      `WITH ic AS (
         SELECT DISTINCT character_id, log_ts::date AS d, extract(isodow FROM log_ts)::int AS dow, extract(hour FROM log_ts)::int AS hr
         FROM pings WHERE server = $1 AND status = 'ic' AND kind <> 'history' AND log_ts > now() - ($2 || ' days')::interval)
       SELECT dow, hr, count(*) AS n, (SELECT count(DISTINCT character_id) FROM ic) AS players FROM ic GROUP BY 1, 2`,
      [server, String(days)],
    );
    const players = Number(r.rows[0]?.players ?? 0);
    let grid: number[][] | null = null;
    if (players >= MIN_PLAYERS) {
      grid = emptyGrid();
      for (const x of r.rows) grid[Number(x.dow) - 1][Number(x.hr)] = Number(x.n);
    }
    return actCache.set(key, { server, days, players, minPlayers: MIN_PLAYERS, tz: "UTC", grid });
  });

  // Internal, per-character availability: "when does this character usually play, and where". Guarded by
  // ADMIN_KEY and not surfaced in the app - a 404 without the key so the route does not advertise itself.
  app.get<{ Querystring: { server?: string; id?: string; days?: string } }>(
    "/v1/internal/availability",
    async (req, reply) => {
      if (!ADMIN_KEY || req.headers["x-admin-key"] !== ADMIN_KEY) return reply.code(404).send();
      const server = req.query.server ?? "",
        id = req.query.id ?? "";
      const days = clampDays(req.query.days, 180);
      if (!SERVER_RE.test(server) || !ID_RE.test(id)) return reply.code(400).send({ error: "server and id required" });
      const g = await pool.query(
        `SELECT extract(isodow FROM log_ts)::int AS dow, extract(hour FROM log_ts)::int AS hr, count(DISTINCT log_ts::date) AS days
         FROM pings WHERE server = $1 AND character_id = $2 AND log_ts > now() - ($3 || ' days')::interval GROUP BY 1, 2`,
        [server, id, String(days)],
      );
      const a = await pool.query(
        `SELECT area_id::text AS area_id, max(area_name) AS area_name, count(DISTINCT log_ts::date) AS days, count(*) AS samples
         FROM pings WHERE server = $1 AND character_id = $2 AND area_id IS NOT NULL AND log_ts > now() - ($3 || ' days')::interval
         GROUP BY 1 ORDER BY days DESC, samples DESC LIMIT 5`,
        [server, id, String(days)],
      );
      const grid = emptyGrid();
      for (const x of g.rows) grid[Number(x.dow) - 1][Number(x.hr)] = Number(x.days);
      return {
        server,
        id,
        days,
        tz: "UTC",
        grid,
        areas: a.rows.map((x) => ({
          areaId: x.area_id,
          areaName: x.area_name,
          days: Number(x.days),
          samples: Number(x.samples),
        })),
      };
    },
  );
}
